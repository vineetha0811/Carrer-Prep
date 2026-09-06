import prisma from '../prisma.js';

const EASY_INTERVAL_DAYS = 3;
const MEDIUM_INTERVAL_DAYS = 6;
const HARD_INTERVAL_DAYS = 10;

// Compute per-topic stats used by the question engine and the dashboard.
export async function getTopicStatsForUser(userId) {
  const attempts = await prisma.questionAttempt.findMany({
    where: { userId },
    orderBy: { evaluatedAt: 'desc' },
    take: 300,
    select: { topic: true, category: true, isCorrect: true, correctness: true, score: true, difficulty: true, evaluatedAt: true },
  });

  const byTopic = {};
  let overallCorrect = 0;
  let overallAttempts = 0;

  for (const a of attempts) {
    overallAttempts += 1;
    if (a.isCorrect) overallCorrect += 1;
    if (!byTopic[a.topic]) {
      byTopic[a.topic] = { attempts: 0, correct: 0, scoreSum: 0, lastSeen: null, categories: new Set() };
    }
    const t = byTopic[a.topic];
    t.attempts += 1;
    if (a.isCorrect) t.correct += 1;
    t.scoreSum += a.score;
    t.categories.add(a.category);
    if (!t.lastSeen || a.evaluatedAt > t.lastSeen) t.lastSeen = a.evaluatedAt;
  }

  return {
    overallAttempts,
    overallCorrect,
    accuracy: overallAttempts ? overallCorrect / overallAttempts : null,
    recentTopicsSet: new Set(Object.keys(byTopic)),
    byTopic,
  };
}

// Compute weak topics (accuracy < 65%, or recently failed hard)
export async function getWeakTopicsForUser(userId, minAttempts = 2) {
  const stats = await getTopicStatsForUser(userId);
  const weak = [];
  const now = Date.now();

  for (const [topic, t] of Object.entries(stats.byTopic || {})) {
    if (t.attempts < minAttempts) continue;
    const accuracy = t.correct / t.attempts;
    if (accuracy < 0.65) {
      weak.push({
        topic,
        category: Array.from(t.categories)[0] || 'technical',
        accuracy: Math.round(accuracy * 100),
        attempts: t.attempts,
        lastSeen: t.lastSeen,
      });
    }
    // Recently failed topics (within ~3 days) flagged even if accuracy trending up
    if (t.lastSeen && (now - new Date(t.lastSeen).getTime()) < 3 * 86400000 && accuracy < 0.8) {
      if (!weak.find((w) => w.topic === topic)) {
        weak.push({
          topic,
          category: Array.from(t.categories)[0] || 'technical',
          accuracy: Math.round(accuracy * 100),
          attempts: t.attempts,
          lastSeen: t.lastSeen,
        });
      }
    }
  }

  weak.sort((a, b) => a.accuracy - b.accuracy);
  return weak;
}

// Simple spaced-revision scheduler: decide how soon a topic should return based on performance
export function nextReviewInDays(accuracy, attempts) {
  if (attempts === 0) return 1;
  if (accuracy >= 0.9 && attempts >= 4) return HARD_INTERVAL_DAYS;
  if (accuracy >= 0.75) return MEDIUM_INTERVAL_DAYS;
  return EASY_INTERVAL_DAYS;
}

// Which topics are due for revision today?
export async function getTopicsDueForRevision(userId) {
  const stats = await getTopicStatsForUser(userId);
  const due = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const [topic, t] of Object.entries(stats.byTopic || {})) {
    if (!t.lastSeen) continue;
    const accuracy = t.attempts ? t.correct / t.attempts : 0;
    const interval = nextReviewInDays(accuracy, t.attempts);
    const dueDate = new Date(t.lastSeen);
    dueDate.setDate(dueDate.getDate() + interval);
    if (dueDate <= today) {
      due.push({
        topic,
        category: Array.from(t.categories)[0] || 'technical',
        accuracy: Math.round(accuracy * 100),
        attempts: t.attempts,
        dueInDays: 0,
      });
    }
  }
  return due;
}

// Update/refresh the stored WeakTopic table (used to power UI panels)
export async function refreshWeakTopics(userId) {
  const weak = await getWeakTopicsForUser(userId, 2);
  const existing = await prisma.weakTopic.findMany({ where: { userId } });

  const seen = new Set();
  for (const w of weak) {
    seen.add(`${w.category}::${w.topic}`);
    const rec = existing.find((e) => e.category === w.category && e.topic === w.topic);
    if (rec) {
      await prisma.weakTopic.update({
        where: { id: rec.id },
        data: { accuracy: w.accuracy, attempts: w.attempts, lastSeen: new Date() },
      });
    } else {
      await prisma.weakTopic.create({
        data: { userId, category: w.category, topic: w.topic, accuracy: w.accuracy, attempts: w.attempts },
      });
    }
  }
  // Remove ones no longer weak (they've improved)
  for (const rec of existing) {
    if (!seen.has(`${rec.category}::${rec.topic}`)) {
      await prisma.weakTopic.delete({ where: { id: rec.id } }).catch(() => {});
    }
  }
  return weak;
}

// Overall readiness score with weights: Technical 30, Aptitude 20, Communication 20, Interview 20, Consistency 10
export async function computeReadinessScore(userId) {
  const attempts = await prisma.questionAttempt.findMany({ where: { userId } });

  const counts = {
    technical: { correct: 0, total: 0 },
    aptitude: { correct: 0, total: 0 },
    english: { correct: 0, total: 0 },
  };
  for (const a of attempts) {
    if (!counts[a.category]) counts[a.category] = { correct: 0, total: 0 };
    counts[a.category].total += 1;
    if (a.isCorrect) counts[a.category].correct += 1;
  }

  const speakingAttempts = await prisma.speakingAttempt.findMany({
    where: { session: { userId } },
    select: { overall: true },
  });
  let speakingScore = 0;
  if (speakingAttempts.length) {
    speakingScore = speakingAttempts.reduce((s, x) => s + (x.overall || 0), 0) / speakingAttempts.length;
  }

  const interviews = await prisma.mockInterview.findMany({
    where: { userId, status: 'completed', score: { not: null } },
    select: { score: true },
  });
  let interviewScore = 0;
  if (interviews.length) {
    interviewScore = interviews.reduce((s, x) => s + x.score, 0) / interviews.length;
  }

  const pct = (c) => (c.total ? (c.correct / c.total) * 100 : 0);
  const technical = pct(counts.technical);
  const aptitude = pct(counts.aptitude);
  const english = pct(counts.english);

  // Consistency: how many of the last 7 days had activity
  const activity = await prisma.dailyProgress.findMany({ where: { userId }, select: { date: true } });
  const activeDays = new Set(activity.map((d) => new Date(d.date).toDateString()));
  const now = new Date();
  let active = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    if (activeDays.has(d.toDateString())) active += 1;
  }
  const consistency = (active / 7) * 100;

  // Communication = blend of English accuracy + speaking score (0-100)
  const communication = english * 0.5 + speakingScore;

  const score =
    technical * 0.3 +
    aptitude * 0.2 +
    communication * 0.2 +
    interviewScore * 0.2 +
    consistency * 0.1;

  const raw = Math.max(0, Math.min(100, score));
  const rounded = Math.round(raw);
  const dims = {
    technical: Math.round(technical),
    aptitude: Math.round(aptitude),
    english: Math.round(english),
    speaking: Math.round(speakingScore),
    interview: Math.round(interviewScore),
    consistency: Math.round(consistency),
  };
  return {
    score: rounded,
    level: rounded >= 85 ? 'Placement Ready' : rounded >= 70 ? 'Strong' : rounded >= 45 ? 'Developing' : rounded >= 20 ? 'Building' : 'Just Starting',
    dimensions: dims,
    breakdown: dims,
  };
}
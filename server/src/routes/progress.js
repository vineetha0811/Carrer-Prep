import { Router } from 'express';
import prisma from '../prisma.js';
import { authRequired } from '../middleware/auth.js';
import { computeReadinessScore, getWeakTopicsForUser, refreshWeakTopics } from '../services/weakness.js';
import { answerBuilderStructure } from '../services/speaking.js';

const router = Router();

// -------- Overall progress + readiness + weak areas --------
router.get('/', authRequired, async (req, res) => {
  try {
    const userId = req.userId;

    const [attempts, readiness, weak, sessions, interviews, gdSessions, profile, assignments] = await Promise.all([
      prisma.questionAttempt.findMany({ where: { userId }, orderBy: { evaluatedAt: 'asc' } }),
      computeReadinessScore(userId),
      refreshWeakTopics(userId),
      prisma.speakingAttempt.findMany({ where: { session: { userId } }, orderBy: { createdAt: 'asc' } }),
      prisma.mockInterview.findMany({ where: { userId, status: 'completed' }, orderBy: { startedAt: 'asc' } }),
      prisma.gdSession.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      prisma.profile.findUnique({ where: { userId } }),
      prisma.dailyAssignment.findMany({ where: { userId }, orderBy: { date: 'asc' } }),
    ]);

    // Weekly trends (last 7 days)
    const last7 = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      const dayAttempts = attempts.filter((a) => a.evaluatedAt >= d && a.evaluatedAt < next);
      const correct = dayAttempts.filter((a) => a.isCorrect).length;
      last7.push({
        date: d.toISOString().slice(0, 10),
        attempted: dayAttempts.length,
        accuracy: dayAttempts.length ? Math.round((correct / dayAttempts.length) * 100) : 0,
      });
    }

    const byCategory = { technical: { total: 0, correct: 0 }, aptitude: { total: 0, correct: 0 }, english: { total: 0, correct: 0 } };
    for (const a of attempts) {
      if (!byCategory[a.category]) byCategory[a.category] = { total: 0, correct: 0 };
      byCategory[a.category].total += 1;
      if (a.isCorrect) byCategory[a.category].correct += 1;
    }

    const speakingAvg = sessions.length ? sessions.reduce((s, x) => s + (x.overall || 0), 0) / sessions.length : 0;
    const interviewAvg = interviews.length ? interviews.reduce((s, x) => s + (x.score || 0), 0) / interviews.length : 0;

    // Streak
    const progressRows = await prisma.dailyProgress.findMany({ where: { userId }, select: { date: true } });
    const activeDays = new Set(progressRows.map((d) => new Date(d.date).toDateString()));
    let streak = 0;
    const cursor = new Date(); cursor.setHours(0, 0, 0, 0);
    while (activeDays.has(cursor.toDateString())) { streak += 1; cursor.setDate(cursor.getDate() - 1); }

    // Achievements
    const achievements = [
      { key: 'first_steps', label: 'First Steps', earned: attempts.length >= 10 },
      { key: 'questions_100', label: '100 Questions Completed', earned: attempts.length >= 100 },
      { key: 'speaking_week', label: 'Speaking Week Completed', earned: sessions.length >= 7 },
      { key: 'first_interview', label: 'First Mock Interview', earned: interviews.length >= 1 },
      { key: 'gd_started', label: 'Group Discussion Started', earned: gdSessions.length >= 1 },
      { key: 'week1_learner', label: '7-Day Learner', earned: streak >= 7 },
      { key: 'weekly_report', label: 'First Week Completed', earned: progressRows.length >= 7 },
    ];

    // week-by-week category averages for trend chart
    const weeklyAverages = await weeklyCategoryAverages(userId);

    res.json({
      readiness,
      weakAreas: weak.slice(0, 6).map((w) => ({ topic: w.topic, accuracy: w.accuracy, category: w.category })),
      totals: { attempted: attempts.length, correct: attempts.filter((a) => a.isCorrect).length },
      byCategory: Object.fromEntries(Object.entries(byCategory).map(([k, v]) => [k, {
        total: v.total, correct: v.correct, pct: v.total ? Math.round((v.correct / v.total) * 100) : 0,
      }])),
      speaking: { attempts: sessions.length, avg: Math.round(speakingAvg) },
      interviews: { count: interviews.length, avg: Math.round(interviewAvg) },
      gdCount: gdSessions.length,
      streak,
      weekly: last7,
      weeklyAverages,
      achievements,
      profile,
      assignmentsComplete: assignments.filter((a) => a.status === 'completed').length,
      totalAssignments: assignments.length,
    });
  } catch (err) {
    console.error('progress error', err);
    res.status(500).json({ error: 'Could not load progress.' });
  }
});

async function weeklyCategoryAverages(userId) {
  const attempts = await prisma.questionAttempt.findMany({
    where: { userId },
    orderBy: { evaluatedAt: 'asc' },
  });
  // group by ISO week number (simple: last 8 weeks buckets)
  const weeks = {};
  const now = new Date();
  for (let w = 7; w >= 0; w--) {
    const d = new Date(now);
    d.setDate(d.getDate() - (w * 7));
    const key = d.toISOString().slice(0, 10);
    weeks[key] = { technical: [], aptitude: [], english: [] };
  }
  const keys = Object.keys(weeks);
  for (const a of attempts) {
    const ds = a.evaluatedAt.toISOString().slice(0, 10);
    let target = keys[0];
    for (const k of keys) {
      const kd = new Date(k);
      const kd2 = new Date(k);
      kd2.setDate(kd2.getDate() + 7);
      if (a.evaluatedAt >= kd && a.evaluatedAt < kd2) { target = k; break; }
    }
    if (weeks[target] && weeks[target][a.category]) weeks[target][a.category].push(a.isCorrect ? 1 : 0);
  }
  return Object.keys(weeks).map((k) => ({
    weekStart: k,
    technical: avg(weeks[k].technical),
    aptitude: avg(weeks[k].aptitude),
    english: avg(weeks[k].english),
  }));
}

function avg(arr) {
  if (!arr.length) return 0;
  return Math.round((arr.reduce((s, x) => s + x, 0) / arr.length) * 100);
}

export default router;
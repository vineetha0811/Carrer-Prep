import prisma from '../prisma.js';
import { selectTechnicalQuestions, selectAptitudeQuestions, selectEnglishQuestions, hashString } from './questionService.js';
import { getWeakTopicsForUser, getTopicsDueForRevision } from './weakness.js';
import { TOPIC_SPEAKING_PROMPTS } from './speaking.js';
import { GD_TOPICS } from './gd.js';
import { getProfileSummary } from '../routes/helpers.js';

const DAILY_TIME_ALLOCATION = {
  20: { technical: 3, aptitude: 3, english: 2, speaking: 0, interview: 0 },
  30: { technical: 6, aptitude: 5, english: 3, speaking: 1, interview: 0 },
  40: { technical: 8, aptitude: 6, english: 4, speaking: 1, interview: 0 },
  60: { technical: 12, aptitude: 8, english: 6, speaking: 1, interview: 1 },
};

// Determine current "day number" for the student's program
export async function getCurrentDayNumber(userId) {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile?.startDate) return 1;
  const start = new Date(profile.startDate);
  start.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.max(0, Math.round((today - start) / 86400000));
  return diffDays + 1;
}

// Deterministic seed per user+day so today's assignment is stable across reloads
// yet differs for every user and changes tomorrow. `date` can be overridden so a
// past assignment can be rebuilt for preview using that day's own seed.
function buildDailySeed(userId, kind, date = new Date()) {
  const todayStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return hashString(`${userId}|${todayStr}|${kind}`);
}

// Top-level assignment generator (this is the personalization heart)
export async function generateDailyAssignment(userId, opts = {}) {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile || !profile.branch) {
    throw new Error('Complete your profile first');
  }

  const settings = await prisma.settings.findUnique({ where: { userId } });
  const dailyMinutes = opts.dailyMinutes || settings?.dailyMinutes || profile.dailyMinutes || 30;
  const alloc = DAILY_TIME_ALLOCATION[dailyMinutes] || DAILY_TIME_ALLOCATION[30];
  const branch = profile.branch;
  const quick = opts.quick;

  if (quick) {
    return buildAssignment(userId, {
      technical: 3, aptitude: 3, english: 2, speaking: 1, interview: 1, quick: true,
    }, branch, dailyMinutes, profile, null);
  }

  const allocation = {
    technical: opts.technical ?? alloc.technical,
    aptitude: opts.aptitude ?? alloc.aptitude,
    english: opts.english ?? alloc.english,
    speaking: opts.speaking ?? alloc.speaking,
    interview: opts.interview ?? alloc.interview,
  };

  const seed = buildDailySeed(userId, 'daily', opts.date ? new Date(opts.date) : new Date());
  return buildAssignment(userId, allocation, branch, dailyMinutes, profile, seed);
}

async function buildAssignment(userId, allocation, branch, dailyMinutes, profile, seed) {
  const weakTopics = await getWeakTopicsForUser(userId, 1);
  const syllabusTopics = await getProfileSubjectTopics(userId);

  const technical = await selectTechnicalQuestions({
    userId, branch, count: allocation.technical,
    weakTopics, syllabusTopics, seed,
  });

  const aptitude = await selectAptitudeQuestions({ userId, count: allocation.aptitude, seed });
  const english = await selectEnglishQuestions({ userId, count: allocation.english, seed });

  const dayNumber = await getCurrentDayNumber(userId);

  // Speaking + interview components (not always present)
  const speakingChallenge = allocation.speaking > 0
    ? { topic: pickSpeakingTopic(userId, dayNumber), durationSec: 60, kind: 'topic' }
    : null;

  const sections = [];
  sections.push({
    key: 'technical',
    label: 'Technical Challenge',
    icon: 'bolt',
    minutes: Math.round(allocation.technical * 1.5),
    count: technical.length,
    questions: technical.map(serializeQuestion),
  });
  if (aptitude.length) {
    sections.push({
      key: 'aptitude',
      label: 'Aptitude & Reasoning',
      icon: 'brain',
      minutes: Math.round(allocation.aptitude * 1.3),
      count: aptitude.length,
      questions: aptitude.map(serializeQuestion),
    });
  }
  if (english.length) {
    sections.push({
      key: 'english',
      label: 'English / Grammar',
      icon: 'book',
      minutes: Math.round(allocation.english * 0.8),
      count: english.length,
      questions: english.map(serializeQuestion),
    });
  }
  if (speakingChallenge) {
    sections.push({
      key: 'speaking',
      label: 'Speaking Practice',
      icon: 'mic',
      minutes: 7,
      count: 1,
      speakingChallenge,
    });
  }
  if (allocation.interview > 0) {
    sections.push({
      key: 'interview',
      label: 'Mini Interview',
      icon: 'chat',
      minutes: 10,
      count: 1,
      interview: { type: 'general', stage: 'intro' },
    });
  }

  const estimatedMinutes = sections.reduce((s, x) => s + x.minutes, 0);

  return {
    dayNumber,
    date: new Date().toISOString(),
    estimatedMinutes,
    sections,
    weakAreas: weakTopics.slice(0, 4).map((w) => ({ topic: w.topic, accuracy: w.accuracy })),
    planInfo: profile?.planLengthDays ? `${profile.planLengthDays}-day plan` : null,
  };
}

function pickSpeakingTopic(userId, dayNumber) {
  // Per-user rotation: every user gets their own topics on their own schedule.
  const idx = hashString(`${userId}|day${dayNumber}`) % TOPIC_SPEAKING_PROMPTS.length;
  return TOPIC_SPEAKING_PROMPTS[idx];
}

// gather topics that exist in the student's uploaded syllabus (as sources of questions)
async function getProfileSubjectTopics(userId) {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) return [];
  const structures = await prisma.subjectStructure.findMany({
    where: { profileId: profile.id, source: 'uploaded' },
  });
  const topics = [];
  for (const s of structures) {
    try {
      const units = JSON.parse(s.subjectUnits || '[]');
      for (const u of units) {
        for (const t of u.topics || []) {
          topics.push(typeof t === 'string' ? t : t.name);
        }
      }
    } catch (e) { /* skip */ }
  }
  return topics;
}

function serializeQuestion(q) {
  return {
    _localKey: q.id || `${q.branch}-${q.topic}-${q.text.slice(0, 40)}`,
    subject: q.subject,
    topic: q.topic,
    difficulty: q.difficulty,
    qtype: q.qtype,
    text: q.text,
    options: q.options || [],
    source: q.source,
    isPractical: q.isPractical || false,
    // hide correct answer from the client during the quiz
  };
}

// Persist an assignment as a DailyAssignment row. The FULL sections (including
// the questions asked) are stored so the user can preview today's and past
// assignments later; speaking/interview metadata is kept as well.
export async function saveAssignment(userId, assignment) {
  const date = new Date(assignment.date);
  date.setHours(0, 0, 0, 0);
  const existing = await prisma.dailyAssignment.findUnique({
    where: { userId_date: { userId, date } },
  });
  const data = {
    userId,
    dayNumber: assignment.dayNumber,
    date,
    sections: JSON.stringify(assignment.sections || []),
    estimatedMinutes: assignment.estimatedMinutes,
    status: 'pending',
  };
  if (existing) {
    return prisma.dailyAssignment.update({ where: { id: existing.id }, data: { ...data } });
  }
  return prisma.dailyAssignment.create({ data });
}
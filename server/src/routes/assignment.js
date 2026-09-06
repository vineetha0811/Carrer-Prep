import { Router } from 'express';
import prisma from '../prisma.js';
import { authRequired } from '../middleware/auth.js';
import { generateDailyAssignment, saveAssignment, getCurrentDayNumber } from '../services/assignment.js';
import { computeReadinessScore } from '../services/weakness.js';
import { buildBaselineAssessment } from '../services/questionService.js';

const router = Router();

// Generated baseline questions per user (catches the questions actually asked so
// the submission can be graded honestly and a review returned afterwards).
export const baselineStore = new Map();

// Keep the quiz cheat-free: answer fields are never sent to the client while
// the baseline is in progress. They are graded server-side at submission.
function safeBaseline(baseline) {
  const clean = (list) => (list || []).map(({ correctAnswer, explanation, misconception, interviewTakeaway, memoryTip, relatedConcept, branch, ...q }) => q);
  return { technical: clean(baseline.technical), aptitude: clean(baseline.aptitude), english: clean(baseline.english) };
}

export function flattenBaseline(baseline) {
  return [...(baseline.technical || []), ...(baseline.aptitude || []), ...(baseline.english || [])];
}

// -------- Get today's assignment (generates if none exists) --------
router.get('/today', authRequired, async (req, res) => {
  try {
    const userId = req.userId;
    // Today's date key
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);

    const existing = await prisma.dailyAssignment.findUnique({
      where: { userId_date: { userId, date: start } },
    });

    if (existing && existing.sections) {
      // Load questions from the stored sections (the section rows contain the questions when freshly built; persisted rows store only metadata)
      const assignment = await getAssignmentPayload(userId, start);
      return res.json({ assignment });
    }

    const assignment = await generateDailyAssignment(userId);
    await saveAssignment(userId, assignment);
    const payload = await getAssignmentPayload(userId, start);
    res.json({ assignment: payload });
  } catch (err) {
    console.error('assignment today error', err);
    res.status(500).json({ error: err.message || 'Could not generate assignment.' });
  }
});

// -------- Quick practice (10 min mini session) --------
router.post('/quick', authRequired, async (req, res) => {
  try {
    const userId = req.userId;
    const assignment = await generateDailyAssignment(userId, { quick: true });
    res.json({ assignment });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Could not create quick practice.' });
  }
});

// -------- Baseline assessment questions --------
router.post('/baseline', authRequired, async (req, res) => {
  try {
    const profile = await prisma.profile.findUnique({ where: { userId: req.userId } });
    if (!profile?.branch) return res.status(400).json({ error: 'Pick your branch first.' });
    const baseline = await buildBaselineAssessment(profile.branch, req.userId);
    baselineStore.set(req.userId, baseline);
    res.json({ baseline: safeBaseline(baseline) });
  } catch (err) {
    console.error('baseline gen error', err);
    res.status(500).json({ error: 'Could not build baseline.' });
  }
});

// -------- GET assignment status/readiness --------
router.get('/status', authRequired, async (req, res) => {
  try {
    const userId = req.userId;
    const dayNumber = await getCurrentDayNumber(userId);
    const readiness = await computeReadinessScore(userId);

    // today's progress
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const progress = await prisma.dailyProgress.findUnique({
      where: { userId_date: { userId, date: start } },
    });

    // streak
    const streak = await computeStreak(userId);

    res.json({ dayNumber, readiness, progress, streak });
  } catch (err) {
    res.status(500).json({ error: 'Could not load status.' });
  }
});

async function computeStreak(userId) {
  const rows = await prisma.dailyProgress.findMany({
    where: { userId },
    select: { date: true },
    orderBy: { date: 'desc' },
    take: 90,
  });
  const days = new Set(rows.map((r) => new Date(r.date).toDateString()));
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  while (days.has(cursor.toDateString())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// Build the full payload for an assignment row (with live questions since rows store only metadata)
async function getAssignmentPayload(userId, date) {
  const row = await prisma.dailyAssignment.findUnique({
    where: { userId_date: { userId, date } },
  });
  if (!row) return null;

  if (row.sections.includes('"questions"')) {
    // Sections were persisted with full questions (fresh build path)
    try {
      const sections = JSON.parse(row.sections);
      return { ...row, sections };
    } catch (e) { /* ignore */ }
  }
  // Else regenerate a fresh assignment payload (questions are ephemeral by design)
  const fresh = await generateDailyAssignment(userId);
  return fresh;
}

// -------- Past assignments: list (for preview) --------
router.get('/history', authRequired, async (req, res) => {
  try {
    const rows = await prisma.dailyAssignment.findMany({
      where: { userId: req.userId },
      orderBy: { date: 'desc' },
    });
    const list = rows.map((row) => {
      let meta = [];
      try { meta = JSON.parse(row.sections || '[]'); } catch (e) { /* ignore */ }
      return {
        id: row.id,
        dayNumber: row.dayNumber,
        date: row.date,
        estimatedMinutes: row.estimatedMinutes,
        status: row.status,
        sections: meta.map((s) => ({ key: s.key, label: s.label, count: s.count ?? s.questions?.length ?? 0 })),
      };
    });
    res.json({ assignments: list });
  } catch (err) {
    console.error('history error', err);
    res.status(500).json({ error: 'Could not load past assignments.' });
  }
});

// -------- Preview a specific past assignment --------
router.get('/history/:id', authRequired, async (req, res) => {
  try {
    const row = await prisma.dailyAssignment.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!row) return res.status(404).json({ error: 'Assignment not found.' });

    // Exact preview when the questions were stored with the row
    if (row.sections.includes('"questions"')) {
      try {
        const sections = JSON.parse(row.sections);
        return res.json({ assignment: { dayNumber: row.dayNumber, date: row.date, estimatedMinutes: row.estimatedMinutes, sections } });
      } catch (e) { /* fall through to regeneration */ }
    }

    // Legacy row: rebuild the day's set deterministically from its own date seed
    const payload = await generateDailyAssignment(req.userId, { date: row.date });
    payload.dayNumber = row.dayNumber;
    payload.date = row.date.toISOString();
    res.json({ assignment: payload });
  } catch (err) {
    console.error('history preview error', err);
    res.status(500).json({ error: 'Could not preview this assignment.' });
  }
});

export default router;
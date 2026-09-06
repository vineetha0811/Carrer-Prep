import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import prisma from '../prisma.js';
import { authRequired } from '../middleware/auth.js';
import { getProfileSummary } from './helpers.js';
import { createStudyPlan } from '../services/studyplan.js';
import { getUploadsDir } from '../services/syllabus.js';
import { makeQuestionKey } from '../services/questionService.js';
import { baselineStore, flattenBaseline } from './assignment.js';

const router = Router();

// Profile photo upload
const photoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(getUploadsDir(), 'photos');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    cb(null, `photo_${req.userId}${ext}`);
  },
});
const uploadPhoto = multer({ storage: photoStorage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  const ok = /image\/(jpeg|png|webp|gif)/.test(file.mimetype);
  cb(ok ? null : new Error('Only images are allowed'), ok);
} });

// -------- Upsert profile (onboarding) --------
function normalizeBaseline(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/^\s*[A-Da-d]\s*[.):]\s*/, '')
    .replace(/[.。]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Authoritative grading used when the baseline is submitted. Option types are
// matched exactly, blanks/numerical loosely, and open-ended answers are never
// graded as correct or incorrect (they are recorded as self-assessed).
function baselineGrade(q, answer) {
  const given = String(answer || '').trim();
  const multi = q.qtype === 'multi';
  const typed = q.qtype === 'fillblank' || q.qtype === 'numerical';
  const options = Array.isArray(q.options) ? q.options : [];

  if (!given || given === 'SKIPPED') return { isCorrect: false, correctness: 'skip', score: 0 };

  if (options.length && !multi) {
    const correct = normalizeBaseline(given) === normalizeBaseline(q.correctAnswer);
    return { isCorrect: correct, correctness: correct ? 'correct' : 'incorrect', score: correct ? 60 : 20 };
  }
  if (multi) {
    const right = String(q.correctAnswer).split(/[,;]/).map(normalizeBaseline).filter(Boolean).sort().join('|');
    const got = given.split(/[,;]/).map(normalizeBaseline).filter(Boolean).sort().join('|');
    const correct = right === got;
    return { isCorrect: correct, correctness: correct ? 'correct' : 'incorrect', score: correct ? 60 : 20 };
  }
  if (typed) {
    const goal = normalizeBaseline(q.correctAnswer);
    const val = normalizeBaseline(given);
    const correct = val.length > 0 && (val === goal || val.includes(goal) || goal.includes(val));
    return { isCorrect: correct, correctness: correct ? 'correct' : 'incorrect', score: correct ? 60 : 20 };
  }
  // Open-ended (short / scenario / assertion)
  return { isCorrect: false, correctness: 'self', score: 10 };
}
router.patch('/profile', authRequired, async (req, res) => {
  try {
    const userId = req.userId;
    const b = req.body || {};
    const existing = await prisma.profile.findUnique({ where: { userId } });

    const data = {
      college: b.college ?? existing?.college,
      location: b.location ?? existing?.location,
      graduationYear: b.graduationYear != null ? b.graduationYear : existing?.graduationYear,
      branch: b.branch ?? existing?.branch,
      semester: b.semester != null ? b.semester : existing?.semester,
      cgpa: b.cgpa != null ? b.cgpa : existing?.cgpa,
      backlogs: b.backlogs != null ? b.backlogs : existing?.backlogs,
      preferredJob: b.preferredJob ?? existing?.preferredJob,
      goals: b.goals ? JSON.stringify(b.goals) : existing?.goals,
      confidence: b.confidence ? JSON.stringify(b.confidence) : existing?.confidence,
      planLengthDays: b.planLengthDays ?? existing?.planLengthDays,
      dailyMinutes: b.dailyMinutes ?? existing?.dailyMinutes ?? 30,
    };

    if (b.onboardingDone) data.onboardingDone = true;
    if (b.startDate && !existing?.startDate) data.startDate = new Date(b.startDate);
    if (b.baselineTaken) data.baselineTaken = true;

    let profile;
    if (existing) {
      profile = await prisma.profile.update({ where: { userId }, data });
    } else {
      profile = await prisma.profile.create({
        data: {
          userId, ...data,
          onboardingDone: data.onboardingDone || false,
        },
      });
    }

    // name update
    if (b.name) {
      await prisma.user.update({ where: { id: userId }, data: { name: b.name.trim() } });
    }

    // auto-create study plan once onboarding completes
    if (data.planLengthDays && data.planLengthDays >= 0) {
      const goals = JSON.parse(data.goals || '[]');
      const roadmap = createStudyPlan(userId, {
        planDays: data.planLengthDays,
        goals,
        branch: data.branch,
      });
      const existingPlan = await prisma.studyPlan.findFirst({ where: { userId } });
      if (!existingPlan) {
        await prisma.studyPlan.create({
          data: { userId, lengthDays: data.planLengthDays, roadmap: JSON.stringify((await roadmap).roadmap) },
        });
      }
    }

    res.json({ user: await getProfileSummary(userId) });
  } catch (err) {
    console.error('profile patch error', err);
    res.status(500).json({ error: 'Could not save profile.' });
  }
});

// -------- Photo upload --------
router.post('/profile/photo', authRequired, uploadPhoto.single('photo'), async (req, res) => {
  try {
    const userId = req.userId;
    const existing = await prisma.profile.findUnique({ where: { userId } });
    const storedPath = req.file?.path || null;
    if (!storedPath) return res.status(400).json({ error: 'No file received.' });

    const data = { profilePhoto: storedPath };
    if (existing) await prisma.profile.update({ where: { userId }, data });
    else await prisma.profile.create({ data: { userId, ...data } });

    res.json({ photoPath: storedPath, user: await getProfileSummary(userId) });
  } catch (err) {
    console.error('photo error', err);
    res.status(500).json({ error: 'Could not upload photo.' });
  }
});

// -------- Baseline assessment submission --------
router.post('/profile/baseline', authRequired, async (req, res) => {
  try {
    const userId = req.userId;
    const { results } = req.body || {};

    // Grade against the questions that were actually asked (kept server-side).
    const stored = baselineStore.get(userId);
    if (!stored) return res.status(400).json({ error: 'Baseline has expired. Restart it from onboarding.' });
    const asked = flattenBaseline(stored);
    const askedByText = new Map(asked.map((q) => [String(q.text).trim(), q]));

    const gradeAndStore = [];
    const review = [];
    (Array.isArray(results) ? results : []).forEach((r, i) => {
      const q = askedByText.get(String(r.text || '').trim()) || asked[i];
      const answer = r.userAnswer || '';
      let verdict = { isCorrect: Boolean(r.isCorrect), correctness: r.correctness || 'incorrect', score: Number(r.score) || 0 };
      if (r.correctness === 'skip') {
        verdict = { isCorrect: false, correctness: 'skip', score: 0 };
      } else if (q) {
        verdict = baselineGrade(q, answer);
      } else {
        verdict = { isCorrect: false, correctness: 'self', score: 10 };
      }

      review.push({
        text: q ? q.text : r.text || '',
        qtype: q ? q.qtype : null,
        difficulty: q ? q.difficulty : r.difficulty,
        topic: q ? q.topic : r.topic,
        userAnswer: answer || '(skipped)',
        correctAnswer: q ? (String(q.correctAnswer || '').trim() || null) : null,
        explanation: q ? (q.explanation || '') : '',
        isCorrect: verdict.isCorrect,
        correctness: verdict.correctness,
        score: verdict.score,
      });

      gradeAndStore.push({
        userId,
        category: r.category || (q && q.category) || 'technical',
        subject: r.subject || (q && q.subject) || null,
        topic: r.topic || (q && q.topic) || 'general',
        difficulty: q ? q.difficulty : r.difficulty || 2,
        questionKey: (q || r) ? makeQuestionKey(q || r) : null,
        userAnswer: answer || null,
        correctness: verdict.correctness,
        score: verdict.score,
        isCorrect: verdict.isCorrect,
      });
    });

    if (gradeAndStore.length) {
      await prisma.questionAttempt.createMany({ data: gradeAndStore });
    }

    await prisma.profile.update({
      where: { userId },
      data: { baselineTaken: true, onboardingDone: true, startDate: new Date() },
    });

    baselineStore.delete(userId);
    res.json({ ok: true, user: await getProfileSummary(userId), review });
  } catch (err) {
    console.error('baseline error', err);
    res.status(500).json({ error: 'Could not save baseline.' });
  }
});

// -------- Study plan / roadmap --------
router.post('/study-plan', authRequired, async (req, res) => {
  try {
    const userId = req.userId;
    const { planDays } = req.body || {};
    const profile = await prisma.profile.findUnique({ where: { userId } });
    if (!profile) return res.status(400).json({ error: 'Profile missing.' });

    const roadmap = createStudyPlan(userId, {
      planDays: planDays || profile.planLengthDays || 30,
      goals: JSON.parse(profile.goals || '[]'),
      branch: profile.branch,
    });

    const existing = await prisma.studyPlan.findFirst({ where: { userId } });
    let plan;
    if (existing) {
      plan = await prisma.studyPlan.update({
        where: { id: existing.id },
        data: { lengthDays: planDays || existing.lengthDays, roadmap: JSON.stringify((await roadmap).roadmap) },
      });
    } else {
      plan = await prisma.studyPlan.create({
        data: { userId, lengthDays: planDays || 30, roadmap: JSON.stringify((await roadmap).roadmap) },
      });
    }

    await prisma.profile.update({
      where: { userId },
      data: { planLengthDays: planDays || profile.planLengthDays || 30, startDate: new Date() },
    });

    res.json({ roadmap: JSON.parse(plan.roadmap), planDays: plan.lengthDays });
  } catch (err) {
    console.error('study plan error', err);
    res.status(500).json({ error: 'Could not create study plan.' });
  }
});

export default router;
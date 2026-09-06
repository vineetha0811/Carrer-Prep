import { Router } from 'express';
import prisma from '../prisma.js';
import { authRequired } from '../middleware/auth.js';
import { evaluateSpeaking, TOPIC_SPEAKING_PROMPTS, answerBuilderStructure, SPEAKING_TOPIC_OPTIONS } from '../services/speaking.js';

const router = Router();

// -------- Get speaking topics / templates --------
router.get('/topics', authRequired, (req, res) => {
  res.json({
    topics: TOPIC_SPEAKING_PROMPTS,
    durations: SPEAKING_TOPIC_OPTIONS,
    builder: answerBuilderStructure(),
  });
});

// -------- Create / get a speaking session --------
router.post('/session', authRequired, async (req, res) => {
  try {
    const { topic, durationSec, kind = 'topic' } = req.body || {};
    const session = await prisma.speakingSession.create({
      data: { userId: req.userId, topic: topic || TOPIC_SPEAKING_PROMPTS[0], durationSec: durationSec || 60, kind },
    });
    res.status(201).json({ session });
  } catch (err) {
    res.status(500).json({ error: 'Could not create session.' });
  }
});

// -------- Submit a speaking attempt & evaluate --------
router.post('/attempt', authRequired, async (req, res) => {
  try {
    const { sessionId, transcript, durationSec } = req.body || {};
    if (!sessionId || !transcript) {
      return res.status(400).json({ error: 'Session and speech transcript are required.' });
    }
    const session = await prisma.speakingSession.findFirst({
      where: { id: sessionId, userId: req.userId },
    });
    if (!session) return res.status(404).json({ error: 'Session not found.' });

    const attemptNo = await prisma.speakingAttempt.count({ where: { sessionId } });
    const evaluation = await evaluateSpeaking(transcript, session.topic, durationSec || session.durationSec || 60);

    const attempt = await prisma.speakingAttempt.create({
      data: {
        sessionId,
        attemptNo: attemptNo + 1,
        transcript,
        evaluation: JSON.stringify(evaluation),
        fluency: evaluation.fluency,
        structure: evaluation.structure,
        gramScore: evaluation.grammarScore,
        vocabScore: evaluation.vocabulary,
        contentScore: evaluation.content,
        overall: evaluation.overall,
      },
    });

    // update daily progress (speaking done)
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const existing = await prisma.dailyProgress.findUnique({
      where: { userId_date: { userId: req.userId, date: now } },
    });
    if (existing) {
      await prisma.dailyProgress.update({ where: { id: existing.id }, data: { speakingDone: true } });
    } else {
      await prisma.dailyProgress.create({ data: { userId: req.userId, date: now, speakingDone: true } });
    }

    res.json({ attempt, evaluation });
  } catch (err) {
    console.error('speaking attempt error', err);
    res.status(500).json({ error: 'Could not evaluate speech.' });
  }
});

// -------- History of speaking sessions + attempts --------
router.get('/history', authRequired, async (req, res) => {
  try {
    const sessions = await prisma.speakingSession.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { attempts: { orderBy: { attemptNo: 'asc' } } },
    });
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: 'Could not load history.' });
  }
});

// Compare two attempts of the same session (attempt1 vs attempt2)
router.get('/compare/:sessionId', authRequired, async (req, res) => {
  try {
    const attempts = await prisma.speakingAttempt.findMany({
      where: { sessionId: req.params.sessionId, session: { userId: req.userId } },
      orderBy: { attemptNo: 'asc' },
    });
    const pairs = attempts.map((a) => ({ attemptNo: a.attemptNo, overall: a.overall, fluency: a.fluency, structure: a.structure, transcript: a.transcript }));
    res.json({ pairs });
  } catch (err) {
    res.status(500).json({ error: 'Could not compare.' });
  }
});

export default router;
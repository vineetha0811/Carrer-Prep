import { Router } from 'express';
import prisma from '../prisma.js';
import { authRequired } from '../middleware/auth.js';
import { GD_TOPICS, openGDSession, advanceGD, summarizeGD } from '../services/gd.js';
import { hashString } from '../services/questionService.js';

const router = Router();

// -------- Topics list --------
router.get('/topics', authRequired, (req, res) => {
  res.json({ topics: GD_TOPICS });
});

// -------- Start a GD/debate session --------
router.post('/start', authRequired, async (req, res) => {
  try {
    const { topic, kind = 'gd', side = null } = req.body || {};
    const now = new Date();
    const dayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const t = topic || GD_TOPICS[hashString(`${req.userId}|${dayKey}|gd`) % GD_TOPICS.length];

    const session = await prisma.gdSession.create({
      data: { userId: req.userId, topic: t, kind, side },
    });

    const openingMessages = await openGDSession(t, kind, side);
    for (const m of openingMessages) {
      await prisma.gdMessage.create({
        data: { sessionId: session.id, speaker: m.speaker, content: m.text },
      });
    }

    const messages = await prisma.gdMessage.findMany({ where: { sessionId: session.id }, orderBy: { createdAt: 'asc' } });
    res.status(201).json({ session: { id: session.id, topic: t, kind, side }, messages });
  } catch (err) {
    console.error('gd start error', err);
    res.status(500).json({ error: 'Could not start session.' });
  }
});

// -------- Send student's spoken point, get AI participant response --------
router.post('/:id/contribute', authRequired, async (req, res) => {
  try {
    const session = await prisma.gdSession.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!session) return res.status(404).json({ error: 'Session not found.' });

    const { message } = req.body || {};
    if (!message) return res.status(400).json({ error: 'Message required.' });

    await prisma.gdMessage.create({
      data: { sessionId: session.id, speaker: 'student', content: message },
    });

    const history = await prisma.gdMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
      select: { speaker: true, content: true },
    });

    const turn = history.filter((h) => h.speaker !== 'student').length;
    const response = await advanceGD(session, message, history, turn);

    await prisma.gdMessage.create({
      data: { sessionId: session.id, speaker: response.speaker, content: response.text },
    });

    res.json({ turn, response });
  } catch (err) {
    console.error('gd contribute error', err);
    res.status(500).json({ error: 'Could not process your point.' });
  }
});

// -------- End & summarize --------
router.post('/:id/end', authRequired, async (req, res) => {
  try {
    const session = await prisma.gdSession.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!session) return res.status(404).json({ error: 'Session not found.' });

    const history = await prisma.gdMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' },
    });
    const summary = await summarizeGD(history, session.kind);

    await prisma.gdSession.update({
      where: { id: session.id },
      data: { status: 'completed', summary: JSON.stringify(summary) },
    });

    res.json({ summary });
  } catch (err) {
    res.status(500).json({ error: 'Could not end session.' });
  }
});

// -------- History --------
router.get('/history', authRequired, async (req, res) => {
  try {
    const sessions = await prisma.gdSession.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    res.json({ sessions });
  } catch (err) {
    res.status(500).json({ error: 'Could not load history.' });
  }
});

export default router;
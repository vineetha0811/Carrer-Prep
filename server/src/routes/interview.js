import { Router } from 'express';
import prisma from '../prisma.js';
import { authRequired } from '../middleware/auth.js';
import { openInterview, generateFollowUp, scoreInterview, evaluateInterviewAnswer } from '../services/interview.js';
import { hashString } from '../services/questionService.js';
import { getProfileSummary } from './helpers.js';

const router = Router();

// -------- Start an interview --------
router.post('/start', authRequired, async (req, res) => {
  try {
    const { type = 'general', pressure = false } = req.body || {};
    const userId = req.userId;
    const profile = await prisma.profile.findUnique({ where: { userId } });
    const resumes = await prisma.resume.findMany({ where: { userId } });
    const projects = await prisma.project.findMany({ where: { userId } });
    const resume = type === 'resume' && resumes.length ? resumes[resumes.length - 1] : null;

    const prepared = await openInterview({
      type,
      branch: profile?.branch || 'CSE',
      profile,
      resume,
      projects,
      pressure,
      seed: hashString(`${userId}:interview:${Date.now()}`),
    });

    const interview = await prisma.mockInterview.create({
      data: { userId, type, status: 'in_progress' },
    });

    // First AI message
    const firstStage = prepared.stages[0];
    const firstPrompt = resolvedPrompt(prepared, firstStage);
    await prisma.interviewMessage.create({
      data: { interviewId: interview.id, role: 'ai', content: firstPrompt },
    });

    res.status(201).json({
      interview: { id: interview.id, type, status: 'in_progress' },
      stages: prepared.stages,
      pressure,
    });
  } catch (err) {
    console.error('interview start error', err);
    res.status(500).json({ error: 'Could not start interview.' });
  }
});

function resolvedPrompt(prepared, stage) {
  const meta = prepared.questionsByStage?.[stage] || {};
  let prompt = meta.prompt || '';
  if (meta.question) prompt += ' ' + meta.question.text;
  if (meta.scenario) prompt += ' ' + meta.scenario;
  return prompt.trim();
}

// -------- Get next question / read latest AI message --------
router.post('/:id/next', authRequired, async (req, res) => {
  try {
    const interview = await prisma.mockInterview.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!interview) return res.status(404).json({ error: 'Interview not found.' });

    const messages = await prisma.interviewMessage.findMany({
      where: { interviewId: interview.id },
      orderBy: { createdAt: 'asc' },
    });

    const lastAI = [...messages].reverse().find((m) => m.role === 'ai');
    res.json({ message: lastAI, messages: messages.map(m => ({ role: m.role, content: m.content })) });
  } catch (err) {
    res.status(500).json({ error: 'Could not load interview.' });
  }
});

// -------- Submit a student's answer --------
router.post('/:id/reply', authRequired, async (req, res) => {
  try {
    const interview = await prisma.mockInterview.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!interview) return res.status(404).json({ error: 'Interview not found.' });

    const { answer, stage, questionMeta } = req.body || {};
    if (!answer) return res.status(400).json({ error: 'Answer required.' });

    // Evaluate the student answer
    const evaluation = await evaluateInterviewAnswer(stage || '', answer, questionMeta);

    await prisma.interviewMessage.create({
      data: {
        interviewId: interview.id,
        role: 'student',
        content: answer,
        evaluation: JSON.stringify(evaluation),
      },
    });

    // Determine the next AI question
    const history = await prisma.interviewMessage.findMany({
      where: { interviewId: interview.id },
      orderBy: { createdAt: 'asc' },
      select: { role: true, content: true },
    });

    const profile = await prisma.profile.findUnique({ where: { userId: req.userId } });
    const usedStages = await prisma.interviewMessage.count({ where: { interviewId: interview.id, role: 'ai' } });

    // Decide whether the interview should continue or close
    const isClosing = stage === 'closing' || usedStages >= 10;

    if (isClosing) {
      // End interview, compute score
      const interviewFull = await prisma.mockInterview.findUnique({
        where: { id: interview.id },
        include: { messages: true },
      });
      const scored = await scoreInterview(interviewFull);
      await prisma.mockInterview.update({
        where: { id: interview.id },
        data: { status: 'completed', score: scored.score },
      });
      return res.json({
        done: true,
        next: null,
        stage: null,
        score: scored.score,
        summary: 'Interview completed.',
      });
    }

    let nextPrompt;
    let nextStage = 'followup';

    // Follow-up engine based on the student's answer
    const followUp = await generateFollowUp(profile?.branch || 'CSE', stage, answer, history, questionMeta);
    nextPrompt = followUp.prompt;
    nextStage = followUp.stage;

    // Occasionally inject the interview's fixed progression to ensure coverage
    const stageFlow = ['intro', 'branch_reason', 'project', 'technical', 'followup', 'scenario', 'tricky', 'hr', 'behavioral', 'closing'];
    const aiCount = history.filter((m) => m.role === 'ai').length;
    const scheduleNext = stageFlow[aiCount] || 'closing';

    // After the first two rounds, start blending in scheduled stages so all
    // interview areas (technical/HR/behavioral) actually get covered.
    let effectiveStage = nextStage;
    let effectivePrompt = nextPrompt;
    if (aiCount > 1 && aiCount % 2 === 0 && scheduleNext && scheduleNext !== 'followup') {
      const prepared = await openInterview({ type: interview.type, branch: profile?.branch || 'CSE', seed: hashString(`${interview.userId}:interview:${Date.now()}`) });
      const scheduledMeta = prepared.questionsByStage?.[scheduleNext];
      if (scheduledMeta) {
        effectiveStage = scheduleNext;
        let p = scheduledMeta.prompt || '';
        if (scheduledMeta.question) p += ' ' + scheduledMeta.question.text;
        effectivePrompt = p.trim();
      }
    }

    await prisma.interviewMessage.create({
      data: { interviewId: interview.id, role: 'ai', content: effectivePrompt },
    });

    res.json({
      done: false,
      next: effectivePrompt,
      stage: effectiveStage,
      evaluation,
    });
  } catch (err) {
    console.error('interview reply error', err);
    res.status(500).json({ error: 'Could not process answer.' });
  }
});

// -------- End interview early --------
router.post('/:id/end', authRequired, async (req, res) => {
  try {
    const interview = await prisma.mockInterview.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!interview) return res.status(404).json({ error: 'Interview not found.' });

    const interviewFull = await prisma.mockInterview.findUnique({
      where: { id: interview.id },
      include: { messages: true },
    });
    const scored = await scoreInterview(interviewFull);
    await prisma.mockInterview.update({
      where: { id: interview.id },
      data: { status: 'completed', score: scored.score },
    });

    // update daily progress
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const existing = await prisma.dailyProgress.findUnique({
      where: { userId_date: { userId: req.userId, date: now } },
    });
    if (existing) await prisma.dailyProgress.update({ where: { id: existing.id }, data: { interviewDone: true } });
    else await prisma.dailyProgress.create({ data: { userId: req.userId, date: now, interviewDone: true } });

    res.json({ done: true, score: scored.score });
  } catch (err) {
    res.status(500).json({ error: 'Could not end interview.' });
  }
});

// -------- Interview history --------
router.get('/history', authRequired, async (req, res) => {
  try {
    const interviews = await prisma.mockInterview.findMany({
      where: { userId: req.userId },
      orderBy: { startedAt: 'desc' },
      take: 30,
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    res.json({ interviews });
  } catch (err) {
    res.status(500).json({ error: 'Could not load history.' });
  }
});

export default router;
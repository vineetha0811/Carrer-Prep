import { Router } from 'express';
import prisma from '../prisma.js';
import { authRequired } from '../middleware/auth.js';
import { evaluateObjectively, evaluateSubjective, buildLearnContent, optionExplanations, stripMCQPrefix } from '../services/evaluation.js';
import { resolveCanonicalQuestion } from '../services/questionResolver.js';
import { makeQuestionKey } from '../services/questionService.js';
import { refreshWeakTopics } from '../services/weakness.js';

const router = Router();

// -------- Submit a single answer for evaluation --------
router.post('/submit', authRequired, async (req, res) => {
  try {
    const userId = req.userId;
    const { question, userAnswer, category, skipEvaluation } = req.body || {};

    if (!question) return res.status(400).json({ error: 'Question missing.' });

    // Resolve to the canonical question (with the true answer + explanations)
    const resolved = resolveCanonicalQuestion(question);
    if (!resolved) return res.status(400).json({ error: 'Question data missing. Please refresh and try again.' });
    const q = { ...resolved, branch: question.branch || resolved.branch, source: question.source || resolved.source || 'builtin' };

    const answer = String(userAnswer || '').trim();

    // I DON'T KNOW → direct learn mode
    if (skipEvaluation) {
      const learn = await buildLearnContent(q);
      await prisma.questionAttempt.create({
        data: {
          userId,
          category: category || 'technical',
          subject: q.subject || null,
          topic: q.topic || 'general',
          difficulty: q.difficulty || 2,
          questionKey: makeQuestionKey(q),
          userAnswer: answer,
          correctness: 'dontknow',
          score: 0,
          isCorrect: false,
        },
      });
      await refreshWeakTopics(userId);
      return res.json({ mode: 'learn', learnContent: learn });
    }

    // Decide objective vs subjective
    const objective = evaluateObjectively(q, answer);

    let result;
    if (objective) {
      result = objective;
      // attach teaching blocks for feedback UI
      result.feedback = buildFeedbackForObjective(q, answer, objective);
    } else {
      result = await evaluateSubjective(q, answer);
      result.betterAnswer = result.betterAnswer || stripMCQPrefix(q.correctAnswer);
    }

    // persist attempt
    await prisma.questionAttempt.create({
      data: {
        userId,
        category: category || 'technical',
        subject: q.subject || null,
        topic: q.topic || 'general',
        difficulty: q.difficulty || 2,
        questionKey: makeQuestionKey(q),
        userAnswer: answer,
        correctness: result.correctness,
        score: result.score || 0,
        isCorrect: result.correctness === 'correct',
      },
    });

    await refreshWeakTopics(userId);

    const payload = {
      ...result,
      correctAnswer: stripMCQPrefix(q.correctAnswer),
      explanation: q.explanation,
      misconception: q.misconception,
      interviewTakeaway: q.interviewTakeaway,
      memoryTip: q.memoryTip,
      relatedConcept: q.relatedConcept,
      optionAnalysis: optionExplanations(q),
      question: {
        text: q.text,
        subject: q.subject,
        topic: q.topic,
        qtype: q.qtype,
        options: q.options,
        difficulty: q.difficulty,
        source: q.source,
        isPractical: q.isPractical,
      },
    };

    res.json({ result: payload });
  } catch (err) {
    console.error('submit error', err);
    res.status(500).json({ error: 'Could not evaluate answer.' });
  }
});

function buildFeedbackForObjective(question, answer, objective) {
  const correct = stripMCQPrefix(question.correctAnswer);
  const user = String(answer || '').trim();

  const base = objective.correctness === 'correct'
    ? 'Correct.'
    : objective.correctness === 'partial'
      ? 'Partially correct.'
      : 'Incorrect.';

  let extra = '';
  if (objective.correctness !== 'correct') {
    if (question.misconception) extra = ' ' + question.misconception;
    if (question.qtype === 'mcq' && user) extra += ` Your answer was "${user}". Read the explanation below carefully.`;
  }
  return base + extra;
}

// -------- Daily progress update --------
router.post('/progress', authRequired, async (req, res) => {
  try {
    const userId = req.userId;
    const { category, correct, total } = req.body || {};
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const existing = await prisma.dailyProgress.findUnique({
      where: { userId_date: { userId, date: now } },
    });

    const data = {};
    if (category === 'technical' || category === 'daily') { data.techCorrect = (existing?.techCorrect || 0) + (correct || 0); data.techTotal = (existing?.techTotal || 0) + (total || 0); if (category === 'daily') data.completed = true; }
    if (category === 'aptitude' || category === 'daily') { data.aptCorrect = (existing?.aptCorrect || 0) + (correct || 0); data.aptTotal = (existing?.aptTotal || 0) + (total || 0); if (category === 'daily') data.completed = true; }
    if (category === 'english' || category === 'daily') { data.engCorrect = (existing?.engCorrect || 0) + (correct || 0); data.engTotal = (existing?.engTotal || 0) + (total || 0); if (category === 'daily') data.completed = true; }
    if (category === 'speaking') data.speakingDone = true;
    if (category === 'interview') data.interviewDone = true;

    if (existing) {
      await prisma.dailyProgress.update({ where: { id: existing.id }, data });
    } else {
      await prisma.dailyProgress.create({ data: { userId, date: now, ...data } });
    }

    res.json({ ok: true, progress: await prisma.dailyProgress.findUnique({ where: { userId_date: { userId, date: now } } }) });
  } catch (err) {
    console.error('progress error', err);
    res.status(500).json({ error: 'Could not update progress.' });
  }
});

export default router;
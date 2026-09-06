import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../prisma.js';
import { authRequired } from '../middleware/auth.js';
import { getProfileSummary } from './helpers.js';
import { generateWeeklyReport } from '../services/studyplan.js';
import { getWeakTopicsForUser } from '../services/weakness.js';

const router = Router();

// -------- Get settings --------
router.get('/', authRequired, async (req, res) => {
  try {
    let settings = await prisma.settings.findUnique({ where: { userId: req.userId } });
    if (!settings) {
      settings = await prisma.settings.create({ data: { userId: req.userId } });
    }
    const achievements = await prisma.achievement.findMany({ where: { userId: req.userId }, orderBy: { earnedAt: 'desc' } });
    res.json({ settings, achievements });
  } catch (err) {
    res.status(500).json({ error: 'Could not load settings.' });
  }
});

// -------- Update settings --------
router.patch('/', authRequired, async (req, res) => {
  try {
    const b = req.body || {};
    const existing = await prisma.settings.findUnique({ where: { userId: req.userId } });
    const data = {
      dailyMinutes: b.dailyMinutes != null ? b.dailyMinutes : existing?.dailyMinutes ?? 30,
      notifications: b.notifications != null ? b.notifications : existing?.notifications ?? true,
      dailyTime: b.dailyTime || existing?.dailyTime || '30',
    };
    const settings = existing
      ? await prisma.settings.update({ where: { userId: req.userId }, data })
      : await prisma.settings.create({ data: { userId: req.userId, ...data } });
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: 'Could not save settings.' });
  }
});

// -------- Change password --------
router.post('/password', authRequired, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords are required.' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'New password must be at least 6 characters.' });

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    const ok = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect.' });

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: req.userId }, data: { passwordHash } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not change password.' });
  }
});

// -------- Delete account --------
router.delete('/account', authRequired, async (req, res) => {
  try {
    await prisma.user.delete({ where: { id: req.userId } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not delete account.' });
  }
});

// -------- Weekly report --------
router.get('/report/:week', authRequired, async (req, res) => {
  try {
    const week = parseInt(req.params.week, 10) || 1;
    const userId = req.userId;
    const profile = await prisma.profile.findUnique({ where: { userId } });
    const attempts = await prisma.questionAttempt.findMany({ where: { userId } });

    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - (week - 1) * 7 - 7);
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() - (week - 1) * 7);

    const weekAttempts = attempts.filter((a) => a.evaluatedAt >= weekStart && a.evaluatedAt < weekEnd);
    const cat = { technical: { total: 0, correct: 0 }, aptitude: { total: 0, correct: 0 }, english: { total: 0, correct: 0 } };
    for (const a of weekAttempts) {
      if (!cat[a.category]) cat[a.category] = { total: 0, correct: 0 };
      cat[a.category].total += 1;
      if (a.isCorrect) cat[a.category].correct += 1;
    }

    const speaking = await prisma.speakingAttempt.findMany({ where: { session: { userId }, createdAt: { gte: weekStart, lt: weekEnd } } });
    const interviews = await prisma.mockInterview.findMany({ where: { userId, status: 'completed', startedAt: { gte: weekStart, lt: weekEnd } } });

    const weak = await getWeakTopicsForUser(userId);
    const prevWeekAttempts = attempts.filter((a) => a.evaluatedAt >= new Date(weekStart.getTime() - 7 * 86400000) && a.evaluatedAt < weekStart);

    const pct = (c) => c.total ? Math.round((c.correct / c.total) * 100) : 0;
    const techPct = pct(cat.technical);
    const aptPct = pct(cat.aptitude);
    const engPct = pct(cat.english);
    const speakingAvg = speaking.length ? Math.round(speaking.reduce((s, x) => s + (x.overall || 0), 0) / speaking.length) : 0;
    const interviewAvg = interviews.length ? Math.round(interviews.reduce((s, x) => s + (x.score || 0), 0) / interviews.length) : 0;

    const prevTech = pct({ total: prevWeekAttempts.filter((a) => a.category === 'technical').length, correct: prevWeekAttempts.filter((a) => a.category === 'technical' && a.isCorrect).length });
    const prevApt = pct({ total: prevWeekAttempts.filter((a) => a.category === 'aptitude').length, correct: prevWeekAttempts.filter((a) => a.category === 'aptitude' && a.isCorrect).length });

    const thousands = () => {};
    res.json({
      week,
      technical: techPct,
      aptitude: aptPct,
      english: engPct,
      speaking: speakingAvg,
      interview: interviewAvg,
      improvement: {
        technical: techPct - prevTech,
        aptitude: aptPct - prevApt,
      },
      biggestWeakness: weak[0]?.topic || 'None detected yet - keep practising.',
      nextWeekFocus: [
        ...(weak.slice(0, 2).map(w => w.topic)),
        'Speaking practice',
        'Reasoning',
      ].filter(Boolean),
      totals: {
        attempted: weekAttempts.length,
        speakingAttempts: speaking.length,
        interviews: interviews.length,
      },
    });
  } catch (err) {
    console.error('report error', err);
    res.status(500).json({ error: 'Could not generate report.' });
  }
});

export default router;
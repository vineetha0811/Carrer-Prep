import { Router } from 'express';
import bcrypt from 'bcryptjs';
import prisma from '../prisma.js';
import { signToken, authRequired } from '../middleware/auth.js';
import { getProfileSummary } from './helpers.js';

const router = Router();

function validateEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || '');
}

// -------- SIGNUP --------
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required.' });
    }
    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Please enter a valid email address.' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters.' });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase(),
        passwordHash,
        settings: { create: {} },
      },
    });

    const token = signToken(user.id);
    res.status(201).json({ token, user: await getProfileSummary(user.id) });
  } catch (err) {
    console.error('signup error', err);
    res.status(500).json({ error: 'Could not create account. Please try again.' });
  }
});

// -------- LOGIN --------
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    const token = signToken(user.id);
    res.json({ token, user: await getProfileSummary(user.id) });
  } catch (err) {
    console.error('login error', err);
    res.status(500).json({ error: 'Could not log in. Please try again.' });
  }
});

// -------- ME --------
router.get('/me', authRequired, async (req, res) => {
  try {
    const summary = await getProfileSummary(req.userId);
    if (!summary) return res.status(404).json({ error: 'User not found.' });
    res.json({ user: summary });
  } catch (err) {
    console.error('me error', err);
    res.status(500).json({ error: 'Could not load user.' });
  }
});

export default router;
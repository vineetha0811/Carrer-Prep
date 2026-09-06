import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import prisma from './prisma.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import syllabusRoutes from './routes/syllabus.js';
import assignmentRoutes from './routes/assignment.js';
import questionRoutes from './routes/questions.js';
import speakingRoutes from './routes/speaking.js';
import interviewRoutes from './routes/interview.js';
import gdRoutes from './routes/gd.js';
import progressRoutes from './routes/progress.js';
import resumeRoutes from './routes/resume.js';
import projectRoutes from './routes/projects.js';
import settingsRoutes from './routes/settings.js';
import asrRoutes from './routes/asr.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));

const PORT = process.env.PORT || 5000;

// Health
app.get('/api/health', (req, res) => res.json({ ok: true, service: 'campusready-ai', time: new Date().toISOString() }));

// Static file serving (protected by auth per-file via route below)
app.use('/api/uploads', (req, res, next) => {
  // Token check via query param (?token=) or header
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required to view uploaded files.' });
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'campusready_ai_super_secret_change_in_production');
    req.userId = payload.id;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token.' });
  }
}, express.static(path.join(process.cwd(), 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api', profileRoutes);
app.use('/api/syllabus', syllabusRoutes);
app.use('/api/assignment', assignmentRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/speaking', speakingRoutes);
app.use('/api/interview', interviewRoutes);
app.use('/api/gd', gdRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/asr', asrRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error('server error:', err.message);
  res.status(500).json({ error: err.message || 'Internal server error.' });
});

app.listen(PORT, () => {
  console.log(`CampusReady AI server running on http://localhost:${PORT}`);
});

// graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
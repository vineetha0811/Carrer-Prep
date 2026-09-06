import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import prisma from '../prisma.js';
import { authRequired } from '../middleware/auth.js';
import { extractText } from '../services/syllabus.js';
import { aiEnabled, callAI } from '../services/ai.js';
import { getUploadsDir } from '../services/syllabus.js';

const router = Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(getUploadsDir(), 'resumes');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^\w.\-]+/g, '_');
    cb(null, `r${req.userId}_${Date.now()}_${safe}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    cb(['.pdf', '.doc', '.docx', '.txt', '.md'].includes(ext) ? null : new Error('Unsupported file type'), [' .pdf', '.doc', '.docx', '.txt', '.md'].includes(ext));
  },
});

// -------- Upload a resume --------
router.post('/upload', authRequired, upload.array('files', 5), async (req, res) => {
  try {
    const userId = req.userId;
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: 'No file received.' });

    const results = [];
    for (const f of files) {
      const rec = await prisma.resume.create({
        data: { userId, fileName: f.originalname, storedPath: f.path, mimeType: f.mimetype, size: f.size },
      });
      // Extract + parse skills/projects async
      processResume(rec.id).catch((e) => console.error('resume processing error', e));
      results.push(rec);
    }
    res.status(201).json({ resumes: results });
  } catch (err) {
    res.status(500).json({ error: 'Could not upload resume.' });
  }
});

async function processResume(resumeId) {
  const resume = await prisma.resume.findUnique({ where: { id: resumeId } });
  if (!resume) return;
  try {
    const text = await extractText(resume.storedPath, resume.mimeType);

    let skills = [];
    let projects = [];

    if (aiEnabled()) {
      try {
        const res = await callAI({
          temperature: 0.1,
          system: 'Return ONLY JSON: {"skills":["..."],"projects":[{"title":"...","description":"...","technologies":["..."]}],"certifications":["..."]}. Extract strictly what is present. Do not invent skills.',
          user: JSON.stringify({ resume: text.slice(0, 60000) }),
        });
        if (res && Array.isArray(res.skills)) skills = res.skills.slice(0, 30);
        if (res && Array.isArray(res.projects)) projects = res.projects.slice(0, 10);
      } catch (e) { /* fallback to heuristic */ }
    }

    if (!skills.length) {
      // Heuristic: detect common tech/skill tokens present in text
      const lower = text.toLowerCase();
      const tokens = ['python', 'java', 'c++', 'c', 'javascript', 'react', 'node', 'sql', 'mysql', 'mongodb', 'html', 'css', 'matlab', 'simulink', 'arduino', 'autocad', 'solidworks', 'excel', 'power bi', 'tableau', 'git', 'linux', 'ml', 'deep learning', 'nlp', 'communication', 'leadership', 'teamwork'];
      skills = tokens.filter((t) => lower.includes(t));
    }

    await prisma.resume.update({
      where: { id: resumeId },
      data: { status: 'ready', extracted: text.slice(0, 20000), skills: JSON.stringify(skills), projects: JSON.stringify(projects) },
    });
  } catch (err) {
    await prisma.resume.update({ where: { id: resumeId }, data: { status: 'failed' } });
  }
}

// -------- List resumes --------
router.get('/', authRequired, async (req, res) => {
  try {
    const resumes = await prisma.resume.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, fileName: true, size: true, status: true, skills: true, projects: true, extracted: true, createdAt: true },
    });
    res.json({ resumes: resumes.map((r) => ({ ...r, skills: safeList(r.skills), projects: safeList(r.projects), analysis: buildResumeAnalysis(r) })) });
  } catch (err) {
    res.status(500).json({ error: 'Could not load resumes.' });
  }
});

function safeList(v) {
  try { const arr = JSON.parse(v || '[]'); return Array.isArray(arr) ? arr : []; } catch (e) { return []; }
}

function buildResumeAnalysis(r) {
  const skills = safeList(r.skills);
  const projects = safeList(r.projects);
  const overall = r.status === 'ready' ? Math.min(95, 35 + skills.length * 6 + projects.length * 8) : 0;
  return JSON.stringify({
    overall,
    strengths: [
      ...skills.slice(0, 8).map((s) => `Listed ${s}`),
      ...projects.slice(0, 3).map((p) => `Project: ${p.title || 'untitled'}`),
    ],
    weakPoints: [],
    skillCount: skills.length,
    projectCount: projects.length,
  });
}

// -------- Generate interview questions from a resume --------
router.post('/:id/questions', authRequired, async (req, res) => {
  try {
    const resume = await prisma.resume.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!resume) return res.status(404).json({ error: 'Resume not found.' });
    if (resume.status !== 'ready') return res.status(400).json({ error: 'Resume is still being analyzed. Please wait.' });

    const skills = safeList(resume.skills);
    const projects = safeList(resume.projects);

    let questions = [];
    if (aiEnabled()) {
      try {
        const res = await callAI({
          temperature: 0.6,
          system: 'You are a campus placement interviewer. Return ONLY JSON: {"questions":[{"text":"interview question about the resume item","rationale":"which resume claim it probes and why"}]}. Produce 5 questions that drill into gaps/claims. Do not invent facts.',
          user: JSON.stringify({ skills, projects }),
        });
        if (res && Array.isArray(res.questions)) questions = res.questions.slice(0, 8);
      } catch (e) { /* heuristic fallback */ }
    }

    if (!questions.length) {
      for (const p of projects.slice(0, 3)) {
        questions.push({ text: `Walk me through your project "${p.title || 'Untitled'}". What problem did it solve and what was YOUR contribution?`, rationale: 'Tests ownership and depth of the claim on the resume.' });
        questions.push({ text: `What was the hardest technical problem in "${p.title || 'Untitled'}" and how did you debug it?`, rationale: 'Tests practical problem solving under pressure.' });
      }
      for (const s of skills.slice(0, 4)) {
        questions.push({ text: `Rate yourself on ${s} honestly, and give an example of where you actually used it.`, rationale: 'Catches inflated skill claims.' });
      }
      questions.push({ text: 'Tell me about a time one of your projects failed or you had to restart the design.', rationale: 'Tests learning from failure and honesty.' });
      if (!questions.length) questions.push({ text: 'Tell me about your strongest project and your specific role in it.', rationale: 'General ownership question.' });
    }

    res.json({ questions });
  } catch (err) {
    console.error('resume questions error', err);
    res.status(500).json({ error: 'Could not generate questions.' });
  }
});

// -------- Delete --------
router.delete('/:id', authRequired, async (req, res) => {
  try {
    const resume = await prisma.resume.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!resume) return res.status(404).json({ error: 'Resume not found.' });
    try { fs.unlinkSync(resume.storedPath); } catch (e) { /* ignore */ }
    await prisma.resume.delete({ where: { id: resume.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not delete resume.' });
  }
});

export default router;
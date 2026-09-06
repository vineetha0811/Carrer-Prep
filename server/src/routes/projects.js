import { Router } from 'express';
import prisma from '../prisma.js';
import { authRequired } from '../middleware/auth.js';
import { aiEnabled, callAI } from '../services/ai.js';

const router = Router();

// -------- Create project --------
router.post('/', authRequired, async (req, res) => {
  try {
    const { title, description, technologies, techStack, role, link } = req.body || {};
    if (!title) return res.status(400).json({ error: 'Project title is required.' });
    const techs = toArray(technologies || techStack);
    const project = await prisma.project.create({
      data: {
        userId: req.userId,
        title: title.trim(),
        description: description || null,
        technologies: JSON.stringify(techs),
        role: role || null,
        link: link || null,
      },
    });
    res.status(201).json({ project });
  } catch (err) {
    res.status(500).json({ error: 'Could not save project.' });
  }
});

// -------- List --------
router.get('/', authRequired, async (req, res) => {
  try {
    const projects = await prisma.project.findMany({ where: { userId: req.userId }, orderBy: { createdAt: 'desc' } });
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ error: 'Could not load projects.' });
  }
});

// -------- Update --------
router.patch('/:id', authRequired, async (req, res) => {
  try {
    const p = await prisma.project.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!p) return res.status(404).json({ error: 'Project not found.' });
    const { title, description, technologies, role, link } = req.body || {};
    const project = await prisma.project.update({
      where: { id: p.id },
      data: {
        title: title ?? p.title,
        description: description ?? p.description,
        technologies: technologies ? JSON.stringify(technologies) : p.technologies,
        role: role ?? p.role,
        link: link ?? p.link,
      },
    });
    res.json({ project });
  } catch (err) {
    res.status(500).json({ error: 'Could not update project.' });
  }
});

// -------- Delete --------
router.delete('/:id', authRequired, async (req, res) => {
  try {
    const p = await prisma.project.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!p) return res.status(404).json({ error: 'Project not found.' });
    await prisma.project.delete({ where: { id: p.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not delete project.' });
  }
});

// -------- Generate project-interview question bank ---------
router.post('/:id/questions', authRequired, async (req, res) => {
  try {
    const p = await prisma.project.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!p) return res.status(404).json({ error: 'Project not found.' });

    const technologies = safeArray(p.technologies);
    const base = [
      { text: `Tell me about your project "${p.title}". What problem does it solve?`, rationale: 'Tests your ability to explain your work clearly.' },
      { text: `What was your exact contribution to "${p.title}"?`, rationale: 'Distinguishes your work from team work.' },
      { text: `Which technologies did you use in this project, and why those?`, rationale: 'Tests technology choices with reasoning.' },
      { text: `What is the hardest technical problem you faced while building this and how did you solve it?`, rationale: 'Tests debugging and problem-solving under pressure.' },
      { text: `If you built "${p.title}" again, what would you do differently?`, rationale: 'Tests learning from experience.' },
      { text: `How would you scale "${p.title}" for 1000 users?`, rationale: 'Tests architectural thinking beyond the prototype.' },
      { text: `What was a failure or mistake in this project and what did you learn?`, rationale: 'Tests honesty and growth mindset.' },
      { text: `Why did you choose "${p.title}" as a project?`, rationale: 'Tests motivation and depth of interest.' },
    ];
    if (technologies.length) {
      base.push({ text: `Explain honestly what you did with ${technologies[0]} in this project.`, rationale: 'Probes the depth of your claimed skill.' });
    }

    res.json({ questions: base });
  } catch (err) {
    res.status(500).json({ error: 'Could not generate questions.' });
  }
});

function safeArray(json) {
  try { const v = JSON.parse(json || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
}

function toArray(v) {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  if (typeof v === 'string') {
    const parts = v.split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
    return parts;
  }
  return [];
}

export default router;
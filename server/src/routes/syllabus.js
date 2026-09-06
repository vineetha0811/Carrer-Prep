import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import prisma from '../prisma.js';
import { authRequired } from '../middleware/auth.js';
import { extractText, analyzeSyllabusText, mergeAnalyzedSubjects, deleteUploadedFile, getUploadsDir, getSyllabusOutline, heuristicAnalyze } from '../services/syllabus.js';
import { getAllTopicsForBranch } from '../data/branches.js';

const router = Router();
const ALLOWED_EXT = ['.pdf', '.doc', '.docx', '.txt', '.md', '.csv'];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(getUploadsDir(), 'files');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^\w.\-]+/g, '_');
    cb(null, `u${req.userId}_${Date.now()}_${safe}`);
  },
});
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  cb(ALLOWED_EXT.includes(ext) ? null : new Error('Unsupported file type. Use PDF, Word, txt, or csv.'), ALLOWED_EXT.includes(ext));
};
const upload = multer({ storage, fileFilter, limits: { fileSize: 15 * 1024 * 1024 } });

// -------- Upload one or many files --------
router.post('/upload', authRequired, upload.array('files', 10), async (req, res) => {
  try {
    const userId = req.userId;
    const files = req.files || [];
    if (!files.length) return res.status(400).json({ error: 'No files received.' });

    const created = [];
    for (const f of files) {
      const rec = await prisma.syllabusFile.create({
        data: {
          userId,
          fileName: f.originalname,
          storedPath: f.path,
          mimeType: f.mimetype,
          size: f.size,
          status: 'uploading',
        },
      });
      created.push(rec);
    }

    // Process each file (sync per file, status transitions visible to client via polling)
    for (const rec of created) {
      processFileInBackground(rec.id).catch((err) => {
        console.error('processing error', rec.id, err);
      });
    }

    res.status(201).json({ files: created });
  } catch (err) {
    console.error('syllabus upload error', err);
    res.status(500).json({ error: 'Could not upload files.' });
  }
});

async function processFileInBackground(fileId) {
  const update = (data) => prisma.syllabusFile.update({ where: { id: fileId }, data }).catch(() => {});

  const file = await prisma.syllabusFile.findUnique({ where: { id: fileId } });
  if (!file) return;

  try {
    await update({ status: 'processing' });
    const rawText = await extractText(file.storedPath, file.mimeType);
    if (!rawText || !rawText.trim()) {
      await update({ status: 'failed', errorMsg: 'No readable text found. This may be a scanned/image PDF.' });
      return;
    }

    await update({ status: 'analyzing', sourceText: rawText });

    const profile = await prisma.profile.findUnique({ where: { userId: file.userId } });
    const analyzed = await analyzeSyllabusText(rawText, profile?.branch || '');

    await update({ status: 'structuring', analyzedKeywords: JSON.stringify(analyzed.keywords || []) });

    await mergeAnalyzedSubjects(file.userId, analyzed, file.id);

    await update({ status: 'ready', sourceText: rawText });
  } catch (err) {
    console.error('bg processing error', err);
    await update({ status: 'failed', errorMsg: err.message || 'Processing failed. Please try again.' });
  }
}

// Retry a failed file
router.post('/retry/:id', authRequired, async (req, res) => {
  try {
    const file = await prisma.syllabusFile.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!file) return res.status(404).json({ error: 'File not found.' });
    await prisma.syllabusFile.update({ where: { id: file.id }, data: { status: 'uploading', errorMsg: null } });
    processFileInBackground(file.id).catch(() => {});
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Could not retry file.' });
  }
});

// -------- List the user's files --------
router.get('/', authRequired, async (req, res) => {
  try {
    const files = await prisma.syllabusFile.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, fileName: true, mimeType: true, size: true, status: true, errorMsg: true, createdAt: true,
      },
    });
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: 'Could not load files.' });
  }
});

// -------- Preview (text excerpt) --------
router.get('/:id/preview', authRequired, async (req, res) => {
  try {
    const file = await prisma.syllabusFile.findFirst({ where: { id: req.params.id, userId: req.userId } });
    if (!file) return res.status(404).json({ error: 'File not found.' });
    const text = file.sourceText || '';
    res.json({ text: text.slice(0, 5000), totalChars: text.length });
  } catch (err) {
    res.status(500).json({ error: 'Could not preview file.' });
  }
});

// -------- Delete --------
router.delete('/:id', authRequired, async (req, res) => {
  try {
    await deleteUploadedFile(req.userId, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(404).json({ error: err.message || 'Could not delete file.' });
  }
});

// -------- Analyzed outline (uploaded + builtin + supplement) --------
router.get('/outline', authRequired, async (req, res) => {
  try {
    const profile = await prisma.profile.findUnique({ where: { userId: req.userId } });
    const outline = await getSyllabusOutline(req.userId);
    if (profile?.branch) {
      const all = getAllTopicsForBranch(profile.branch);
      outline.builtin = [];
      outline.supplement = [];
      for (const t of all) {
        if (t.source === 'supplement') outline.supplement.push(t);
        else outline.builtin.push(t);
      }
    }
    res.json({ outline });
  } catch (err) {
    res.status(500).json({ error: 'Could not load syllabus outline.' });
  }
});

export default router;
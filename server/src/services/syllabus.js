import fs from 'fs';
import path from 'path';
import os from 'os';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { aiEnabled, callAI } from './ai.js';
import prisma from '../prisma.js';

// Extract raw text from an uploaded file
export async function extractText(filePath, mimeType) {
  const ext = path.extname(filePath).toLowerCase();
  const mime = (mimeType || '').toLowerCase();

  if (ext === '.pdf' || mime.includes('pdf')) {
    const dataBuffer = fs.readFileSync(filePath);
    const parsed = await pdfParse(dataBuffer);
    return parsed.text || '';
  }
  if (ext === '.docx' || mime.includes('word') || mime.includes('officedocument')) {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value || '';
  }
  if (ext === '.txt' || mime.includes('text') || ext === '.md') {
    return fs.readFileSync(filePath, 'utf8');
  }
  // Attempt reading as text (covers .csv and generic files)
  try {
    return fs.readFileSync(filePath, 'utf8').slice(0, 400000);
  } catch (e) {
    return '';
  }
}

// Structure raw extracted text into subjects/units/topics/subtopics.
// Uses the LLM when available; otherwise falls back to a keyword-based heuristic.
export async function analyzeSyllabusText(rawText, branchCode) {
  if (!rawText || !rawText.trim()) {
    return { subjects: [], keywords: [], warning: 'No readable text could be extracted from the file.' };
  }

  if (aiEnabled()) {
    try {
      const res = await callAI({
        temperature: 0.2,
        maxTokens: 4000,
        system: 'You are a syllabus analyzer for engineering students. Convert the given syllabus/material text into a structured JSON outline. Return ONLY JSON: {"subjects":[{"name":"...","units":[{"name":"...","topics":[{"name":"...","subtopics":["..."]}]}]}],"keywords":["..."]}. Extract only what is actually present in the text. Do not invent unrelated advanced subjects.',
        user: JSON.stringify({ branch: branchCode, syllabusText: rawText.slice(0, 120000) }),
      });
      if (res && Array.isArray(res.subjects) && res.subjects.length) {
        return { subjects: res.subjects, keywords: res.keywords || [], source: 'ai' };
      }
    } catch (e) { /* fall through to heuristic */ }
  }

  return heuristicAnalyze(rawText, branchCode);
}

export function heuristicAnalyze(rawText, branchCode) {
  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const keywords = [];
  const frequency = new Map();

  // Gather distinctive keyword phrases
  const phrasePattern = /([A-Z][A-Za-z .&/-]{3,40})/g;
  for (const line of lines) {
    const matches = line.match(phrasePattern) || [];
    for (const m of matches) {
      if (m.length < 4 || /^(Unit|Subject|Semester|Module|Chapter|Syllabus|University|Regulation)/i.test(m)) continue;
      const key = m.toLowerCase();
      frequency.set(key, (frequency.get(key) || 0) + 1);
    }
  }
  const sorted = [...frequency.entries()].sort((a, b) => b[1] - a[1]);
  const topKeywords = sorted.slice(0, 40).map(([k]) => k);

  // Detect subject candidates among lines (capitalized, short, no sentence punctuation)
  const subjectLineRegex = /^(.*Electronics.*|.*Machines.*|.*Power Systems.*|.*Control Systems.*|.*Circuits.*|.*Engineering.*|.*Mechanics.*|.*Materials.*|.*Mathematics.*|.*Physics.*|.*Chemistry.*|.*Programming.*|.*Structure.*|.*Database.*|.*Operating Systems.*|.*Networks.*|.*Software.*|.*Geotech.*|.*Concrete.*|.*Survey.*|.*Transport.*|.*Environmental.*|.*Fluid.*)$/i;

  const subjects = [];
  let currentSubject = null;
  let currentUnit = null;
  let currentTopic = null;

  // Unit markers
  const unitMarkers = [
    /^Unit[\s-]*\d+/i, /^Module[\s-]*\d+/i, /^Chapter[\s-]*\d+/i,
    /^Lesson[\s-]*\d+/i, /^SEMESTER[\s-]*\d+/i, /\d+\.?\s*$/,
  ];

  for (const line of lines) {
    const isSubject = subjectLineRegex.test(line) && line.length < 80 && !line.includes('. ');
    const isUnit = line.length < 60 && (unitMarkers.some((r) => r.test(line)) || /^[IVX]+\./.test(line));
    const isTopicHeading = line.length < 90 && line.length > 3 && !isUnit && !isSubject && /^(The|Basic|Introduction|Design|Analysis|Working|Principles?|Types? of|Applications? of|Construction|Testing|Properties? of|Transmission|Distribution|Generation|Protection|Components? of)/i.test(line);

    if (isSubject) {
      currentSubject = { name: cleanTitle(line), units: [] };
      subjects.push(currentSubject);
      currentUnit = null; currentTopic = null;
    } else if (isUnit) {
      if (currentSubject) {
        currentUnit = { name: cleanTitle(line), topics: [] };
        currentSubject.units.push(currentUnit);
        currentTopic = null;
      }
    } else if (isTopicHeading && currentUnit) {
      currentTopic = { name: cleanTitle(line), subtopics: [] };
      currentUnit.topics.push(currentTopic);
    } else if (currentUnit && !isSubject && !isUnit && line.length > 5 && line.length < 80 && !/^\d+[.)]/.test(line) && !line.endsWith('.')) {
      // likely a subtopic
      if (currentTopic) {
        currentTopic.subtopics.push(cleanTitle(line));
      } else if (currentUnit.topics.length < 12) {
        // treat as topic
        currentUnit.topics.push({ name: cleanTitle(line), subtopics: [] });
      }
    }
  }

  // If nothing sensible found, fall back to the branch's built-in structured topics so the student still gets value
  if (!subjects.length) {
    return { subjects: [], keywords, source: 'heuristic-empty', recommendation: 'We could not detect structured topics in this file. The built-in {branch} curriculum will be used instead.' };
  }

  return { subjects, keywords, source: 'heuristic' };
}

function cleanTitle(t) {
  return t.replace(/[:|-]+$/g, '').replace(/['"]/g, '').trim().slice(0, 120);
}

// Validate + persist a structured subject outline against the user's profile.
// Profile subjects that come from uploaded files get the `uploaded` source.
export async function mergeAnalyzedSubjects(userId, analyzed, syllabusFileId) {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) throw new Error('Profile not found');

  // Keep existing uploaded-from-file subject structures, update/add the new one
  const existing = await prisma.subjectStructure.findMany({
    where: { profileId: profile.id, source: 'uploaded' },
  });

  for (const subject of analyzed.subjects) {
    const exists = existing.find((s) => s.name.toLowerCase() === subject.name.toLowerCase());
    if (exists) {
      await prisma.subjectStructure.update({
        where: { id: exists.id },
        data: {
          subjectUnits: JSON.stringify(subject.units || []),
          syllabusFileId: syllabusFileId || exists.syllabusFileId,
        },
      });
    } else {
      await prisma.subjectStructure.create({
        data: {
          profileId: profile.id,
          syllabusFileId,
          name: subject.name,
          source: 'uploaded',
          subjectUnits: JSON.stringify(subject.units || []),
        },
      });
    }
  }
}

// List the analyzed subject outline for a user (uploaded + builtin merged)
export async function getSyllabusOutline(userId) {
  const profile = await prisma.profile.findUnique({ where: { userId } });
  if (!profile) return { uploaded: [], builtin: [], supplement: [] };

  const uploadedRows = await prisma.subjectStructure.findMany({
    where: { profileId: profile.id, source: 'uploaded' },
    orderBy: { name: 'asc' },
  });

  const uploaded = uploadedRows.map((r) => ({
    name: r.name,
    source: 'uploaded',
    units: safeParseUnits(r.subjectUnits),
  }));

  return { uploaded, builtin: [], supplement: [] };
}

function safeParseUnits(json) {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v : [];
  } catch (e) { return []; }
}

export async function deleteUploadedFile(userId, fileId) {
  const file = await prisma.syllabusFile.findFirst({ where: { id: fileId, userId } });
  if (!file) throw new Error('File not found');
  try { fs.unlinkSync(file.storedPath); } catch (e) { /* ignore */ }
  await prisma.syllabusFile.delete({ where: { id: fileId } });
  return true;
}

export function getUploadsDir() {
  const dir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}
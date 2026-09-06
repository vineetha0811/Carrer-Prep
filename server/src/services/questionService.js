import { createHash } from 'crypto';
import { getBranchBank } from '../data/banks/index.js';
import { aiEnabled, callAI } from './ai.js';
import prisma from '../prisma.js';
import { getWeakTopicsForUser, getTopicStatsForUser } from './weakness.js';

// Stable identity of a bank question so every attempt can be tracked and no
// question gets served twice before the whole bank has been covered.
export function makeQuestionKey(q) {
  const branch = q?.branch || 'gen';
  const subject = q?.subject || 'general';
  const topic = q?.topic || 'general';
  const source = q?.source || 'builtin';
  const text = String(q?.text || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const hash = createHash('sha1').update(text).digest('hex').slice(0, 12);
  return `${branch}::${subject}::${topic}::${source}::${hash}`;
}

// All question identities the user has already answered, grouped by category.
export async function getSeenQuestionKeys(userId) {
  const rows = await prisma.questionAttempt.findMany({
    where: { userId, questionKey: { not: null } },
    select: { category: true, questionKey: true },
  });
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.category)) map.set(r.category, new Set());
    map.get(r.category).add(r.questionKey);
  }
  return map;
}

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Deterministic PRNG (mulberry32) so the same user+day always yields the same
// set, while different users/days get different sets.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Select questions for a daily assignment based on the student's profile,
// weak topics, revision schedule, and previous attempts.

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Deduplicate by subject+topic+text
function dedupe(questions) {
  const seen = new Set();
  return questions.filter((q) => {
    const key = `${q.subject}::${q.topic}::${q.text}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// Simple seeded pick to avoid immediate repeats of recent questions
async function getRecentlyUsed(userId, category, limit = 15) {
  const attempts = await prisma.questionAttempt.findMany({
    where: { userId, category },
    orderBy: { evaluatedAt: 'desc' },
    take: limit,
    select: { topic: true },
  });
  return new Set(attempts.map((a) => a.topic));
}

const DIFFICULTY_WEIGHTS = {
  easy: { 1: 0.35, 2: 0.4, 3: 0.15, 4: 0.07, 5: 0.02, 6: 0.01 },
  medium: { 1: 0.15, 2: 0.3, 3: 0.25, 4: 0.15, 5: 0.1, 6: 0.05 },
  hard: { 1: 0.05, 2: 0.15, 3: 0.25, 4: 0.25, 5: 0.2, 6: 0.1 },
};

// Normalize an option label so different letter prefixes compare equal.
function normOption(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/^\s*[a-d]\s*[.):]\s*/, '')
    .replace(/^option\s*[a-d]\s*[):]?\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Give every question 6 plausible options and shuffle their order with a seed
// derived from the user + question, so the correct answer is never stuck in the
// first position and each student sees a different arrangement. Grading is
// text-based (not position-based), so reshuffling is always safe.
const TARGET_OPTIONS = 6;
export function finalizeOptions(q, pool, seedText) {
  if (!q || !Array.isArray(q.options) || q.options.length === 0) return q;

  const isMcq = (q.qtype || 'mcq') === 'mcq';
  const options = q.options.slice();

  if (isMcq && options.length < TARGET_OPTIONS) {
    const correctNorm = normOption(q.correctAnswer);
    const taken = new Set(options.map(normOption));
    const cand = (pool || []).flatMap((p) => (Array.isArray(p.options) ? p.options : []));
    for (const o of cand) {
      if (options.length >= TARGET_OPTIONS) break;
      const n = normOption(o);
      if (!n || n === correctNorm || taken.has(n)) continue;
      taken.add(n);
      options.push(o);
    }
  }

  const rng = mulberry32(hashString(seedText));
  return { ...q, options: shuffleWithRng(options, rng) };
}

function accuracyToDifficultyMode(accuracy) {
  if (accuracy >= 0.8) return 'hard';
  if (accuracy <= 0.5) return 'easy';
  return 'medium';
}

function shuffleWithRng(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Cycle through as many *topics* as possible before revisiting one, and never
// repeat a question inside a single pass. Weak/syllabus topics rise to the front.
function pickFromPool({ pool = [], count = 0, rng = Math.random, diffWeights = null, weakSet = null, syllabusSet = null }) {
  const out = [];
  if (!pool.length || count <= 0) return out;

  const buckets = new Map();
  for (const q of pool) {
    const t = q.topic || 'General';
    if (!buckets.has(t)) buckets.set(t, []);
    buckets.get(t).push(q);
  }

  const topics = shuffleWithRng([...buckets.keys()], rng);
  const topicRank = (t) => {
    const tl = String(t).toLowerCase();
    let rank = 0;
    if (weakSet && weakSet.has(tl)) rank += 3;
    if (syllabusSet && syllabusSet.has(tl)) rank += 2;
    return rank;
  };
  topics.sort((a, b) => topicRank(b) - topicRank(a));

  const lists = topics.map((t) => buckets.get(t)
    .map((q) => ({ q, draw: (diffWeights ? (diffWeights[q.difficulty] ?? 0.05) : 0.3) * (0.25 + rng()) }))
    .sort((a, b) => b.draw - a.draw)
    .map((x) => x.q));

  let idx = 0;
  let active = lists.filter((l) => l.length > idx);
  while (out.length < count && active.length) {
    for (const l of active) {
      if (idx < l.length) out.push(l[idx]);
      if (out.length >= count) break;
    }
    idx += 1;
    active = lists.filter((l) => l.length > idx);
  }
  return out;
}

async function recentAccuracyOf(userId) {
  const stats = await getTopicStatsForUser(userId);
  if (!stats || stats.overallAttempts === 0) return 0.6;
  return stats.overallCorrect / stats.overallAttempts;
}

// Take N questions strictly avoiding every question the user has already seen;
// when the whole bank is exhausted, recycle (still cycling through topics).
async function unseenFirst(userId, category, list, count, rng, diffWeights, weakSet = null, syllabusSet = null) {
  const seen = (await getSeenQuestionKeys(userId)).get(category) || new Set();
  const key = (q) => makeQuestionKey(q);
  const unseen = list.filter((q) => !seen.has(key(q)));
  const used = list.filter((q) => seen.has(key(q)));
  const primary = pickFromPool({ pool: unseen, count, rng, diffWeights, weakSet, syllabusSet });
  if (primary.length >= count) return primary;
  const secondary = pickFromPool({ pool: used, count: count - primary.length, rng, diffWeights, weakSet, syllabusSet });
  return [...primary, ...secondary].slice(0, count);
}

// Select technical questions for the student: unseen-first, syllabus topics
// prioritized (~70% syllabus / ~30% general when a syllabus exists), weak
// topics pulled to the front, and seeded picks so each user/day differs.
export async function selectTechnicalQuestions({ userId, branch, count = 10, weakTopics = [], syllabusTopics = [], seed = null, seenAlready = [] }) {
  const bank = dedupe(getBranchBank(branch));
  const rng = typeof seed === 'number' || typeof seed === 'string' ? mulberry32(typeof seed === 'string' ? hashString(seed) : seed) : Math.random;
  const weakSet = new Set((weakTopics || []).map((t) => String(t?.topic || t || '').toLowerCase()).filter(Boolean));
  const syllSet = new Set((syllabusTopics || []).map((t) => String(t).toLowerCase()).filter(Boolean));
  const diffWeights = DIFFICULTY_WEIGHTS[accuracyToDifficultyMode(await recentAccuracyOf(userId))];

  const syllPool = syllSet.size ? bank.filter((q) => syllSet.has(String(q.topic || '').toLowerCase())) : [];
  const genPool = syllSet.size ? bank.filter((q) => !syllSet.has(String(q.topic || '').toLowerCase())) : bank;

  let picks = [];
  if (syllPool.length) {
    let syllN = Math.min(syllPool.length, Math.round(count * 0.7));
    const genN = Math.min(genPool.length, count - syllN);
    const genShort = Math.max(0, count - syllN - genN);
    syllN = Math.min(syllPool.length, syllN + genShort);
    const syll = await unseenFirst(userId, 'technical', syllPool, syllN, rng, diffWeights, weakSet, syllSet);
    const gen = await unseenFirst(userId, 'technical', genPool, Math.min(genPool.length, count - syllN), rng, diffWeights, weakSet, null);
    picks = [...syll, ...gen];
    if (picks.length < count && bank.length >= count) {
      picks = [...picks, ...(await unseenFirst(userId, 'technical', bank, count - picks.length, rng, diffWeights, weakSet, syllSet))];
    }
  } else {
    picks = await unseenFirst(userId, 'technical', bank, count, rng, diffWeights, weakSet, syllSet);
  }

  picks = shuffleWithRng(picks, rng);

  // Optionally enrich with LLM when enabled (fall back gracefully to bank)
  let result = picks.slice(0, count);
  try {
    if (aiEnabled()) {
      const enriched = await enrichQuestionsWithAI(picks, branch, weakTopics);
      if (enriched) result = enriched;
    }
  } catch (e) {
    // ignore, fall back to bank
  }
  return result.map((q) => finalizeOptions(q, bank, `${userId}::opts::${makeQuestionKey(q)}`));
}

async function enrichQuestionsWithAI(questions, branch, weakTopics) {
  try {
    const result = await callAI({
      system: 'You generate placement interview questions. Respond ONLY with JSON matching the requested schema.',
      user: JSON.stringify({
        task: 'Improve / generate fresh technical questions for a final year student of ' + branch + '. Focus on these weak topics: ' + (weakTopics || []).map(w => w.topic).join(', '),
        schema: [
          'subject', 'topic', 'difficulty (1-6)', 'qtype (mcq|truefalse|multi|fillblank|short|numerical|scenario|assertion)',
          'text', 'options (array)', 'correctAnswer', 'explanation', 'misconception', 'interviewTakeaway', 'memoryTip', 'relatedConcept', 'source (uploaded|builtin|supplement)', 'isPractical'
        ],
        count: Math.max(0, 5 - questions.length),
      }),
    });
    if (result && Array.isArray(result.questions) && result.questions.length) {
      const clean = result.questions.filter((q) => q && q.text && q.correctAnswer);
      return [...questions, ...clean].slice(0, questions.length + clean.length);
    }
  } catch (e) { /* fallback */ }
  return null;
}

export async function selectAptitudeQuestions({ userId, count = 8, seed = null }) {
  const { default: aptitude } = await import('../data/banks/aptitude.js');
  const diffWeights = DIFFICULTY_WEIGHTS[accuracyToDifficultyMode(await recentAccuracyOf(userId))];
  const rng = (typeof seed === 'number' || typeof seed === 'string') ? mulberry32(typeof seed === 'string' ? hashString(seed) : seed) : Math.random;
  const picks = await unseenFirst(userId, 'aptitude', dedupe(aptitude), count, rng, diffWeights);
  return picks
    .map((q) => finalizeOptions(q, aptitude, `${userId}::opts::${makeQuestionKey(q)}`))
    .map(q => ({ ...q, category: 'aptitude' }));
}

export async function selectEnglishQuestions({ userId, count = 6, seed = null }) {
  const { default: english } = await import('../data/banks/english.js');
  const rng = (typeof seed === 'number' || typeof seed === 'string') ? mulberry32(typeof seed === 'string' ? hashString(seed) : seed) : Math.random;
  const picks = await unseenFirst(userId, 'english', dedupe(english), count, rng, null);
  return picks
    .map((q) => finalizeOptions(q, english, `${userId}::opts::${makeQuestionKey(q)}`))
    .map(q => ({ ...q, category: 'english' }));
}

// Baseline assessment: 5 technical + 3 aptitude + 2 english, unseen-first and
// seeded per user so everyone gets a different (but stable) baseline.
export async function buildBaselineAssessment(branch, userId = null) {
  const bank = dedupe(getBranchBank(branch));
  const rng = userId ? mulberry32(hashString(`${userId}::baseline`)) : Math.random;
  const { default: aptitude } = await import('../data/banks/aptitude.js');
  const { default: english } = await import('../data/banks/english.js');

  const seen = userId ? (await getSeenQuestionKeys(userId)) : new Map();
  const seenOf = (c) => (userId ? (seen.get(c) || new Set()) : new Set());
  const seenSet = seenOf('technical');

  const pickAny = (category, list, n) => {
    const unseen = list.filter((q) => !seenOf(category).has(makeQuestionKey(q)));
    let res = pickFromPool({ pool: unseen, count: n, rng });
    if (res.length < n) {
      const used = list.filter((q) => seenOf(category).has(makeQuestionKey(q)));
      res = [...res, ...pickFromPool({ pool: used, count: n - res.length, rng })];
    }
    return res.slice(0, n);
  };

  return {
    technical: pickAny('technical', bank, 5).map(q => finalizeOptions(q, bank, `${userId || 'anon'}::baseline::${makeQuestionKey(q)}`)).map(q => ({ ...q, category: 'technical' })),
    aptitude: pickAny('aptitude', aptitude, 3).map(q => finalizeOptions(q, aptitude, `${userId || 'anon'}::baseline::${makeQuestionKey(q)}`)).map(q => ({ ...q, category: 'aptitude' })),
    english: pickAny('english', english, 2).map(q => finalizeOptions(q, english, `${userId || 'anon'}::baseline::${makeQuestionKey(q)}`)).map(q => ({ ...q, category: 'english' })),
  };
}
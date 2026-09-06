import { aiEnabled, callAI, askAI } from './ai.js';

// Cleanup text for comparison
function normalize(s = '') {
  return s.toLowerCase().replace(/\s+/g, ' ').replace(/^[a-d][.)]/i, '').replace(/^option\s*[a-d]\s*[):]?\s*/i, '').trim();
}

// Remove letter prefixes like "A) " from answer text
export function stripOptionPrefix(ans = '') {
  return ans.replace(/^\s*[a-d]\s*[.):]\s*/i, '').trim();
}

function stripMCQPrefix(text = '') {
  return text.replace(/^\s*[a-d]\s*[.):]\s*/i, '').trim();
}
export { stripMCQPrefix };

// Compare MCQ answers (with tolerance for lettered options)
export function matchesMCQ(userAnswer, correctAnswer) {
  const u = normalize(userAnswer);
  const c = normalize(correctAnswer);
  if (!u || !c) return false;
  return u === c;
}

// True/False tolerance
export function matchesTrueFalse(userAnswer, correctAnswer) {
  const map = { t: 'true', true: 'true', f: 'false', false: 'false' };
  return normalize(userAnswer) === normalize(correctAnswer) ||
    map[normalize(userAnswer)] === map[normalize(correctAnswer)];
}

// Numeric tolerance (within 1%)
export function matchesNumeric(userAnswer, correctAnswer) {
  const parseNum = (s) => {
    const m = String(s).replace(/,/g, '').match(/[\d.]+/);
    return m ? parseFloat(m[0]) : NaN;
  };
  const u = parseNum(userAnswer);
  const c = parseNum(correctAnswer);
  if (isNaN(u) || isNaN(c)) return false;
  return Math.abs(u - c) <= Math.max(0.01, Math.abs(c) * 0.01);
}

export function evaluateObjectively(question, userAnswer) {
  const qtype = question.qtype;
  const correct = stripMCQPrefix(question.correctAnswer);
  const user = String(userAnswer || '').trim();

  if (qtype === 'mcq') {
    return { isCorrect: matchesMCQ(user, correct), correctness: matchesMCQ(user, correct) ? 'correct' : 'incorrect', score: matchesMCQ(user, correct) ? 100 : 0 };
  }
  if (qtype === 'truefalse') {
    const ok = matchesTrueFalse(user, correct);
    return { isCorrect: ok, correctness: ok ? 'correct' : 'incorrect', score: ok ? 100 : 0 };
  }
  if (qtype === 'fillblank') {
    const fuzzy = matchesFillBlank(user, correct);
    return { isCorrect: fuzzy >= 0.7, correctness: fuzzy >= 0.7 ? 'correct' : fuzzy >= 0.4 ? 'partial' : 'incorrect', score: Math.round(fuzzy * 100) };
  }
  if (qtype === 'numerical') {
    const ok = matchesNumeric(user, correct);
    return { isCorrect: ok, correctness: ok ? 'correct' : 'incorrect', score: ok ? 100 : 0 };
  }
  if (qtype === 'multi') {
    // user may provide several options; check coverage
    const correctSet = new Set(String(correct).split(',').map((s) => normalize(s)).filter(Boolean));
    const userSet = new Set(user.split(/[,;]/).map((s) => normalize(s)).filter(Boolean));
    if (!userSet.size) return { isCorrect: false, correctness: 'incorrect', score: 0 };
    let hit = 0;
    for (const u of userSet) if (correctSet.has(u)) hit += 1;
    const precision = hit / userSet.size;
    const recall = hit / correctSet.size;
    const f1 = correctSet.size ? (2 * precision * recall) / (precision + recall || 1) : 0;
    return {
      isCorrect: correctSet.size === userSet.size && hit === correctSet.size,
      correctness: f1 >= 0.8 ? 'correct' : f1 >= 0.5 ? 'partial' : 'incorrect',
      score: Math.round(f1 * 100),
    };
  }
  // Default (short/assertion/scenario) - subjective handled below; here simple keyword check fallback
  return null;
}

// Fuzzy fill-blank matching
export function matchesFillBlank(userAnswer, correctAnswer) {
  const u = normalize(userAnswer);
  const c = normalize(correctAnswer);
  if (!u || !c) return 0;
  if (u === c) return 1;
  const words = c.split(' ');
  let hits = 0;
  for (const w of words) if (u.includes(w) && w.length > 2) hits += 1;
  return hits / words.length;
}

// Simplified token overlap for subjective scoring when AI is unavailable
function keywordOverlap(answer, ideal) {
  const stopWords = new Set(['the','a','an','and','or','of','to','in','for','is','are','was','were','be','that','this','it','on','with','by','as','at','from','its','their','which','will','can','used']);
  const ansWords = new Set(String(answer).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !stopWords.has(w)));
  const idealWords = String(ideal).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !stopWords.has(w));
  if (!idealWords.length) return 0;
  let hits = 0;
  for (const w of idealWords) if (ansWords.has(w)) hits += 1;
  return hits / idealWords.length;
}

// Rich subjective evaluation - the heart of the teaching experience.
export async function evaluateSubjective(question, userAnswer) {
  const answer = String(userAnswer || '').trim();

  if (!answer) {
    return {
      score: 0,
      correctness: 'incorrect',
      missingConcepts: [],
      mistakes: ['You did not provide an answer.'],
      feedback: 'Try again with your own words - even a partial attempt helps the evaluation.',
      suggestedRevision: question.relatedConcept || question.topic,
    };
  }

  // Try live LLM evaluation
  if (aiEnabled()) {
    try {
      const res = await callAI({
        temperature: 0.3,
        system: 'You are a strict but constructive placement interview coach. Evaluate the student answer for a technical question. Return ONLY JSON: {"score":0-100,"correctness":"correct|partial|incorrect|cannot determine","missingConcepts":[],"mistakes":[],"feedback":"concise, honest, actionable","betterAnswer":"a model interview answer in 2-3 sentences","suggestedRevision":"one related concept"}. Be honest: if the answer is weak, say so clearly. Do not sugarcoat.',
        user: JSON.stringify({ question: question.text, topic: question.topic, correctAnswer: question.correctAnswer, explanation: question.explanation, studentAnswer: answer }),
      });
      if (res && typeof res.score === 'number') {
        const correctness = ['correct', 'partial', 'incorrect', 'cannot determine'].includes(res.correctness) ? res.correctness : res.score >= 80 ? 'correct' : res.score >= 45 ? 'partial' : 'incorrect';
        return {
          score: Math.max(0, Math.min(100, Math.round(res.score))),
          correctness,
          missingConcepts: res.missingConcepts || [],
          mistakes: res.mistakes || [],
          feedback: res.feedback || '',
          betterAnswer: res.betterAnswer || '',
          suggestedRevision: res.suggestedRevision || question.relatedConcept || question.topic,
        };
      }
    } catch (e) { /* fall through to heuristic */ }
  }

  // Heuristic evaluation (works offline)
  const ideal = `${stripMCQPrefix(question.correctAnswer)} ${question.explanation || ''}`;
  let overlap = keywordOverlap(answer, ideal);

  // length-based completeness heuristic
  const wordCount = answer.split(/\s+/).filter(Boolean).length;
  let lengthScore = Math.min(1, wordCount / 40);

  // presence of core answer keywords
  const core = stripMCQPrefix(question.correctAnswer).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  let coreHits = 0;
  for (const c of core) if (answer.toLowerCase().includes(c)) coreHits += 1;
  const coreScore = core.length ? coreHits / core.length : 0;

  const score = Math.round(Math.max(0, Math.min(1, overlap * 0.5 + lengthScore * 0.2 + coreScore * 0.3)) * 100);

  let correctness = 'incorrect';
  if (score >= 80) correctness = 'correct';
  else if (score >= 45) correctness = 'partial';
  else if (score >= 15) correctness = 'incorrect';
  else correctness = 'cannot determine';

  const mistakes = [];
  if (!coreHits && core.length) mistakes.push('The key terms of the answer were missing: ' + core.slice(0, 4).join(', ') + '.');
  if (wordCount < 20) mistakes.push('The answer is quite short; an interview answer should explain the reasoning, not just state a result.');
  if (overlap < 0.35 && coreHits) mistakes.push('The answer covers part of the idea but the explanation needs more precision.');

  const feedback =
    score >= 80 ? 'Good answer - technically sound. Practice saying it out loud to make it interview-ready.' :
    score >= 45 ? 'Partially correct. You have the general idea, but your answer lacks completeness and precision. Study the explanation below and retry.' :
    score >= 15 ? 'This answer is not correct enough for an interview. Read the explanation, then press "I don\'t know" for a guided walkthrough and retry.' :
    'Your answer could not be evaluated confidently. Try using complete sentences with technical words.';

  return {
    score,
    correctness,
    missingConcepts: [question.relatedConcept || question.topic],
    mistakes,
    feedback,
    betterAnswer: buildBetterAnswer(question),
    suggestedRevision: question.relatedConcept || question.topic,
  };
}

function buildBetterAnswer(question) {
  return `${stripMCQPrefix(question.correctAnswer)}. ${question.interviewTakeaway || ''}`.trim();
}

// "I DON'T KNOW" - teaching flow (spec section 13)
export async function buildLearnContent(question) {
  if (aiEnabled()) {
    try {
      const res = await callAI({
        temperature: 0.4,
        system: 'You are a patient engineering tutor. Return ONLY JSON: {"simpleExplanation":"simple analogy-based explanation","detailedExplanation":"thorough explanation","realWorldExample":"one real example","commonInterviewQuestion":"one interview question on this","commonMistake":"one common mistake","selfTestQuestion":"one quick self-test MCQ/short question with answer"}',
        user: JSON.stringify({ concept: question.topic, subject: question.subject, question: question.text, correctAnswer: question.correctAnswer, explanation: question.explanation }),
      });
      if (res && res.simpleExplanation) return res;
    } catch (e) { /* fallback */ }
  }
  return {
    simpleExplanation: 'In simple terms: ' + (question.memoryTip || question.explanation),
    detailedExplanation: question.explanation,
    realWorldExample: question.relatedConcept ? `This is closely related to ${question.relatedConcept}, which shows up in real engineering situations.` : 'This concept appears in everyday engineering practice.',
    commonInterviewQuestion: question.text,
    commonMistake: question.misconception || 'Giving a one-line definition without explaining the reasoning behind it.',
    selfTestQuestion: 'Re-answer this question now in your own words: ' + question.text,
  };
}

// Explain each option for MCQs (used in wrong-answer feedback)
export function optionExplanations(question) {
  if (question.qtype !== 'mcq' || !Array.isArray(question.options) || !question.options.length) return [];
  const correct = normalize(stripMCQPrefix(question.correctAnswer));
  return question.options.map((opt) => {
    const text = stripMCQPrefix(opt);
    return {
      option: text,
      isCorrect: normalize(text) === correct,
      reasoning: normalize(text) === correct
        ? (question.interviewTakeaway || 'This is the correct answer.')
        : 'Not correct. ' + (question.misconception ? question.misconception : 'Review the explanation above.'),
    };
  });
}

export { keywordOverlap };
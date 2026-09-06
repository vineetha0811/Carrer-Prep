import { ALL_TECHNICAL_QUESTIONS, getBranchBank } from '../data/banks/index.js';
import aptitude from '../data/banks/aptitude.js';
import english from '../data/banks/english.js';

// Resolve a question sent from the client (which lacks the answer) back to the
// canonical bank question so the server can evaluate it reliably.
export function resolveCanonicalQuestion(question) {
  if (!question || !question.text) return null;
  const text = String(question.text).trim().toLowerCase();

  // If the client already sent correctAnswer, trust it
  if (question.correctAnswer) return question;

  const pool = question.branch
    ? getBranchBank(question.branch)
    : ALL_TECHNICAL_QUESTIONS;

  // exact-ish match on normalized text
  const norm = (s) => String(s).trim().toLowerCase().replace(/\s+/g, ' ');
  const target = norm(text);
  for (const q of pool) {
    if (norm(q.text) === target) return q;
  }
  // fuzzy: contains match on the first 40 chars
  const head = target.slice(0, 40);
  for (const q of pool) {
    if (norm(q.text).startsWith(head) || head.startsWith(norm(q.text).slice(0, 40))) return q;
  }
  // search aptitude/english banks too
  for (const q of [...aptitude, ...english]) {
    if (norm(q.text) === target) return q;
  }
  return null;
}
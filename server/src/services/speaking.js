import { aiEnabled, callAI } from './ai.js';

const FILLER_WORDS = ['um', 'uh', 'uhh', 'umm', 'like', 'basically', 'you know', 'actually', 'kind of', 'i mean', 'sort of', 'so yeah', 'right'];

// Heuristic evaluation of a spoken transcript. Honest, structured feedback.
export async function evaluateSpeaking(transcript, topic, durationSec = 60) {
  const text = String(transcript || '').trim();
  if (!text) {
    return {
      content: 0, structure: 0, fluency: 0, grammarScore: 0, vocabulary: 0, pronunciation: 60, overall: 0,
      fillerWords: [], fillerCount: 0, wpm: 0, wordCount: 0,
      didWell: [],
      needsImprovement: ['No speech was captured. Make sure your microphone is working and permissions are allowed.'],
      specificMistakes: ['No transcript available'],
      betterWay: 'Try speaking slowly and clearly into the microphone.',
      recommendation: 'Record your answer again. Speak for at least 10 seconds.',
    };
  }

  const words = text.toLowerCase().replace(/[.,!?]/g, ' ').split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const minutes = Math.max(durationSec / 60, 0.1);
  const wpm = wordCount / minutes;

  // Filler analysis
  const fillerCount = countFillers(text.toLowerCase());
  const fillerList = extractFillerList(text.toLowerCase());

  // Fluency: WPM targets ~120-150. Hesitant talkers naturally produce lower WPM.
  let fluency = 60;
  if (wpm >= 110 && wpm <= 180) fluency = 85;
  else if (wpm >= 80) fluency = 72;
  else if (wpm >= 50) fluency = 60;
  else if (wpm >= 25) fluency = 45;
  else fluency = 35;
  if (fillerCount > 0) fluency = Math.max(25, fluency - fillerCount * 2);

  // Structure heuristic: look for opening/conclusion markers
  const lower = text.toLowerCase();
  let structure = 35;
  if (/^(so|okay|good (morning|afternoon|evening)|hello|hi|thanks)/.test(lower)) structure += 15;
  if (/(in conclusion|to summarize|to sum up|finally|in short|overall|so basically|my project was|i worked on)/.test(lower)) structure += 20;
  if (/(first|second|third|then|next|furthermore|moreover|because|since|therefore)/.test(lower)) structure += 15;
  if (wordCount > 30) structure += 15;
  structure = Math.min(100, structure);

  // Content heuristic: topic keyword presence + length
  const topicWords = extractTopicKey(topic);
  let topicHits = 0;
  for (const t of topicWords) if (lower.includes(t)) topicHits += 1;
  const contentBase = Math.min(90, 35 + topicHits * 12 + Math.min(30, wordCount / 3));
  const content = aiEnabled() ? contentBase : contentBase;

  // Grammar heuristic: simple checks
  let grammarIssues = 0;
  if (/\bi am having\b/.test(lower)) grammarIssues += 1;
  if (/(?:is|are|was) a? (an|a) .* (?:much|many) /.test(lower)) grammarIssues += 0;
  if (/(don|doesn|didn|isn|aren|wasn|weren|haven|hasn) [^ ]*s\b/.test(lower)) grammarIssues += 1; // he don't → informal
  const grammarScore = Math.max(40, 80 - grammarIssues * 8);

  // Vocabulary: richness via unique word ratio + advanced-words bonus
  const uniqueRatio = new Set(words).size / Math.max(words.length, 1);
  let vocabulary = Math.round(40 + uniqueRatio * 40);
  if (/(implement|demonstrate|collaborate|analyze|optimize|enhance|solution|challenge|responsible|achieved|improved|designed|developed)/.test(lower)) vocabulary += 10;
  vocabulary = Math.min(100, vocabulary);

  // Pronunciation proxy (careful wording - we do not claim to truly measure pronunciation from text)
  const pronunciationBase = 60 + (fillerCount === 0 ? 20 : 10);

  // Overall
  const overall = Math.round(
    content * 0.25 + structure * 0.2 + fluency * 0.2 + grammarScore * 0.15 + vocabulary * 0.1 + pronunciationBase * 0.1
  );

  // Feedback generation
  const didWell = [];
  if (wordCount > 25) didWell.push('You produced a reasonably complete answer with enough content.');
  if (structure >= 65) didWell.push('Your answer had a clear structure (beginning, main points, closing).');
  if (fluency >= 72) didWell.push('Your delivery sounded reasonably fluent.');
  if (vocabulary >= 70) didWell.push('You used a good range of vocabulary.');
  if (!didWell.length) didWell.push('You attempted the answer - that is the first step.');

  const needsImprovement = [];
  if (fluency < 65) needsImprovement.push('Your delivery sounded hesitant in several places.');
  if (fillerCount > 3) needsImprovement.push(`You used ${fillerCount} filler words (like ${fillerList.slice(0, 3).join(', ') || 'um'}). Practice pausing silently instead.`);
  if (structure < 60) needsImprovement.push('Your answer was not structured enough for an interview. Use: opening point -> 2-3 supporting points -> conclusion.');
  if (topicHits === 0) needsImprovement.push('Your answer did not clearly cover the topic: ' + topic);
  if (wordCount < 15) needsImprovement.push('Your answer was too short. Aim to speak for at least 30-40 seconds on any topic.');

  const specificMistakes = [];
  if (/\bi am having\b/.test(lower)) specificMistakes.push('You said "I am having a doubt/difficulty". In professional English, say "I have a question" or "I found this challenging".');
  if (/(very very|really really)/.test(lower)) specificMistakes.push('You repeated "very/really" - this weakens impact. Use a precise word instead.');
  if (grammarIssues > 0) specificMistakes.push('I noticed a few grammar slips (subject-verb agreement). Review basic tenses before the interview.');

  const recommendation = buildRecommendation(overall, needsImprovement, topic);

  // Try LLM refinement when configured
  if (aiEnabled()) {
    try {
      const refined = await refineWithAI(text, topic);
      if (refined && refined.overall) {
        return {
          ...refined,
          fillerWords: fillerList,
          fillerCount,
          wpm: Math.round(wpm),
          wordCount,
          didWell: refined.didWell || didWell,
          needsImprovement: refined.needsImprovement || needsImprovement,
          specificMistakes: refined.specificMistakes || specificMistakes,
          betterWay: refined.betterWay || '',
          recommendation: refined.recommendation || recommendation,
        };
      }
    } catch (e) { /* fallback */ }
  }

  return {
    content: Math.round(content),
    structure: Math.round(structure),
    fluency: Math.round(fluency),
    grammarScore: Math.round(grammarScore),
    vocabulary: Math.round(vocabulary),
    pronunciation: positionBasedPronunciation(overall),
    overall: Math.max(20, Math.min(100, overall)),
    fillerWords: fillerList,
    fillerCount,
    wpm: Math.round(wpm),
    wordCount,
    didWell,
    needsImprovement,
    specificMistakes,
    betterWay: betterWaySection(specificMistakes),
    recommendation,
  };
}

function positionBasedPronunciation(overall) {
  // careful: only a proxy derived from transcript features, never presented as true audio analysis
  return 60 + Math.round((overall - 50) / 8);
}

function countFillers(lower) {
  let c = 0;
  for (const f of FILLER_WORDS) {
    const re = new RegExp(`\\b${f}\\b`, 'g');
    const m = lower.match(re);
    if (m) c += m.length;
  }
  return c;
}

function extractFillerList(lower) {
  const found = [];
  for (const f of FILLER_WORDS) {
    const re = new RegExp(`\\b${f}\\b`, 'g');
    if (re.test(lower)) found.push(f);
  }
  return found;
}

function extractTopicKey(topic) {
  return String(topic).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 3).slice(0, 6);
}

function buildRecommendation(overall, issues, topic) {
  if (overall >= 80) return `Strong attempt. Now polish it: practice on this topic (${topic}) once more at 2 minutes and add one specific example from your experience.`;
  if (issues.length) return `Practice recommendation: record this again. Before speaking, plan 3 bullet points in 20 seconds. Pause silently instead of using filler words. Then compare your two attempts.`;
  return `Keep practising daily. Use the timer, and re-record this topic (${topic}) until your structure score reaches 70+.`;
}

function betterWaySection(mistakes) {
  if (!mistakes.length) return '';
  return 'A better way to say it: ' + mistakes[0];
}

async function refineWithAI(transcript, topic) {
  const res = await callAI({
    temperature: 0.3,
    system: 'You are a strict speaking coach. Evaluate this student transcript. Return ONLY JSON with keys: content(0-100), structure(0-100), fluency(0-100), grammarScore(0-100), vocabulary(0-100), overall(0-100), didWell[array], needsImprovement[array] (honest, harsh when needed), specificMistakes[array], betterWay(string), recommendation(string). Use careful wording about confidence - describe delivery cues, not emotions.',
    user: JSON.stringify({ topic, transcript }),
  });
  return res;
}

// Topic templates used by the Speaking Lab (spec section 18)
export const TOPIC_SPEAKING_PROMPTS = [
  'Introduce yourself. Mention your name, branch, college, and one achievement.',
  'Why did you choose your branch? What excites you about it?',
  'Explain your final-year project in simple words.',
  'Why should we hire you? Give three reasons.',
  'Describe a challenge you faced and how you handled it.',
  'Explain a technical concept you love to a non-technical person.',
  'Tell me about a failure and what you learned from it.',
  'Describe a team project you worked on and your role in it.',
  'Where do you see yourself in five years?',
  'Talk about your strengths and one weakness you are working on.',
];

// Interview answer builder structure (spec section 42)
export function answerBuilderStructure() {
  return {
    question: 'Tell me about yourself.',
    structure: [
      { step: 'Present', detail: 'Current year, branch, college (1 line).' },
      { step: 'Education', detail: 'Academic highlights, CGPA if strong (1-2 lines).' },
      { step: 'Skills', detail: '2-3 key skills relevant to the job.' },
      { step: 'Project', detail: 'One project: problem, your role, result.' },
      { step: 'Strength', detail: 'One strength backed by an example.' },
      { step: 'Career goal', detail: 'Why this role/company and where you want to grow.' },
    ],
  };
}

export const SPEAKING_TOPIC_OPTIONS = {
  '30 sec': 30,
  '1 min': 60,
  '2 min': 120,
  '3 min': 180,
};
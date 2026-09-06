import { aiEnabled, callAI, askAI } from './ai.js';
import { getBranchBank } from '../data/banks/index.js';
import { hashString, mulberry32 } from './questionService.js';

// Mock interview engine. Cycles through interview stages, reacts to the
// student's answers via a follow-up engine (keyword-driven + LLM enriched).

export const INTERVIEW_STAGES = [
  { key: 'intro', label: 'Introduce yourself' },
  { key: 'branch_reason', label: 'Why this branch?' },
  { key: 'project', label: 'About your project' },
  { key: 'technical', label: 'Technical question' },
  { key: 'followup', label: 'Follow-up question' },
  { key: 'scenario', label: 'Practical scenario' },
  { key: 'tricky', label: 'Tricky question' },
  { key: 'hr', label: 'HR question' },
  { key: 'behavioral', label: 'Behavioral question' },
  { key: 'closing', label: 'Closing' },
];

const targetStages = (type) => {
  if (type === 'hr') return ['intro', 'strengths', 'weakness', 'why_company', 'failure', 'relocate', 'five_year', 'salary', 'closing'];
  return INTERVIEW_STAGES.map(s => s.key);
};

const STAGE_PROMPTS = {
  intro: 'Let\u2019s begin. Tell me a bit about yourself - your background, education, and what you are interested in.',
  branch_reason: 'Why did you choose {branch} as your branch? What drew you to it?',
  project: 'Tell me about a project you have worked on. What was the problem, your role, and the outcome?',
  technical: 'Here is a technical question for you:',
  followup: 'Let me dig deeper into what you just said.',
  scenario: 'Okay, here is a practical, real-world scenario for you:',
  tricky: 'Now a tricky one. Think carefully before answering:',
  hr: 'A quick HR question:',
  behavioral: 'Tell me about a time you faced a difficult situation and how you handled it.',
  closing: 'We are almost done. Do you have any questions for me? This is also being evaluated.',
  strengths: 'Tell me about your strengths.',
  weakness: 'What is your biggest weakness, and what are you doing about it?',
  why_company: 'Why should we hire you over other candidates?',
  failure: 'Tell me about a time you failed. What happened and what did you learn?',
  relocate: 'Are you willing to relocate or work in shifts?',
  five_year: 'Where do you see yourself five years from now?',
  salary: 'What are your salary expectations? (Answer honestly with reasoning.)',
};

export async function openInterview({ type = 'general', branch = 'CSE', profile = null, resume = null, projects = [], pressure = false, seed = null }) {
  const rng = typeof seed === 'number' || typeof seed === 'string'
    ? mulberry32(typeof seed === 'string' ? hashString(seed) : seed)
    : Math.random;
  const questionsByStage = {};
  const stages = targetStages(type);

  // Pre-compose stage content for deterministic ones
  for (const stage of stages) {
    questionsByStage[stage] = {
      stage,
      prompt: STAGE_PROMPTS[stage] || '',
    };
  }

  // Technical question pick (seeded per user/session)
  const bank = getBranchBank(branch);
  const randomTech = bank[Math.floor(rng() * bank.length)];
  questionsByStage.technical = {
    stage: 'technical',
    prompt: STAGE_PROMPTS.technical,
    question: {
      text: randomTech.text,
      difficulty: randomTech.difficulty,
      subject: randomTech.subject,
      topic: randomTech.topic,
      correctAnswer: randomTech.correctAnswer,
      explanation: randomTech.explanation,
      options: randomTech.options || [],
      qtype: randomTech.qtype,
    },
  };

  // Scenario/stage content
  questionsByStage.scenario = {
    stage: 'scenario',
    prompt: STAGE_PROMPTS.scenario,
    scenario: pickScenario(branch),
  };
  questionsByStage.tricky = {
    stage: 'tricky',
    prompt: STAGE_PROMPTS.tricky,
    question: {
      text: pickTricky(bank, rng),
      correctAnswer: pickTrickyAnswer(bank, rng),
      qtype: 'short',
    },
  };

  // Resume/project customizations
  if (type === 'resume' && resume) {
    const skills = safeParse(resume.skills);
    if (skills && skills.length) {
      questionsByStage.resume_skill = {
        stage: 'resume_skill',
        prompt: `Your resume lists ${skills[0]}. Tell me honestly: what did you actually do with it, and to what level?`,
      };
    }
  }
  if (type === 'project' && projects.length) {
    const p = projects[0];
    questionsByStage.project = {
      stage: 'project',
      prompt: `Tell me about "${p.title}". What was your exact contribution?`,
      project: p,
    };
  }

  return { stages, questionsByStage };
}

function safeParse(json, fallback = []) {
  try { const v = JSON.parse(json); return Array.isArray(v) ? v : fallback; } catch (e) { return fallback; }
}

function pickScenario(branch) {
  const scenarios = {
    EEE: 'A production factory motor is not starting. As an engineer on site, how would you troubleshoot it step by step?',
    CSE: 'A web application started returning 500 errors for some users after a release. How would you debug it?',
    ECE: 'A sensor module inside an industrial controller stopped giving readings. How would you diagnose the problem?',
    CIVIL: 'Fresh concrete on a site shows cracks the next morning after pouring. What could be the cause and how would you fix it?',
  };
  return scenarios[branch] || scenarios.CSE;
}

function pickTricky(bank, rng = Math.random) {
  const tricky = bank.filter((q) => q.difficulty >= 4);
  const q = tricky.length ? tricky[Math.floor(rng() * tricky.length)] : bank[0];
  return q.text;
}

function pickTrickyAnswer(bank, rng = Math.random) {
  const tricky = bank.filter((q) => q.difficulty >= 4);
  const q = tricky.length ? tricky[Math.floor(rng() * tricky.length)] : bank[0];
  return q.correctAnswer;
}

// Follow-up engine: react to the student's latest answer, optionally LLM-powered.
export async function generateFollowUp(branch, stage, studentAnswer, history = [], questionMeta = null) {
  const answer = String(studentAnswer || '').trim();
  const lower = answer.toLowerCase();

  // Deterministic follow-ups
  if (stage === 'project' || stage === 'resume_skill' || stage === 'followup') {
    if (/(capacitor|capacitance|pf|power factor)/.test(lower)) {
      return { stage: 'followup', prompt: 'Why capacitors for power factor correction specifically? What happens if you overcorrect the power factor?' };
    }
    if (/(matlab|simulink|spice|arduino|raspberry|sensor)/.test(lower)) {
      return { stage: 'followup', prompt: `You mentioned ${extractTech(lower)}. What communication protocols or interfaces did you work with while using it?` };
    }
    if (/(database|sql|mysql|mongodb|postgres)/.test(lower)) {
      return { stage: 'followup', prompt: 'How did you design the database for that? What would happen if you added an index to the most-used query?' };
    }
    if (/(api|rest|http|backend|server)/.test(lower)) {
      return { stage: 'followup', prompt: 'If that API suddenly got 10x the traffic, what would break first and how would you fix it?' };
    }
    if (/(machine|motor|induction|transformer)/.test(lower)) {
      return { stage: 'followup', prompt: 'Can you explain the working principle behind what you just mentioned in one or two sentences? Then tell me one common failure mode.' };
    }
    if (/(concrete|cement|civil|beam|slab)/.test(lower)) {
      return { stage: 'followup', prompt: 'What quality checks would you run on site for the material you mentioned?' };
    }
  }

  if (['introduction', 'intro'].includes(stage)) {
    return { stage: 'branch_reason', prompt: `Interesting. Why did you choose ${branch} specifically?` };
  }

  if (stage === 'technical' && questionMeta && wholeAnswerQuality(answer)) {
    return { stage: 'followup', prompt: 'Good. Now justify your answer - why is that the correct approach, and can you think of a case where it would fail?' };
  }

  // LLM-driven follow-up when available
  if (aiEnabled()) {
    try {
      const res = await callAI({
        temperature: 0.7,
        system: 'You are an interviewer on a follow-up question engine. Based on the student\'s last answer, generate ONE follow-up interview question that tests depth. Respond ONLY JSON: {"question":"...", "difficulty":1-5}',
        user: JSON.stringify({ branch, stage, studentAnswer: answer, previousContext: history.slice(-4) }),
      });
      if (res && res.question) return { stage: 'followup', prompt: res.question };
    } catch (e) { /* fallback */ }
  }

  // Generic depth follow-ups
  const fallback = [
    'Can you justify that answer? Why exactly?',
    'What would happen if the conditions you mentioned changed?',
    'How would you explain that same concept to a beginner?',
    'Can you give me a real example from your work or studies where this applied?',
    'What is the most common mistake people make on this, and how would you avoid it?',
  ][history.length % 5];

  return { stage: 'followup', prompt: fallback };
}

function extractTech(lower) {
  const match = lower.match(/\b(matlab|simulink|spice|arduino|raspberry|sensor|i2c|spi|uart|gpio|python|c\+\+|java|react|node)\b/);
  return match ? match[0] : 'that tool';
}

function wholeAnswerQuality(answer) {
  return answer.split(/\s+/).filter(Boolean).length > 12;
}

// Score a completed interview based on message evaluations + LLM summary
export async function scoreInterview(interview) {
  const studentMsgs = interview.messages.filter((m) => m.role === 'student' && m.evaluation);
  let sum = 0;
  for (const m of studentMsgs) {
    try { const ev = JSON.parse(m.evaluation); sum += (ev.score || 50); } catch (e) { sum += 50; }
  }
  const avg = studentMsgs.length ? sum / studentMsgs.length : 0;
  const lengthPenalty = studentMsgs.length < 3 ? 10 : 0;
  const finalScore = Math.max(20, Math.min(98, Math.round(avg - lengthPenalty)));
  return { score: finalScore, reviewed: studentMsgs.length };
}

// Evaluate a single interview answer from the student (subject + communication)
export async function evaluateInterviewAnswer(questionPrompt, answer, questionMeta) {
  if (aiEnabled()) {
    try {
      const res = await callAI({
        temperature: 0.3,
        system: 'Evaluate this mock-interview answer. Return ONLY JSON: {"score":0-100,"correctness":"good|average|weak","feedback":"honest 1-2 sentence assessment","improvement":"what exactly to improve"}',
        user: JSON.stringify({ question: questionPrompt, answer }),
      });
      if (res && typeof res.score === 'number') return res;
    } catch (e) { /* fallback */ }
  }

  const words = String(answer || '').trim().split(/\s+/).filter(Boolean).length;
  const hasStructure = /(first|second|third|because|so|in short|finally|my role|i did|i learned)/i.test(answer || '');
  const hasContent = words >= 12;
  const score = Math.round(Math.min(95, 20 + Math.min(50, words * 1.2) + (hasStructure ? 15 : 0) + (hasContent ? 10 : 0)));
  return {
    score,
    correctness: score >= 70 ? 'good' : score >= 45 ? 'average' : 'weak',
    feedback: score >= 70
      ? 'Solid, structured answer. Keep it concise and add a concrete example next time.'
      : score >= 45
        ? 'Decent, but needs sharper structure. Answer in this pattern: point, why, example.'
        : 'This answer was too short / vague. For interviews, give a structured reply: direct answer first, then explain, then a brief example.',
    improvement: score >= 70 ? 'Trim filler; practice with a timer.' : 'Rehearse a clear 3-point structure and slow down.',
  };
}
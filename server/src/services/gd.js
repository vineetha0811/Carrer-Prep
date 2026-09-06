import { aiEnabled, callAI } from './ai.js';

export const GD_TOPICS = [
  'Should artificial intelligence replace human jobs?',
  'Is online education better than offline education?',
  'Should electric vehicles completely replace ICE vehicles?',
  'Are internships necessary for final-year placements?',
  'Is coding the only skill that matters for IT placements?',
  'Should social media be regulated?',
  'Does technology make us more productive or more distracted?',
  'Is a high CGPA necessary for a successful career?',
  'Should college campuses be fully reopened after the pandemic?',
  'Is work-from-home the future of the workplace?',
  'Should internships be paid?',
  'Is freelancing a better career choice than a full-time job?',
  'Should startups prioritize profit over social impact?',
  'Is a four-day work week good for productivity?',
  'Should schools teach financial literacy from an early age?',
  'Is social media harming mental health?',
  'Should influencers be held accountable for their content?',
  'Are online exams as reliable as offline exams?',
  'Is sustainability more important than economic growth?',
  'Should single-use plastics be banned completely?',
  'Are electric vehicles really greener than petrol cars overall?',
  'Is remote learning widening the digital divide?',
  'Should AI be used to mark student exams?',
  'Are video games good for the brain?',
  'Is a college degree still worth the cost today?',
  'Should students take a gap year before university?',
  'Is group study more effective than studying alone?',
  'Should companies hire based on skills rather than degrees?',
  'Are gig economy jobs a stepping stone or a trap?',
  'Should surveillance cameras be allowed in student hostels?',
  'Is digital payment safer than cash?',
  'Should the government fund space exploration over social welfare?',
  'Are sports more about talent or hard work?',
  'Is nuclear energy the answer to climate change?',
];

export const GD_PARTICIPANTS = ['Participant A', 'Participant B', 'Participant C'];
export const MODERATOR = 'Moderator';

// Opening statements for the GD
export async function openGDSession(topic, kind = 'gd', side = null) {
  const messages = [];
  const opening = buildOpening(topic);
  messages.push({ speaker: MODERATOR, text: opening.moderator });

  if (kind === 'debate') {
    const opp = side === 'for' ? 'against' : 'for';
    messages.push({
      speaker: 'Participant A',
      text: opening.proAI,
    });
    messages.push({
      speaker: 'Participant B',
      text: opening.counter,
    });
    messages.push({
      speaker: MODERATOR,
      text: `You are debating ${side === 'for' ? 'in favor of' : 'against'} this statement. Please present your argument.`,
    });
  } else {
    messages.push({ speaker: 'Participant A', text: opening.proAI });
    messages.push({ speaker: 'Participant B', text: opening.counter });
    messages.push({ speaker: 'Participant C', text: opening.third });
    messages.push({
      speaker: MODERATOR,
      text: 'Now let\u2019s hear from everyone. Please share your views - join the discussion.',
    });
  }
  return messages;
}

function buildOpening(topic) {
  return {
    moderator: `Welcome everyone. Today\u2019s group discussion topic: "${topic}". I\u2019ll start by inviting Participant A to present their view.`,
    proAI: `I believe this is one of the most important trends we must understand. The technology is growing fast, and those who learn to work with it will benefit most.`,
    counter: `I see a different side. While the technology is powerful, there are many practical and ethical concerns that we cannot ignore.`,
    third: `I think the real answer lies somewhere in between - it depends on how the technology is adopted and whether we are prepared for it.`,
  };
}

// Advance the GD: AI participants respond to the student's last statement and challenge them.
export async function advanceGD(session, studentLastMessage, history = [], turn = 0) {
  const oppositeSpeaker = GD_PARTICIPANTS[turn % 3];
  const reactions = [
    'Interesting point. But what evidence do you have for that claim?',
    'I understand your logic, but consider the counterargument: what if the opposite happens in practice?',
    'I partially disagree. You mentioned "{kw}" - can you explain why that is relevant to this topic?',
    'That is a narrow view. Please consider the broader impact on society and the economy.',
  ];

  // Keyword-based challenge
  const topicLower = session.topic.toLowerCase();
  let nextMessage;

  if (aiEnabled()) {
    try {
      const res = await callAI({
        temperature: 0.8,
        system: 'You are one participant in a group discussion with a student. Your role is to disagree, counter-argue, or challenge the student\'s point when the discussion gets one-sided. Keep responses to 1-3 sentences, natural, conversational.',
        user: JSON.stringify({ topic: session.topic, kind: session.kind === 'debate' ? 'debate (opposing the student)' : 'group discussion', studentLastMessage, history: history.slice(-4), turn }),
      });
      if (res && res.message) {
        nextMessage = res.message;
      }
    } catch (e) { /* fallback */ }
  }

  if (!nextMessage) {
    const idx = Math.min(turn, reactions.length - 1);
    let reaction = reactions[idx];
    const kw = extractKeyword(studentLastMessage);
    if (kw && reactions[idx].includes('{kw}')) reaction = reaction.replace('{kw}', kw);
    nextMessage = reaction;
  }

  if (session.kind === 'debate') {
    return { speaker: 'AI Opponent', text: nextMessage };
  }
  return { speaker: oppositeSpeaker, text: nextMessage };
}

export function extractKeyword(text) {
  const m = String(text || '').match(/\b[a-zA-Z]{6,}\b/g);
  if (!m) return '';
  const stop = new Set(['because', 'should', 'could', 'would', 'really', 'people', 'things', 'think', 'technology', 'important']);
  const kw = m.filter((w) => !stop.has(w.toLowerCase()));
  return kw.length ? kw[0].toLowerCase() : '';
}

// Final summary evaluation of the GD/debate session
export async function summarizeGD(history, kind = 'gd') {
  const studentMsgs = history.filter((h) => h.speaker === 'student' && h.text);
  const totalWords = studentMsgs.reduce((s, h) => s + h.text.split(/\s+/).filter(Boolean).length, 0);
  const hasConclusion = studentMsgs.some((h) => /(in conclusion|to conclude|to summarize|finally|in short|overall)/i.test(h.text));
  const logicIndicators = studentMsgs.some((h) => /(because|therefore|since|for example|for instance|evidence|data|studies|however)/i.test(h.text));

  const score = Math.round(
    Math.min(95, 30
      + Math.min(25, totalWords / 8)
      + (logicIndicators ? 20 : 0)
      + (hasConclusion ? 15 : 0)
      + (studentMsgs.length >= 3 ? 10 : 0))
  );

  return {
    score,
    summary: `You spoke ${studentMsgs.length} times and about ${totalWords} words.`,
    strengths: [
      logicIndicators ? 'You supported claims with reasoning/evidence - good for GD.' : '',
      studentMsgs.length >= 2 ? 'You participated more than once - initiative matters in a GD.' : '',
      hasConclusion ? 'You brought a summary/conclusion - very strong.' : '',
    ].filter(Boolean),
    weaknesses: [
      !logicIndicators ? 'Many of your points were opinions without backup. Use "because", "for example" and real evidence.' : '',
      !hasConclusion ? 'You did not close your argument. End with a clear 1-2 line conclusion.' : '',
      totalWords < 80 ? 'You spoke too little. In a real GD you need to contribute around 3-5 quality points.' : '',
      studentMsgs.length < 2 ? 'You stayed quiet. Interject politely but do participate at least twice.' : '',
    ].filter(Boolean),
  };
}
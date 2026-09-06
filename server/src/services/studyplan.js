import { aiEnabled, callAI } from './ai.js';

// Build a personalized roadmap for 30/45/60-day plans (spec section 35)
export function generateRoadmap({ planDays = 30, goals = [], branch = 'CSE', weakTopics = [], baseline = null }) {
  const weeks = Math.ceil(planDays / 7);

  const phaseTemplate = [
    { phase: 'Foundation + baseline assessment', focus: ['Complete baseline assessment', 'Cover fundamentals of your core subjects', 'Aptitude basics and percentages'] },
    { phase: 'Core concepts', focus: ['Deep-dive into main subjects of your branch', 'Syllabus-aligned technical topics', 'Reasoning + data interpretation practice'] },
    { phase: 'Application + tricky questions', focus: ['Application-level and tricky questions', 'Practical engineering scenarios', 'Full mock technical rounds'] },
    { phase: 'Interview questions', focus: ['Technical interview questions', 'HR + behavioral preparation', 'Answer building for "Tell me about yourself"'] },
    { phase: 'Speaking + mock interviews', focus: ['Speaking Lab daily practice', 'Mock interviews (general → resume → project)', 'Group discussion + debate practice'] },
    { phase: 'Weak-area revision', focus: (weakTopics.length ? ['Revise: ' + weakTopics.slice(0, 4).map(w => w.topic).join(', ') + ' (your detected weak areas)'] : ['Revise your lowest-scoring topics using spaced repetition']) },
    { phase: 'Full mock placement day', focus: ['Complete placement simulation (aptitude → technical → communication → HR → final interview)', 'Performance report + final plan adjustments'] },
  ];

  const roadmap = [];
  for (let w = 1; w <= weeks; w++) {
    const idx = Math.min(phaseTemplate.length - 1, Math.floor(((w - 1) / weeks) * phaseTemplate.length));
    roadmap.push({
      week: w,
      title: `Week ${w}`,
      phase: phaseTemplate[idx].phase,
      focus: phaseTemplate[idx].focus,
      goal: `Complete all daily assignments in week ${w}`,
    });
  }

  return roadmap;
}

// Generate a study plan record + roadmap
export async function createStudyPlan(userId, { planDays, goals, branch, weakTopics, baseline }) {
  const roadmap = generateRoadmap({ planDays, goals, branch, weakTopics, baseline });
  return { planDays, weeks: roadmap.length, roadmap };
}

export async function generateWeeklyReport(userId, weekNumber) {
  // Compute weekly stats
  return { weekNumber };
}
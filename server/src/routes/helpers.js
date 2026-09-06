import prisma from '../prisma.js';

export async function getProfileSummary(userId) {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });
  if (!profile) {
    // Fresh account before onboarding has no profile row yet.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    });
    if (!user) return null;
    return {
      id: user.id,
      userId: user.id,
      name: user.name,
      email: user.email,
      college: null,
      location: null,
      graduationYear: null,
      branch: null,
      semester: null,
      cgpa: null,
      backlogs: null,
      preferredJob: null,
      goals: [],
      profilePhoto: null,
      confidence: 1,
      planLengthDays: null,
      dailyMinutes: 30,
      onboardingDone: false,
      baselineTaken: false,
      startDate: null,
    };
  }
  return {
    id: profile.id,
    userId: profile.userId,
    name: profile.user.name,
    email: profile.user.email,
    college: profile.college,
    location: profile.location,
    graduationYear: profile.graduationYear,
    branch: profile.branch,
    semester: profile.semester,
    cgpa: profile.cgpa,
    backlogs: profile.backlogs,
    preferredJob: profile.preferredJob,
    goals: safeParse(profile.goals),
    profilePhoto: profile.profilePhoto,
    confidence: safeParse(profile.confidence),
    planLengthDays: profile.planLengthDays,
    dailyMinutes: profile.dailyMinutes,
    onboardingDone: profile.onboardingDone,
    baselineTaken: profile.baselineTaken,
    startDate: profile.startDate,
  };
}

export function safeParse(json, fallback = []) {
  try {
    const v = JSON.parse(json || 'null');
    return v === null || v === undefined ? fallback : v;
  } catch (e) {
    return fallback;
  }
}

export function todayStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
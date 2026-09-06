import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { request } from '../services/api.js';
import { Card, Badge, ProgressBar, Loading, EmptyState, Stat, Spinner } from '../components/ui.jsx';

const SECTIONS = [
  { key: 'technicalDone', label: 'Technical Challenge' },
  { key: 'aptitudeDone', label: 'Aptitude & Reasoning' },
  { key: 'englishDone', label: 'English / Grammar' },
  { key: 'speakingDone', label: 'Speaking Practice' },
  { key: 'interviewDone', label: 'Interview' },
];

const MODULES = [
  { to: '/practice', title: 'Technical Practice', desc: 'Core subjects, coding concepts & real-world problems', icon: bolt },
  { to: '/aptitude', title: 'Aptitude & Reasoning', desc: 'Quants, logical & verbal reasoning drills', icon: brain },
  { to: '/english', title: 'English / Grammar', desc: 'Fill-in-the-blanks, sentence correction & comprehension', icon: book },
  { to: '/speaking', title: 'Speaking Lab', desc: 'Practice talking with instant, honest feedback', icon: mic },
  { to: '/interview', title: 'Mock Interview', desc: 'Full mock interviews with AI interviewer', icon: chat },
  { to: '/gd', title: 'GD / Debate', desc: 'Group discussions and debates, solo practice mode', icon: users },
  { to: '/syllabus', title: 'My Syllabus', desc: 'Upload papers, see your curriculum topics live', icon: file },
  { to: '/resume', title: 'Resume & Projects', desc: 'Upload resumes, prep project-based questions', icon: doc },
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [quick, setQuick] = useState(null);
  const [buildingQuick, setBuildingQuick] = useState(false);
  const [quickError, setQuickError] = useState('');
  const [showQuick, setShowQuick] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [s, p] = await Promise.all([
          request('/assignment/status'),
          request('/progress'),
        ]);
        setStatus(s);
        setProgress(p);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function buildQuick() {
    setBuildingQuick(true);
    setQuickError('');
    try {
      const data = await request('/assignment/quick', { method: 'POST' });
      sessionStorage.setItem('cr_quick', JSON.stringify(data.assignment));
      setQuick(data.assignment);
      setShowQuick(true);
    } catch (e) {
      setQuickError(e.message);
    } finally {
      setBuildingQuick(false);
    }
  }

  const dayNumber = status?.dayNumber || 1;
  const readiness = status?.readiness || progress?.readiness;
  const readyScore = readiness?.score ?? 0;
  const readyLevel = readiness?.level || (readyScore === 0 ? 'Just Starting' : readyScore >= 75 ? 'Strong' : readyScore >= 50 ? 'Moderate' : 'Building');
  const r = 42; const circ = 2 * Math.PI * r;
  const dash = (readyScore / 100) * circ;
  const progressRow = status?.progress || {};
  const tasksDone = SECTIONS.filter((s) => progressRow[s.key]).length;
  const weak = (progress?.weakAreas || []).slice(0, 5);
  const totals = progress?.totals || { attempted: 0, correct: 0 };

  if (error) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center">
        <h1 className="text-lg font-bold text-slate-900">Couldn't load your dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">{error}</p>
        <button className="btn-primary mt-4" onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  if (loading) return <Loading label="Loading your readiness…" />;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Greeting */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Hi {user?.name?.split(' ')[0] || 'there'} 👋
          </h1>
          <p className="text-sm text-slate-500">Day {dayNumber} of your placement sprint. Let's get better today.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone="blue">{dayNumber} days in</Badge>
          {progress?.streak ? <Badge tone="amber">🔥 {progress.streak}-day streak</Badge> : null}
        </div>
      </div>

      {/* Hero + readiness */}
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 p-6 text-white shadow-lg lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">Today's Assignment</h2>
              <p className="mt-1 max-w-md text-sm text-primary-100">
                Adaptive to your syllabus, weak areas and daily time budget. Finish it to keep your streak.
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button className="rounded-lg bg-white px-5 py-2.5 text-sm font-bold text-primary-700 shadow hover:bg-primary-50" onClick={() => navigate('/assignment')}>
                  {tasksDone >= 5 ? 'Review Today' : 'Start Assignment →'}
                </button>
                <button className="rounded-lg border border-white/30 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10" onClick={buildQuick} disabled={buildingQuick}>
                  {buildingQuick ? <Spinner size={15} className="text-white" /> : '10-min Quick Practice'}
                </button>
                <Link to="/assignments" className="rounded-lg border border-white/30 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10">Past Assignments</Link>
              </div>
              {quickError && <p className="mt-2 text-xs text-red-200">{quickError}</p>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {SECTIONS.map((s) => {
                const done = Boolean(progressRow[s.key]);
                return (
                  <div key={s.key} className={`rounded-xl px-3 py-2 text-center text-[11px] font-semibold ${done ? 'bg-emerald-500/30 text-emerald-100' : 'bg-white/10 text-primary-100'}`}>
                    {done ? '✓ ' : ''}{s.label.split(' ')[0]}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="card flex items-center gap-4 p-5">
          <div className="relative" style={{ width: 104, height: 104 }}>
            <svg width="104" height="104" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r={r} fill="none" stroke="#e2e8f0" strokeWidth="9" />
              <circle
                cx="50" cy="50" r={r} fill="none"
                stroke={readyScore >= 70 ? '#10b981' : readyScore >= 40 ? '#f59e0b' : '#ef4444'}
                strokeWidth="9" strokeLinecap="round"
                strokeDasharray={`${dash} ${circ}`}
                transform="rotate(-90 50 50)"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-extrabold text-slate-900">{readyScore}</span>
              <span className="text-[10px] text-slate-400">Readiness</span>
            </div>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-800">{readyLevel}</p>
            <p className="mt-0.5 text-xs text-slate-500">Overall placement readiness score</p>
            <p className="mt-2 text-xs text-slate-400">{totals.attempted} attempted · {totals.correct} correct</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Questions" value={totals.attempted} tone="blue" />
        <Stat label="Accuracy" value={totals.attempted ? Math.round((totals.correct / totals.attempted) * 100) : 0} suffix="%" tone="green" />
        <Stat label="Speaking Avg" value={progress?.speaking?.avg ?? 0} tone="purple" />
        <Stat label="Interview Avg" value={progress?.interviews?.avg ?? 0} tone="amber" />
        <Stat label="GD Sessions" value={progress?.gdCount ?? 0} tone="slate" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Weak areas */}
        <Card className="lg:col-span-1">
          <h3 className="text-sm font-bold text-slate-900">Today's Focus Areas</h3>
          <p className="mt-0.5 text-xs text-slate-500">Derived from your recent accuracy</p>
          <div className="mt-4 space-y-4">
            {weak.length === 0 && <EmptyState icon="🎯" title="No focus areas yet" subtitle="Solve a few questions to unlock personalized focus areas." />}
            {weak.map((w) => (
              <div key={w.topic}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600">{w.topic}</span>
                  <span className={`font-bold ${w.accuracy >= 70 ? 'text-emerald-600' : w.accuracy >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{w.accuracy}%</span>
                </div>
                <ProgressBar value={w.accuracy} color={w.accuracy >= 70 ? 'bg-emerald-500' : w.accuracy >= 50 ? 'bg-amber-500' : 'bg-red-500'} />
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Link to="/practice" className="btn-outline w-full">Practice These →</Link>
          </div>
        </Card>

        {/* Modules */}
        <div className="lg:col-span-2">
          <h3 className="mb-3 text-sm font-bold text-slate-900">Jump Into Practice</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {MODULES.map((m) => (
              <Link key={m.to} to={m.to} className="card group flex items-start gap-3 p-4 transition-shadow hover:shadow-md">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-600">{m.icon()}</span>
                <span>
                  <span className="block text-sm font-bold text-slate-800 group-hover:text-primary-700">{m.title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{m.desc}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Plan banner */}
      <div className="card flex flex-wrap items-center justify-between gap-3 border-primary-100 bg-primary-50/60 p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6" /></svg>
          </span>
          <div>
            <p className="text-sm font-bold text-slate-800">{progress?.profile?.planLengthDays || 60}-Day Placement Plan</p>
            <p className="text-xs text-slate-500">Your plan personalizes as you practice — review it on the Progress page.</p>
          </div>
        </div>
        <Link to="/progress" className="btn-outline">View Plan & Report</Link>
      </div>

      {/* Quick practice modal */}
      {showQuick && quick && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setShowQuick(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl">⚡</div>
            <h3 className="mt-3 text-lg font-bold text-slate-900">Quick practice ready!</h3>
            <p className="mt-1 text-sm text-slate-500">
              {quick.estimatedMinutes} min · {quick.sections.reduce((s, x) => s + (x.count || (x.speakingChallenge ? 1 : 0)) + (x.interview ? 1 : 0), 0)} tasks ·
              {quick.sections.map((x) => ' ' + x.label).join(',')}
            </p>
            <div className="mt-5 flex justify-center gap-2">
              <button className="btn-outline" onClick={() => setShowQuick(false)}>Later</button>
              <button className="btn-primary" onClick={() => navigate('/assignment?quick=1')}>Start Now</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function bolt() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5z" /></svg>; }
function brain() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 4a3 3 0 0 0-3-3 3 3 0 0 0-2.5 4.6A3 3 0 0 0 4 8a3 3 0 0 0 2 2.8V15a3 3 0 0 0 4 2.8V21a1 1 0 0 0 2 0z" /></svg>; }
function book() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zm0 0a2 2 0 0 0 2 2h13" /></svg>; }
function mic() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v4" /></svg>; }
function chat() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z" /></svg>; }
function users() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm7-2a4 4 0 1 0 0-6 4 4 0 0 0 0 6z" /></svg>; }
function file() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h6" /></svg>; }
function doc() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></svg>; }
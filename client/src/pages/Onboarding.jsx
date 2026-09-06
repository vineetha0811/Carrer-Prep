import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { request } from '../services/api.js';
import { Spinner } from '../components/ui.jsx';

const BRANCHES = [
  { code: 'CSE', label: 'Computer Science & Engineering' },
  { code: 'ECE', label: 'Electronics & Communication Engg.' },
  { code: 'EEE', label: 'Electrical & Electronics Engg.' },
  { code: 'CIVIL', label: 'Civil Engineering' },
];

const JOBS = [
  'Software Developer', 'Data Analyst', 'Full-Stack Engineer', 'Core / Hardware Engineer',
  'Embedded Engineer', 'Product Support Engineer', 'NETWORK/IT Engineer', 'Analyst / Consultant',
  'Any software role', 'Not sure yet',
];

const CONFIDENCE = [
  { label: 'Novice', v: 1 },
  { label: 'Beginner', v: 2 },
  { label: 'Intermediate', v: 3 },
  { label: 'Confident', v: 4 },
  { label: 'Expert', v: 5 },
];

const GOALS = [
  'Aptitude & Reasoning',
  'Core Technical Subjects',
  'DSA & Coding',
  'Communication & English',
  'Group Discussion',
  'Mock Interviews & HR',
  'Resume Building',
  'Projects & Practical Skills',
];

const PLANS = [
  { days: 30, label: '30 days', sub: 'Intensive sprint' },
  { days: 60, label: '60 days', sub: 'Standard' },
  { days: 90, label: '90 days', sub: 'Relaxed & thorough' },
];

const MINUTES = [20, 30, 40, 60];

export default function Onboarding() {
  const { user, refresh } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savingBase, setSavingBase] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    college: user?.college || '',
    location: user?.location || '',
    graduationYear: user?.graduationYear || new Date().getFullYear() + 1,
    branch: user?.branch || '',
    semester: user?.semester || 7,
    cgpa: user?.cgpa ?? '',
    backlogs: user?.backlogs ?? 0,
    preferredJob: user?.preferredJob || '',
    goals: user?.goals?.length ? user.goals : ['Mock Interviews & HR'],
    confidence: user?.confidence || 2,
    planLengthDays: user?.planLengthDays || 60,
    dailyMinutes: user?.dailyMinutes || 30,
  });

  const [baseline, setBaseline] = useState(null); // questions loaded
  const [bIdx, setBIdx] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [review, setReview] = useState(null); // post-baseline feedback

  function set(patch) { setForm((f) => ({ ...f, ...patch })); }

  async function saveProfile(extra = {}) {
    const body = {
      college: form.college, location: form.location, graduationYear: form.graduationYear,
      branch: form.branch, semester: form.semester,
      cgpa: form.cgpa === '' ? null : Number(form.cgpa),
      backlogs: Number(form.backlogs || 0),
      preferredJob: form.preferredJob, goals: form.goals, confidence: form.confidence,
      planLengthDays: Number(form.planLengthDays), dailyMinutes: Number(form.dailyMinutes),
      ...extra,
    };
    await request('/profile', { method: 'PATCH', body });
    await refresh();
  }

  const canForward = step === 0
    ? form.branch
    : step === 1 ? form.preferredJob && form.goals.length > 0 : true;

  async function nextStep() {
    if (step === 1) {
      setSaving(true); setError('');
      try { await saveProfile(); setStep(2); } catch (e) { setError(e.message); } finally { setSaving(false); }
      return;
    }
    if (step === 2) {
      setStep(3);
      // pre-generate baseline
      try {
        const { baseline: b } = await request('/assignment/baseline', { method: 'POST' });
        setBaseline([...(b.technical || []), ...(b.aptitude || []), ...(b.english || [])]);
      } catch (e) { setBaseline([]); }
      return;
    }
    setStep(step + 1);
  }

  async function submitBaseline(resultsOverride) {
    setSavingBase(true); setError('');
    try {
      const results = (resultsOverride || answers).filter(Boolean).map((a) => ({
        category: a.category, subject: a.subject, topic: a.topic,
        difficulty: a.difficulty, userAnswer: a.userAnswer,
        text: a.text,
        isCorrect: a.isCorrect, correctness: a.correctness, score: a.score,
      }));
      const data = await request('/profile/baseline', { method: 'POST', body: { results } });
      setReview(Array.isArray(data.review) ? data.review : []);
    } catch (e) { setError(e.message); } finally { setSavingBase(false); }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <span className="flex items-center gap-2 font-extrabold text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-600 text-white">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 17V9m6 8V5m6 12v-8m6 8V3" /></svg>
            </span>
            CampusReady AI
          </span>
          <div className="flex items-center gap-1.5">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={`h-1.5 w-8 rounded-full ${i <= step ? 'bg-primary-600' : 'bg-slate-200'}`} />
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8">
        {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        {step === 0 && (
          <Section
            title="Let's start with your profile"
            sub="This keeps your prep focused and real."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="College / University">
                <input className="input" value={form.college} onChange={(e) => set({ college: e.target.value })} placeholder="e.g. Anna University" />
              </Field>
              <Field label="City / Location">
                <input className="input" value={form.location} onChange={(e) => set({ location: e.target.value })} placeholder="e.g. Chennai" />
              </Field>
              <Field label="Graduation year">
                <input className="input" type="number" value={form.graduationYear} onChange={(e) => set({ graduationYear: +e.target.value })} />
              </Field>
              <Field label="Current semester">
                <select className="input" value={form.semester} onChange={(e) => set({ semester: +e.target.value })}>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Branch" className="mt-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {BRANCHES.map((b) => (
                  <button
                    key={b.code}
                    onClick={() => set({ branch: b.code })}
                    className={`rounded-xl border px-4 py-3 text-left ${form.branch === b.code ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                  >
                    <span className="block text-sm font-bold text-slate-800">{b.code}</span>
                    <span className="block text-xs text-slate-500">{b.label}</span>
                  </button>
                ))}
              </div>
            </Field>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="CGPA (optional)">
                <input className="input" type="number" step="0.01" min="0" max="10" value={form.cgpa} onChange={(e) => set({ cgpa: e.target.value })} placeholder="e.g. 8.2" />
              </Field>
              <Field label="Backlogs (optional)">
                <input className="input" type="number" min="0" value={form.backlogs} onChange={(e) => set({ backlogs: +e.target.value })} placeholder="0" />
              </Field>
            </div>
          </Section>
        )}

        {step === 1 && (
          <Section
            title="What are you targeting?"
            sub="We use this to shape your daily plan. Not sure? Pick what feels closest."
          >
            <Field label="Preferred job role">
              <div className="grid gap-2 sm:grid-cols-2">
                {JOBS.map((j) => (
                  <button
                    key={j}
                    onClick={() => set({ preferredJob: j })}
                    className={`rounded-lg border px-3 py-2.5 text-left text-sm font-medium ${form.preferredJob === j ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    {j}
                  </button>
                ))}
              </div>
            </Field>

            <Field label="What do you want to work on most? (select all that apply)" className="mt-4">
              <div className="grid gap-2 sm:grid-cols-2">
                {GOALS.map((g) => {
                  const on = form.goals.includes(g);
                  return (
                    <button
                      key={g}
                      onClick={() => set({ goals: on ? form.goals.filter((x) => x !== g) : [...form.goals, g] })}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-sm font-medium ${on ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                      <span className={`flex h-4 w-4 items-center justify-center rounded border ${on ? 'border-primary-500 bg-primary-600' : 'border-slate-300'}`}>
                        {on && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>}
                      </span>
                      {g}
                    </button>
                  );
                })}
              </div>
              {form.goals.length > 0 && <p className="mt-2 text-xs text-slate-400">{form.goals.length} area{form.goals.length > 1 ? 's' : ''} selected</p>}
            </Field>

            <Field label="How comfortable are you with placement topics right now?" className="mt-4">
              <div className="grid grid-cols-5 gap-2">
                {CONFIDENCE.map((c) => (
                  <button
                    key={c.v}
                    onClick={() => set({ confidence: c.v })}
                    className={`rounded-lg border py-2 text-center text-xs font-semibold ${form.confidence === c.v ? 'border-primary-500 bg-primary-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </Field>
          </Section>
        )}

        {step === 2 && (
          <Section
            title="Set your prep rhythm"
            sub="You can change this anytime in Settings."
          >
            <Field label="Plan length">
              <div className="grid gap-2 sm:grid-cols-3">
                {PLANS.map((p) => (
                  <button
                    key={p.days}
                    onClick={() => set({ planLengthDays: p.days })}
                    className={`rounded-xl border p-4 text-left ${form.planLengthDays === p.days ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200' : 'border-slate-200 bg-white hover:bg-slate-50'}`}
                  >
                    <span className="block text-sm font-bold text-slate-800">{p.label}</span>
                    <span className="block text-xs text-slate-500">{p.sub}</span>
                  </button>
                ))}
              </div>
            </Field>

            <Field label="Daily practice time" className="mt-4">
              <div className="grid grid-cols-4 gap-2">
                {MINUTES.map((m) => (
                  <button
                    key={m}
                    onClick={() => set({ dailyMinutes: m })}
                    className={`rounded-lg border py-3 text-center text-sm font-bold ${form.dailyMinutes === m ? 'border-primary-500 bg-primary-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    {m} min
                  </button>
                ))}
              </div>
            </Field>
          </Section>
        )}

        {step === 3 && (
          <Section
            title={review ? 'Your baseline review' : 'Quick baseline check'}
            sub={review
              ? 'See where you did well and where you slipped — with the right answers.'
              : 'Answer a few questions so we can personalize your very first assignment. No pressure — guessing is fine.'}
            badge={!review && baseline && baseline.length > 0 ? `${bIdx + 1} / ${baseline.length}` : null}
          >
            {review ? (
              <div className="space-y-3">
                <p className="text-sm text-slate-600">
                  You got <span className="font-bold text-emerald-600">{review.filter((r) => r.isCorrect).length}</span> of{' '}
                  <span className="font-bold text-slate-800">{review.length}</span> questions right.
                </p>
                {review.map((r, i) => (
                  <BaselineReviewItem key={i} review={r} index={i} />
                ))}
                <div className="flex justify-center pt-2">
                  <button className="btn-primary" onClick={() => navigate('/', { replace: true })}>Go to Dashboard →</button>
                </div>
              </div>
            ) : !baseline ? (
              <div className="flex items-center justify-center gap-3 py-16 text-slate-500"><Spinner size={22} /> Building your baseline…</div>
            ) : baseline.length === 0 ? (
              <div className="rounded-xl bg-white p-6 text-center">
                <p className="text-sm text-slate-500">Baseline could not be generated. We'll start a normal assignment instead.</p>
                <button className="btn-primary mt-4" onClick={() => navigate('/', { replace: true })}>Go to Dashboard →</button>
              </div>
            ) : (
              <BaselineQuestion
                q={baseline[bIdx]}
                onAnswer={(answer, correct, correctness, score) => {
                  const entry = {
                    category: baseline[bIdx].category || 'technical',
                    subject: baseline[bIdx].subject, topic: baseline[bIdx].topic || 'general',
                    difficulty: baseline[bIdx].difficulty || 2,
                    text: baseline[bIdx].text,
                    userAnswer: answer, isCorrect: correct, correctness, score,
                  };
                  const next = [...answers]; next[bIdx] = entry; setAnswers(next);
                  if (bIdx + 1 < baseline.length) setBIdx(bIdx + 1);
                  else submitBaseline(next);
                }}
                isLast={bIdx + 1 >= baseline.length}
                saving={savingBase}
              />
            )}
          </Section>
        )}

        {step < 3 && (
          <div className="mt-8 flex justify-between">
            {step > 0 && <button className="btn-outline" onClick={() => setStep(step - 1)}>← Back</button>}
            <button className="btn-primary ml-auto" onClick={nextStep} disabled={!canForward || saving}>
              {saving ? <Spinner size={16} className="text-white" /> : step === 2 ? 'Continue →' : 'Next →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ title, sub, children, badge }) {
  return (
    <div>
      <div className="mb-5 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{sub}</p>
        </div>
        {badge && <span className="chip bg-primary-50 text-primary-700">{badge}</span>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children, className = '' }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/^\s*[A-Da-d]\s*[.):]\s*/, '')
    .replace(/[.。]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function BaselineQuestion({ q, onAnswer, isLast, saving }) {
  const [chosen, setChosen] = useState(null);          // single select
  const [multi, setMulti] = useState([]);              // multi select
  const [typed, setTyped] = useState('');              // text/number input
  const options = Array.isArray(q.options) ? q.options : [];
  const isMulti = q.qtype === 'multi';
  const isSingle = options.length > 0 && !isMulti;
  const isTyped = q.qtype === 'fillblank' || q.qtype === 'numerical';
  const isOpen = !options.length && !isTyped;

  const ready = isSingle ? chosen !== null : isMulti ? multi.length > 0 : typed.trim() !== '';

  function toggleOpt(opt) {
    if (multi.includes(opt)) setMulti(multi.filter((o) => o !== opt));
    else setMulti([...multi, opt]);
  }

  // The baseline is a self-check diagnostic: option types are graded against the
  // correct answer, numeric/blank keywords are matched loosely, and open-ended
  // answers are recorded as self-assessed instead of fabricating a score.
  function grade() {
    if (isSingle) {
      const correct = normalize(chosen) === normalize(q.correctAnswer);
      return { answer: chosen, isCorrect: correct, correctness: correct ? 'correct' : 'incorrect', score: correct ? 60 : 20 };
    }
    if (isMulti) {
      const answer = multi.join(', ');
      const right = (String(q.correctAnswer).split(/[,;]/).map(normalize).filter(Boolean).sort().join('|'));
      const got = multi.map(normalize).sort().join('|');
      const correct = right === got;
      return { answer, isCorrect: correct, correctness: correct ? 'correct' : 'incorrect', score: correct ? 60 : 20 };
    }
    if (isTyped) {
      const goal = normalize(q.correctAnswer);
      const given = normalize(typed);
      const correct = given.length > 0 && (given === goal || given.includes(goal) || goal.includes(given));
      return { answer: typed, isCorrect: correct, correctness: correct ? 'correct' : 'incorrect', score: correct ? 60 : 20 };
    }
    return { answer: typed, isCorrect: false, correctness: 'self', score: 10 };
  }

  function submit() {
    const r = grade();
    onAnswer(r.answer, r.isCorrect, r.correctness, r.score);
  }

  function skip() {
    onAnswer('SKIPPED', false, 'skip', 0);
  }

  return (
    <div className="card p-5">
      <div className="mb-2 flex flex-wrap gap-2">
        {q.subject && <span className="chip bg-primary-50 text-primary-700">{q.subject}</span>}
        {q.topic && <span className="chip bg-slate-100 text-slate-600">{q.topic}</span>}
        {q.difficulty && <span className="chip bg-slate-100 text-slate-600">Level {q.difficulty}</span>}
        <span className="chip bg-slate-100 text-slate-500">{q.qtype}</span>
      </div>
      <p className="text-[15px] font-semibold text-slate-900">{q.text}</p>
      <div className="mt-4">
        {isSingle && (
          <div className="space-y-2.5">
            {options.map((opt, i) => (
              <button
                key={i}
                onClick={() => setChosen(opt)}
                className={`flex w-full gap-3 rounded-lg border px-4 py-3 text-left text-sm ${chosen === opt ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <span className="font-semibold text-slate-400">{String.fromCharCode(65 + i)}.</span>
                <span className="text-slate-700">{String(opt).replace(/^\s*[A-Da-d]\s*[.):]\s*/, '')}</span>
              </button>
            ))}
          </div>
        )}
        {isMulti && (
          <div className="space-y-2.5">
            {options.map((opt, i) => (
              <button
                key={i}
                onClick={() => toggleOpt(opt)}
                className={`flex w-full gap-3 rounded-lg border px-4 py-3 text-left text-sm ${multi.includes(opt) ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200' : 'border-slate-200 hover:bg-slate-50'}`}
              >
                <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${multi.includes(opt) ? 'border-primary-500 bg-primary-600 text-white' : 'border-slate-300 bg-white'}`}>
                  {multi.includes(opt) && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>}
                </span>
                <span className="text-slate-700">{String(opt).replace(/^\s*[A-Da-d]\s*[.):]\s*/, '')}</span>
              </button>
            ))}
          </div>
        )}
        {isTyped && (
          <input
            className="input"
            type={q.qtype === 'numerical' ? 'number' : 'text'}
            inputMode={q.qtype === 'numerical' ? 'numeric' : 'text'}
            placeholder={q.qtype === 'numerical' ? 'Type the numeric answer…' : 'Type the missing word…'}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
        )}
        {isOpen && (
          <textarea className="input resize-y" rows={3} placeholder="Type your answer (self-assessed)…" value={typed} onChange={(e) => setTyped(e.target.value)} />
        )}
      </div>
      <div className="mt-4 flex items-center justify-between">
        <button className="btn-primary" disabled={!ready || saving} onClick={submit}>
          {saving ? <Spinner size={16} className="text-white" /> : isLast ? 'Finish Baseline' : 'Submit & Next →'}
        </button>
        <button className="btn-outline" disabled={saving} onClick={skip}>Skip</button>
      </div>
    </div>
  );
}

function BaselineReviewItem({ review, index }) {
  const wrong = !review.isCorrect;
  const skipped = review.correctness === 'skip';
  return (
    <div className="card p-4">
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
            wrong ? 'bg-red-500' : 'bg-emerald-500'
          }`}
        >
          {wrong ? '✕' : '✓'}
        </span>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-sm font-semibold leading-relaxed text-slate-900">
            <span className="mr-1 text-slate-400">{index + 1}.</span>
            {review.text}
          </p>
          {review.difficulty && <span className="chip bg-slate-100 text-slate-500">Level {review.difficulty}</span>}

          <div className="space-y-1.5 text-sm">
            <p className="text-slate-700">
              <span className="font-semibold text-slate-500">Your answer: </span>
              {skipped ? <span className="italic text-slate-400">skipped</span> : <span className={wrong ? 'text-red-600' : 'text-emerald-700'}>{review.userAnswer}</span>}
            </p>
            {wrong && review.correctAnswer && (
              <p className="text-slate-700">
                <span className="font-semibold text-slate-500">Correct answer: </span>
                <span className="font-medium text-emerald-700">{review.correctAnswer}</span>
              </p>
            )}
            {!wrong && review.correctAnswer && review.correctAnswer !== review.userAnswer && (
              <p className="text-xs text-slate-500">
                <span className="font-semibold text-slate-400">Expected: </span>
                {review.correctAnswer}
              </p>
            )}
          </div>

          {review.explanation && (
            <p className="rounded-lg bg-slate-50 p-3 text-[13px] leading-relaxed text-slate-600">{review.explanation}</p>
          )}
        </div>
      </div>
    </div>
  );
}
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../services/api.js';
import { Card, Badge, Loading, EmptyState, SectionTitle, Spinner } from '../components/ui.jsx';
import { QuestionView, AnswerFeedback, LearnPanel } from '../components/Question.jsx';

const SECTION_KEY = 'aptitude';
const CATEGORY = 'aptitude';
const TITLE = 'Aptitude & Reasoning';
const SUBTITLE = 'Quants, logical & verbal reasoning drills.';
const DIFFS = [
  { v: 1, label: 'Basic' },
  { v: 2, label: 'Conceptual' },
  { v: 3, label: 'Application' },
  { v: 4, label: 'Tricky' },
  { v: 5, label: 'Interview Level' },
];
const COUNTS = [5, 10, 15];
const PICK = ['branch', 'topic', 'subject', 'difficulty', 'qtype', 'text', 'options', 'source', 'isPractical'];
const TIMER_SECONDS = 90;

export default function Aptitude() {
  const [difficulty, setDifficulty] = useState(2);
  const [count, setCount] = useState(5);
  const [phase, setPhase] = useState('setup'); // setup | loading | empty | playing | finished
  const [questions, setQuestions] = useState([]);
  const [idx, setIdx] = useState(0);
  const [results, setResults] = useState([]);
  const [learn, setLearn] = useState(null);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState('');
  const [seconds, setSeconds] = useState(TIMER_SECONDS);

  const q = questions[idx];
  const answered = results[idx];
  const canLearn = q && ['short', 'scenario', 'assertion', 'numerical', 'fillblank'].includes(q.qtype);
  const correctCount = results.filter((r) => r && r.result.correctness === 'correct').length;
  const wrongTopics = [...new Set(
    results
      .map((r, i) => r && r.result.correctness !== 'correct' ? questions[i]?.topic : null)
      .filter(Boolean)
  )].slice(0, 3);

  useEffect(() => {
    if (phase !== 'playing') return;
    setSeconds(TIMER_SECONDS);
  }, [phase, idx, learn, answered]);

  useEffect(() => {
    if (phase !== 'playing' || learn || answered) return;
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [phase, idx, learn, answered]);

  async function start() {
    setError('');
    setPhase('loading');
    try {
      const data = await request('/assignment/quick', { method: 'POST' });
      const sections = data.assignment?.sections || [];
      const section = sections.find((s) => s.key === SECTION_KEY);
      if (!section) { setPhase('empty'); return; }
      const pool = (section.questions || []).slice(0, count);
      if (pool.length === 0) { setPhase('empty'); return; }
      setQuestions(pool);
      setResults([]);
      setIdx(0);
      setLearn(null);
      setPhase('playing');
      window.scrollTo(0, 0);
    } catch (e) {
      setError(e.message || 'Could not start practice. Please try again.');
      setPhase('setup');
    }
  }

  async function handleAnswer(answer) {
    if (!q || marking) return;
    setMarking(true);
    try {
      const body = {
        question: PICK.reduce((acc, k) => { acc[k] = q[k]; return acc; }, { text: q.text }),
        userAnswer: answer,
        category: CATEGORY,
      };
      const resp = await request('/questions/submit', { method: 'POST', body });
      recordResult(q, resp.result);
    } catch (e) {
      setError(e.message || 'Could not evaluate your answer.');
    } finally {
      setMarking(false);
    }
  }

  async function handleLearn() {
    if (!q || marking) return;
    setMarking(true);
    try {
      const body = {
        question: PICK.reduce((acc, k) => { acc[k] = q[k]; return acc; }, { text: q.text }),
        userAnswer: '',
        category: CATEGORY,
        skipEvaluation: true,
      };
      const resp = await request('/questions/submit', { method: 'POST', body });
      setLearn({ q, content: resp.learnContent });
      recordResult(q, { correctness: 'dontknow' });
    } catch (e) {
      setError(e.message || 'Could not load learning content.');
    } finally {
      setMarking(false);
    }
  }

  function recordResult(question, result) {
    setResults((prev) => {
      const copy = prev.slice();
      copy[idx] = { q: question, result };
      return copy;
    });
  }

  function returnFromLearn() {
    setLearn(null);
    if (!results[idx]) recordResult(q, { correctness: 'dontknow' });
  }

  function next() {
    if (idx >= questions.length - 1) { finish(); return; }
    setIdx(idx + 1);
  }

  function finish() {
    setPhase('finished');
    window.scrollTo(0, 0);
    request('/questions/progress', { method: 'POST', body: { category: 'daily' } }).catch(() => {});
  }

  function reset() {
    setPhase('setup');
    setQuestions([]);
    setResults([]);
    setIdx(0);
    setLearn(null);
    setError('');
  }

  function diffLabel() {
    const d = DIFFS.find((x) => x.v === difficulty);
    return d ? `L${d.v} · ${d.label}` : '';
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{TITLE}</h1>
          <p className="text-sm text-slate-500">{SUBTITLE}</p>
        </div>
        <Link to="/" className="btn-ghost">← Dashboard</Link>
      </div>

      <Card className="border-amber-100 bg-amber-50/60">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 7v6l4 2" /><circle cx="12" cy="12" r="9" /></svg>
          </span>
          <div>
            <p className="text-sm font-bold text-slate-900">Tips for aptitude sets</p>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
              Read the question fully. Manage time — you get 90 seconds per question here. Skip and return if stuck.
            </p>
          </div>
        </div>
      </Card>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">Something went wrong</p>
          <p className="mt-0.5">{error}</p>
          <button className="btn mt-3 !bg-red-600 !text-white hover:!bg-red-700" onClick={() => { setError(''); if (phase === 'playing') return; start(); }}>Retry</button>
        </div>
      )}

      {phase === 'setup' && (
        <Card>
          <SectionTitle sub="Pick a difficulty and how many questions. Your chosen level shows on each question.">Session Settings</SectionTitle>
          <p className="label">Difficulty</p>
          <div className="flex flex-wrap gap-2">
            {DIFFS.map((d) => (
              <button
                key={d.v}
                onClick={() => setDifficulty(d.v)}
                className={`rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${
                  difficulty === d.v ? 'border-primary-500 bg-primary-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
          <p className="label mt-5">Questions</p>
          <div className="flex flex-wrap gap-2">
            {COUNTS.map((c) => (
              <button
                key={c}
                onClick={() => setCount(c)}
                className={`min-w-[3rem] rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${
                  count === c ? 'border-primary-500 bg-primary-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button className="btn-primary" onClick={start}>Start Practice</button>
            <Badge tone="purple">{diffLabel()}</Badge>
          </div>
        </Card>
      )}

      {phase === 'loading' && <Loading label="Preparing your practice session…" />}

      {phase === 'empty' && (
        <EmptyState
          icon="🧩"
          title="No aptitude questions right now"
          subtitle="We couldn't load aptitude questions. Try again in a moment."
          action={<button className="btn-primary" onClick={start}>Retry</button>}
        />
      )}

      {phase === 'playing' && q && (
        <div className="space-y-4">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Question {idx + 1} of {questions.length}</span>
              <span className="flex items-center gap-2">
                <Badge tone="purple">{diffLabel()}</Badge>
                <Badge tone={seconds <= 15 ? 'red' : 'slate'}>⏱ {seconds}s</Badge>
                <span className="font-semibold text-primary-600">{results.filter(Boolean).length} answered</span>
              </span>
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-primary-600 transition-all duration-500" style={{ width: `${((idx + (answered ? 1 : 0)) / questions.length) * 100}%` }} />
            </div>
          </Card>

          {learn ? (
            <LearnPanel content={learn.content} onReturn={returnFromLearn} />
          ) : answered ? (
            <AnswerFeedback
              result={answered.result}
              onNext={next}
              onLearn={canLearn ? handleLearn : null}
            />
          ) : (
            <QuestionView q={q} onSubmit={handleAnswer} onLearn={handleLearn} disabled={marking} feedback={null} />
          )}

          {marking && (
            <p className="flex items-center gap-2 text-xs text-slate-400">
              <Spinner size={14} /> Evaluating your answer…
            </p>
          )}
        </div>
      )}

      {phase === 'finished' && (
        <Card className="p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-3xl">🎉</div>
          <h2 className="mt-4 text-xl font-bold text-slate-900">Session Complete</h2>
          <p className="mt-1 text-sm text-slate-500">
            You got <span className="font-bold text-slate-800">{correctCount}</span> correct out of{' '}
            <span className="font-bold text-slate-800">{questions.length}</span> ({Math.round((correctCount / Math.max(1, questions.length)) * 100)}%)
          </p>

          {wrongTopics.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Focus on these topics</p>
              <div className="mt-2 flex flex-wrap justify-center gap-2">
                {wrongTopics.map((t) => <Badge key={t} tone="red">🎯 {t}</Badge>)}
              </div>
            </div>
          )}

          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <button className="btn-outline" onClick={reset}>Practice Again</button>
            <Link to="/" className="btn-primary">Back to Dashboard</Link>
          </div>
        </Card>
      )}
    </div>
  );
}
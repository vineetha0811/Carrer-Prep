import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../services/api.js';
import { Card, Badge, Loading, EmptyState, SectionTitle, Spinner } from '../components/ui.jsx';

const INTERVIEW_TYPES = [
  { key: 'general', label: 'General', desc: 'Intro, projects, HR & behavior.', icon: '🎯', tone: 'blue' },
  { key: 'technical', label: 'Technical', desc: 'Core concepts, scenarios, tricky questions.', icon: '💻', tone: 'purple' },
  { key: 'hr', label: 'HR', desc: 'Strengths, weaknesses, salary, goals.', icon: '🗣️', tone: 'amber' },
  { key: 'behavioral', label: 'Behavioral', desc: 'Past-behavior & STAR questions.', icon: '🧩', tone: 'green' },
  { key: 'resume', label: 'Resume', desc: 'Drilled from your uploaded resume.', icon: '📄', tone: 'slate' },
];

const TYPE_LABEL = Object.fromEntries(INTERVIEW_TYPES.map((t) => [t.key, t.label]));

function fm(t) {
  if (!t) return '—';
  const d = new Date(t);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function parseEval(e) {
  if (!e) return null;
  if (typeof e === 'string') {
    try {
      const v = JSON.parse(e);
      return v && typeof v === 'object' ? v : null;
    } catch (err) {
      return null;
    }
  }
  return e && typeof e === 'object' ? e : null;
}

function scoreLabel(s) {
  if (s >= 90) return 'Exceptional';
  if (s >= 70) return 'Strong';
  if (s >= 50) return 'Developing';
  return 'Needs Work';
}

function scoreTone(s) {
  if (s >= 90) return 'text-emerald-600';
  if (s >= 70) return 'text-primary-600';
  if (s >= 50) return 'text-amber-600';
  return 'text-red-600';
}

function scoreBadgeTone(s) {
  if (s >= 90) return 'green';
  if (s >= 70) return 'blue';
  if (s >= 50) return 'amber';
  return 'red';
}

function correctnessTone(c) {
  if (c === 'good') return 'green';
  if (c === 'average') return 'amber';
  return 'red';
}

function RingScore({ score }) {
  const R = 42;
  const CIRC = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(100, Number(score) || 0));
  const color = pct >= 70 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div className="relative inline-flex h-[130px] w-[130px] items-center justify-center">
      <svg className="h-[130px] w-[130px] -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={R} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle cx="60" cy="60" r={R} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(pct / 100) * CIRC} ${CIRC}`} />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className={`text-3xl font-extrabold ${scoreTone(pct)}`}>{Math.round(pct)}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">score</span>
      </div>
    </div>
  );
}

function TranscriptView({ messages }) {
  const list = Array.isArray(messages) ? messages : [];
  if (!list.length) return <p className="text-sm text-slate-400">No messages yet.</p>;
  return (
    <div className="space-y-3">
      {list.map((m, i) => {
        const isStudent = m.role === 'student';
        const ev = parseEval(m.evaluation);
        return (
          <div key={i} className={`flex ${isStudent ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${isStudent ? 'rounded-br-sm bg-primary-600 text-white' : 'rounded-bl-sm bg-slate-100 text-slate-800'}`}>
              <p className="whitespace-pre-wrap">{m.content}</p>
              {ev && typeof ev.score === 'number' && (
                <p className={`mt-2 text-xs font-semibold ${isStudent ? 'text-primary-100' : 'text-slate-500'}`}>
                  Score {Math.round(ev.score)} · {ev.correctness || 'graded'}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CoachPanel({ evaluation }) {
  const [open, setOpen] = useState(true);
  const ev = parseEval(evaluation);
  if (!ev) return null;
  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={() => setOpen(!open)}>
        <p className="text-sm font-bold text-slate-800">Coach Feedback</p>
        <span className="text-xs text-slate-500">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-2 text-sm text-slate-700">
          <div className="flex flex-wrap gap-2">
            {typeof ev.score === 'number' && <Badge tone="blue">Score {Math.round(ev.score)}</Badge>}
            {ev.correctness && <Badge tone={correctnessTone(ev.correctness)}>{ev.correctness}</Badge>}
          </div>
          {ev.feedback && <p>{ev.feedback}</p>}
          {ev.comments && <p>{ev.comments}</p>}
          {ev.improvement && <p className="text-amber-700"><span className="font-semibold">Improvement: </span>{ev.improvement}</p>}
          {ev.improvedAnswer && <p className="rounded-lg bg-white p-2.5 text-slate-700"><span className="font-semibold">Recommended: </span>{ev.improvedAnswer}</p>}
        </div>
      )}
    </Card>
  );
}

export default function Interview() {
  const [view, setView] = useState('start'); // start | live | final
  const [itype, setItype] = useState('general');
  const [pressure, setPressure] = useState(false);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState('');

  const [interview, setInterview] = useState(null);
  const [messages, setMessages] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentStage, setCurrentStage] = useState('intro');
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastEval, setLastEval] = useState(null);
  const [ending, setEnding] = useState(false);
  const [liveError, setLiveError] = useState('');

  const [score, setScore] = useState(null);
  const [summary, setSummary] = useState('');
  const [questionNo, setQuestionNo] = useState(0);
  const [qTimer, setQTimer] = useState(120);
  const [showReview, setShowReview] = useState(false);

  const [showHistory, setShowHistory] = useState(false);
  const [interviews, setInterviews] = useState(null);
  const [histLoading, setHistLoading] = useState(false);
  const [histError, setHistError] = useState('');
  const [histOpen, setHistOpen] = useState(null);

  useEffect(() => {
    if (view !== 'live') return undefined;
    setQTimer(120);
    const iv = setInterval(() => setQTimer((t) => Math.max(0, t - 1)), 1000);
    return () => clearInterval(iv);
  }, [view, questionNo]);

  async function startInterview() {
    setStartError('');
    setStarting(true);
    try {
      const data = await request('/interview/start', { method: 'POST', body: { type: itype, pressure } });
      setInterview({ id: data.interview.id, type: data.interview.type });
      setPressure(Boolean(data.pressure));

      const nextData = await request(`/interview/${data.interview.id}/next`, { method: 'POST' });
      const msgs = Array.isArray(nextData.messages) ? nextData.messages : [];
      setMessages(msgs);
      const lastAI = [...msgs].reverse().find((m) => m.role === 'ai');
      setCurrentQuestion(lastAI && lastAI.content ? lastAI.content : 'Let’s begin. Tell me about yourself.');
      setCurrentStage('intro');
      setQuestionNo(0);
      setQTimer(120);
      setAnswer('');
      setLastEval(null);
      setLiveError('');
      setScore(null);
      setSummary('');
      setView('live');
    } catch (e) {
      setStartError(e.message || 'Could not start interview.');
    } finally {
      setStarting(false);
    }
  }

  function fireProgress() {
    request('/questions/progress', { method: 'POST', body: { category: 'interview' } }).catch(() => {});
  }

  function gotoFinal(numberScore, summaryText) {
    setScore(numberScore);
    setSummary(summaryText || 'Interview completed.');
    setView('final');
    setShowReview(false);
    fireProgress();
  }

  async function submitAnswer() {
    const text = answer.trim();
    if (!text || submitting || !interview) return;
    setSubmitting(true);
    setLiveError('');
    try {
      const data = await request(`/interview/${interview.id}/reply`, {
        method: 'POST',
        body: { answer: text, stage: currentStage || 'intro', questionMeta: {} },
      });

      if (data && data.done) {
        setMessages((prev) => [...prev, { role: 'student', content: text, evaluation: data.evaluation || null }]);
        setAnswer('');
        setSubmitting(false);
        gotoFinal(data.score != null ? data.score : 50, data.summary || 'Interview completed.');
        return;
      }

      setLastEval(data.evaluation || null);
      setCurrentStage(data.stage || 'followup');
      setMessages((prev) => {
        const next = [...prev, { role: 'student', content: text, evaluation: data.evaluation || null }];
        if (data.next) next.push({ role: 'ai', content: data.next });
        return next;
      });
      if (data.next) setCurrentQuestion(data.next);
      setAnswer('');
      setQuestionNo((n) => n + 1);
    } catch (e) {
      setLiveError(e.message || 'Could not process your answer.');
    } finally {
      setSubmitting(false);
    }
  }

  async function endInterview() {
    if (!interview || ending) return;
    setEnding(true);
    setLiveError('');
    try {
      const data = await request(`/interview/${interview.id}/end`, { method: 'POST' });
      gotoFinal(data.score != null ? data.score : score || 50, 'Interview completed.');
    } catch (e) {
      setLiveError(e.message || 'Could not end interview.');
    } finally {
      setEnding(false);
    }
  }

  function resetForNew() {
    setView('start');
    setInterview(null);
    setMessages([]);
    setCurrentQuestion('');
    setCurrentStage('intro');
    setAnswer('');
    setLastEval(null);
    setScore(null);
    setSummary('');
    setLiveError('');
    setStartError('');
    setShowReview(false);
  }

  function toggleHistory() {
    setShowHistory((prev) => !prev);
    if (!showHistory && !interviews) loadHistory();
  }

  async function loadHistory() {
    setHistLoading(true);
    setHistError('');
    try {
      const data = await request('/interview/history');
      setInterviews(Array.isArray(data.interviews) ? data.interviews : []);
    } catch (e) {
      setHistError(e.message || 'Could not load interview history.');
    } finally {
      setHistLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Mock Interview</h1>
          <p className="text-sm text-slate-500">A full AI interview — answer questions, get coach feedback, and a final score.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" className="btn-outline" onClick={toggleHistory}>History</button>
          <Link to="/" className="btn-ghost">← Dashboard</Link>
        </div>
      </div>

      {startError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">Something went wrong</p>
          <p className="mt-0.5">{startError}</p>
        </div>
      )}
      {liveError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="mt-0.5">{liveError}</p>
        </div>
      )}
      {histError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">Something went wrong</p>
          <p className="mt-0.5">{histError}</p>
          <button className="btn mt-3 !bg-red-600 !text-white hover:!bg-red-700" onClick={loadHistory}>Retry</button>
        </div>
      )}

      {showHistory && (
        <HistorySection
          loading={histLoading}
          interviews={interviews}
          onRetry={loadHistory}
          openId={histOpen}
          onOpen={setHistOpen}
        />
      )}

      {view === 'start' && !showHistory && (
        <Card>
          <SectionTitle sub="Pick an interview type. The AI interviewer plans a full flow around it.">Start an Interview</SectionTitle>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {INTERVIEW_TYPES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setItype(t.key)}
                className={`flex items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
                  itype === t.key ? 'border-primary-500 bg-primary-50' : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <span className="text-2xl">{t.icon}</span>
                <span>
                  <span className="block text-sm font-bold text-slate-800">{t.label}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{t.desc}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div>
              <p className="text-sm font-bold text-slate-800">Pressure Mode</p>
              <p className="mt-0.5 text-xs text-slate-500">Interviewer will interrupt and challenge you</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={pressure}
              onClick={() => setPressure(!pressure)}
              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${pressure ? 'bg-primary-600' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${pressure ? 'left-[22px]' : 'left-0.5'}`} />
            </button>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="button" className="btn-primary" disabled={starting} onClick={startInterview}>
              {starting ? <><Spinner size={14} /> Preparing interview…</> : 'Start Interview'}
            </button>
            {itype !== 'general' && <Badge tone="purple">Type: {TYPE_LABEL[itype]}</Badge>}
            {pressure && <Badge tone="red">Pressure mode on</Badge>}
          </div>
        </Card>
      )}

      {view === 'live' && interview && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="purple">{TYPE_LABEL[interview.type]}</Badge>
              <Badge tone={pressure ? 'red' : 'green'}>{pressure ? 'Pressure mode' : 'Standard pace'}</Badge>
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${qTimer < 30 ? 'bg-red-100 text-red-700 animate-pulse' : 'bg-slate-100 text-slate-600'}`}>
                ⏱ {Math.floor(qTimer / 60)}:{String(qTimer % 60).padStart(2, '0')}
              </span>
              <button type="button" className="btn-outline !py-1.5 !text-xs" disabled={ending} onClick={endInterview}>
                {ending ? 'Ending…' : 'End Interview'}
              </button>
            </div>
          </div>

          <Card className="border-primary-100 bg-primary-50/60">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-600 text-sm font-bold text-white">AI</span>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-primary-600">Interviewer · {currentStage || 'question'}</p>
                <p className="mt-1 text-[15px] font-medium leading-relaxed text-slate-900">{currentQuestion}</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-800">Transcript</p>
              <p className="text-xs text-slate-400">{messages.length} messages</p>
            </div>
            <div className="mt-3 max-h-[340px] space-y-3 overflow-y-auto pr-1">
              <TranscriptView messages={messages} />
            </div>
          </Card>

          <Card>
            <p className="label">Your answer</p>
            <textarea
              className="input min-h-[120px] leading-relaxed"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Type your answer here. Answer directly, explain briefly, then give a concrete example."
            />
            <div className="mt-3 flex items-center gap-3">
              <button type="button" className="btn-primary" disabled={!answer.trim() || submitting} onClick={submitAnswer}>
                {submitting ? <><Spinner size={14} /> Evaluating…</> : 'Submit Answer'}
              </button>
              <p className="text-xs text-slate-400">Under 30s left the timer turns red — keep it calm.</p>
            </div>
          </Card>

          {lastEval && <CoachPanel evaluation={lastEval} />}
        </div>
      )}

      {view === 'final' && (
        <Card className="p-6">
          <div className="flex flex-col items-center gap-5 text-center">
            <RingScore score={score} />
            <div>
              <Badge tone={scoreBadgeTone(score)} className="!px-3 !py-1.5 !text-sm">{scoreLabel(score)}</Badge>
              <p className="mt-2 max-w-md text-sm text-slate-600">
                {summary || 'Your interview has been scored. Review the transcript below to see where you can improve.'}
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button type="button" className="btn-outline" onClick={() => setShowReview(!showReview)}>
              {showReview ? 'Hide Transcript' : 'Review Transcript'}
            </button>
            <button type="button" className="btn-primary" onClick={resetForNew}>Start New Interview</button>
          </div>

          {showReview && <TranscriptView messages={messages} />}
        </Card>
      )}
    </div>
  );
}

function HistorySection({ loading, interviews, onRetry, openId, onOpen }) {
  if (loading) return <Loading label="Loading interview history…" />;

  if (!interviews || interviews.length === 0) {
    return (
      <EmptyState
        icon="🎤"
        title="No interviews yet"
        subtitle="Complete a mock interview and it will appear here with your score and transcript."
        action={<button type="button" className="btn-primary" onClick={onRetry}>Refresh</button>}
      />
    );
  }

  return (
    <div className="space-y-3">
      {interviews.map((it) => {
        const open = openId === it.id;
        const msgs = Array.isArray(it.messages) ? it.messages : [];
        return (
          <Card key={it.id}>
            <button
              type="button"
              className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
              onClick={() => onOpen(open ? null : it.id)}
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-slate-800">{TYPE_LABEL[it.type] || it.type}</span>
                  <Badge tone={it.status === 'completed' ? 'green' : 'slate'}>{it.status === 'completed' ? 'Completed' : it.status}</Badge>
                  {typeof it.score === 'number' && <Badge tone={scoreBadgeTone(it.score)}>Score {it.score}</Badge>}
                </div>
                <p className="mt-1 text-xs text-slate-400">{fm(it.startedAt)} · {msgs.length} messages</p>
              </div>
              <span className="text-xs font-semibold text-slate-400">{open ? 'Hide ▴' : 'Show ▾'}</span>
            </button>
            {open && (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <TranscriptView messages={msgs} />
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
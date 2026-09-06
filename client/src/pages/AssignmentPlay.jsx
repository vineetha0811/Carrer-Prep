import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../services/api.js';
import { Loading, ProgressBar, Badge, Card } from '../components/ui.jsx';
import { QuestionView, AnswerFeedback, LearnPanel } from '../components/Question.jsx';

const PICK = ['branch', 'topic', 'subject', 'difficulty', 'qtype', 'text', 'options', 'source', 'isPractical'];

export default function AssignmentPlay() {
  const [assignment, setAssignment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sectionIdx, setSectionIdx] = useState(null); // which section is open
  const [qShift, setQShift] = useState({}); // sectionKey -> offset into its questions
  const [answered, setAnswered] = useState({}); // qLocalKey -> { correct, score, result }
  const [learn, setLearn] = useState(null); // { q, content }
  const [finished, setFinished] = useState(false);
  const [marking, setMarking] = useState(null);

  useEffect(() => {
    (async () => {
      const qp = new URLSearchParams(window.location.search);
      if (qp.get('quick') === '1') {
        const raw = sessionStorage.getItem('cr_quick');
        sessionStorage.removeItem('cr_quick');
        if (raw) { setAssignment(JSON.parse(raw)); setLoading(false); return; }
      }
      try {
        const data = await request('/assignment/today');
        setAssignment(data.assignment);
      } catch (e) {
        setError(e.message || 'Could not load assignment.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const questionSections = useMemo(
    () => (assignment?.sections || []).filter((s) => Array.isArray(s.questions) && s.questions.length > 0) || [],
    [assignment]
  );

  const allQuestions = useMemo(
    () => questionSections.flatMap((s) => s.questions.map((q, i) => ({ ...q, _section: s.key, _idx: i }))),
    [questionSections]
  );

  const answeredCount = Object.keys(answered).length;
  const totalCount = allQuestions.length;
  const correctCount = Object.values(answered).filter((a) => a.correct).length;

  function currentQuestion() {
    const s = assignment?.sections?.[sectionIdx];
    if (!s) return null;
    if (s.speakingChallenge) return null;
    if (s.interview) return null;
    const offset = qShift[s.key] || 0;
    return s.questions?.length ? s.questions[offset] : null;
  }

  function nextQuestion(sectionKey) {
    setQShift((prev) => ({ ...prev, [sectionKey]: (prev[sectionKey] || 0) + 1 }));
    setLearn(null);
  }

  async function handleAnswer(answer) {
    const q = currentQuestion();
    if (!q || marking) return;
    setMarking(q._localKey);
    try {
      const body = {
        question: PICK.reduce((acc, k) => { acc[k] = q[k]; return acc; }, { text: q.text }),
        userAnswer: answer,
        category: q._section,
      };
      const resp = await request('/questions/submit', { method: 'POST', body });
      const r = resp.result;
      setAnswered((prev) => ({
        ...prev,
        [q._localKey]: { correct: r.correctness === 'correct', partial: r.correctness === 'partial', score: r.score || 0, result: r },
      }));
    } catch (e) {
      setError(e.message || 'Could not evaluate answer.');
    } finally {
      setMarking(null);
    }
  }

  async function handleLearn() {
    const q = currentQuestion();
    if (!q || marking) return;
    setMarking(q._localKey);
    try {
      const body = {
        question: PICK.reduce((acc, k) => { acc[k] = q[k]; return acc; }, { text: q.text }),
        userAnswer: '',
        category: q._section,
        skipEvaluation: true,
      };
      const resp = await request('/questions/submit', { method: 'POST', body });
      setLearn({ q, content: resp.learnContent });
      setAnswered((prev) => ({ ...prev, [q._localKey]: { correct: false, partial: false, score: 0, result: { correctness: 'dontknow' } } }));
    } catch (e) {
      setError(e.message || 'Could not load learning content.');
    } finally {
      setMarking(null);
    }
  }

  async function markDailyDone() {
    try { await request('/questions/progress', { method: 'POST', body: { category: 'daily' } }); } catch (e) { /* ok */ }
  }

  function finish() {
    setFinished(true);
    if (totalCount > 0) markDailyDone();
    window.scrollTo(0, 0);
  }

  const isDone =
    allQuestions.length > 0 && Object.keys(answered).length === allQuestions.length;

  useEffect(() => {
    if (isDone && totalCount > 0 && !finished) finishWhenQuiet();
  }, [isDone, totalCount]);

  function finishWhenQuiet() {
    // finish only after last result renders
    setTimeout(() => { setFinished(true); markDailyDone(); window.scrollTo(0, 0); }, 500);
  }

  if (error) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center">
        <h2 className="text-lg font-bold text-slate-900">Something went wrong</h2>
        <p className="mt-1 text-sm text-slate-500">{error}</p>
        <button className="btn-primary mt-4" onClick={() => window.location.reload()}>Retry</button>
      </div>
    );
  }

  if (loading) return <Loading label="Preparing your assignment…" />;
  if (!assignment) return <EmptyMid />;

  const openSection = assignment.sections?.[sectionIdx];

  if (finished && totalCount > 0) {
    return (
      <CompleteScreen
        assignment={assignment}
        totalCount={totalCount}
        correctCount={correctCount}
        answeredCount={answeredCount}
        questionSections={questionSections}
        answered={answered}
        onReview={() => { setFinished(false); if (sectionIdx == null) setSectionIdx(0); }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Day {assignment.dayNumber} Assignment</h1>
          <p className="text-sm text-slate-500">
            {totalCount > 0
              ? `${answeredCount} of ${totalCount} answered`
              : assignment.estimatedMinutes + ' min · speaking + interview'}
            {assignment.planInfo ? ` · ${assignment.planInfo}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/" className="btn-ghost">← Dashboard</Link>
          {totalCount > 0 && <span className="chip bg-primary-50 text-primary-700">{Math.round((answeredCount / totalCount) * 100)}%</span>}
        </div>
      </div>

      {/* Sections */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(assignment.sections || []).map((s, i) => {
          const answeredOrDone = s.interview || s.speakingChallenge
            ? null
            : (s.questions || []).filter((q) => answered[q._localKey]).length;
          const secTotal = s.questions?.length || (s.interview ? 1 : s.speakingChallenge ? 1 : 0);
          return (
            <button
              key={s.key}
              onClick={() => setSectionIdx(i)}
              className={`card p-4 text-left transition-shadow hover:shadow-md ${sectionIdx === i ? 'ring-2 ring-primary-300' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-800">{s.label}</span>
                {s.interview && <Badge tone="purple">Interview</Badge>}
                {s.speakingChallenge && <Badge tone="amber">Speaking</Badge>}
              </div>
              <p className="mt-1 text-xs text-slate-500">~{s.minutes} min · {secTotal} task{secTotal === 1 ? '' : 's'}</p>
              {answeredOrDone != null && (
                <ProgressBar className="mt-2" value={s.questions.length ? (answeredOrDone / s.questions.length) * 100 : 0} />
              )}
            </button>
          );
        })}
      </div>

      {openSection == null && (
        <div className="card p-8 text-center">
          <p className="text-sm text-slate-500">Pick a section above to start. {totalCount === 0 ? 'This assignment includes speaking and interview practice.' : ''}</p>
        </div>
      )}

      {openSection?.speakingChallenge && (
        <Card>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v4" /></svg>
            </span>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-900">Speaking Challenge</h3>
              <p className="mt-1 text-sm text-slate-600">{openSection.speakingChallenge.topic}</p>
              <p className="mt-1 text-xs text-slate-400">Speak for ~{Math.round((openSection.speakingChallenge.durationSec || 60) / 60)} minute, get honest feedback.</p>
              <Link to="/speaking" className="btn-primary mt-3">Open Speaking Lab →</Link>
            </div>
          </div>
        </Card>
      )}

      {openSection?.interview && (
        <Card>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z" /></svg>
            </span>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-slate-900">Mini Interview</h3>
              <p className="mt-1 text-sm text-slate-600">
                A live AI interviewer asks about your intro, projects, technical depth, and handling pressure.
              </p>
              <Link to="/interview" className="btn-primary mt-3">Enter Mock Interview →</Link>
            </div>
          </div>
        </Card>
      )}

      {openSection && currentQuestion() && (
        <div className="mt-2">
          <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
            <span>Question {(qShift[openSection.key] || 0) + 1} of {openSection.questions.length} · {openSection.label}</span>
            <span className="font-semibold text-primary-600">
              {openSection.questions.filter((q) => answered[q._localKey]).length} answered
            </span>
          </div>

          {learn ? (
            <LearnPanel content={learn.content} onReturn={() => { setLearn(null); if (!answered[learn.q._localKey]) setAnswered((p) => ({ ...p, [learn.q._localKey]: { correct: false, score: 0, result: { correctness: 'dontknow' } } })); }} />
          ) : answered[currentQuestion()._localKey] ? (
            <AnswerFeedback
              result={answered[currentQuestion()._localKey].result}
              onNext={() => nextQuestion(openSection.key)}
            />
          ) : (
            <QuestionView
              q={currentQuestion()}
              onSubmit={handleAnswer}
              onLearn={handleLearn}
              disabled={Boolean(marking)}
            />
          )}

          {marking && (
            <p className="mt-3 flex items-center gap-2 text-xs text-slate-400">
              <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" /> Evaluating…
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function CompleteScreen({ assignment, totalCount, correctCount, answeredCount, questionSections, answered, onReview }) {
  // compute per section counts
  return (
    <div className="mx-auto max-w-2xl py-10">
      <div className="card p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-3xl">🏆</div>
        <h1 className="mt-4 text-xl font-bold text-slate-900">Day {assignment.dayNumber} Assignment Complete</h1>
        <p className="mt-1 text-sm text-slate-500">
          {correctCount} correct of {answeredCount} answered ({Math.round((correctCount / Math.max(1, answeredCount)) * 100)}%)
        </p>

        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          {questionSections.map((s) => {
            const secAnswered = s.questions.filter((qq) => answered[qq._localKey]);
            const secCorrect = secAnswered.filter((qq) => answered[qq._localKey].correct).length;
            return (
              <div key={s.key} className="rounded-lg bg-slate-50 p-3 text-left">
                <p className="text-xs font-semibold text-slate-500">{s.label}</p>
                <p className="text-sm font-bold text-slate-800">{secCorrect} / {secAnswered.length} correct</p>
              </div>
            );
          })}
          {questionSections.length === 0 && (
            <div className="rounded-lg bg-slate-50 p-3 text-left">
              <p className="text-xs font-semibold text-slate-500">Speaking & Interview</p>
              <p className="text-sm font-bold text-slate-800">Practice using their labs</p>
            </div>
          )}
        </div>

        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <button className="btn-outline" onClick={onReview}>Review Answers</button>
          <Link to="/speaking" className="btn-outline">Speaking Lab</Link>
          <Link to="/interview" className="btn-outline">Mock Interview</Link>
          <Link to="/" className="btn-primary">Back to Dashboard</Link>
        </div>
      </div>
    </div>
  );
}

function EmptyMid() {
  return (
    <div className="card p-8 text-center">
      <p className="text-sm text-slate-500">No assignment available yet. Head back to your dashboard.</p>
      <Link to="/" className="btn-primary mt-4">Dashboard</Link>
    </div>
  );
}
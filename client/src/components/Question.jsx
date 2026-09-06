import React, { useMemo, useState } from 'react';
import { Badge } from './ui.jsx';

const DIFF_LABELS = {
  1: 'Basic', 2: 'Conceptual', 3: 'Application', 4: 'Tricky', 5: 'Interview Challenge', 6: 'Real-world',
};
const DIFF_TONES = { 1: 'green', 2: 'blue', 3: 'purple', 4: 'amber', 5: 'red', 6: 'red' };

// Renders a question with input controls matching its type.
// Props: q (question), onSubmit(answer), onLearn(), disabled, mode ('quiz'|'interview')
export function QuestionView({ q, onSubmit, onLearn, disabled = false, feedback = null, compact = false }) {
  const [selected, setSelected] = useState(null);
  const [multiSel, setMultiSel] = useState([]);
  const [text, setText] = useState('');

  const opts = useMemo(() => (Array.isArray(q.options) ? q.options : []), [q.options]);

  function handleSubmit() {
    if (disabled) return;
    let answer;
    switch (q.qtype) {
      case 'mcq':
      case 'truefalse':
        answer = selected;
        break;
      case 'multi':
        answer = multiSel.join(', ');
        break;
      case 'fillblank':
      case 'short':
      case 'scenario':
      case 'numerical':
      case 'assertion':
      default:
        answer = text;
    }
    if (!answer || !String(answer).trim()) return;
    onSubmit(answer);
    if (!feedback) { setSelected(null); setMultiSel([]); setText(''); }
  }

  const submitDisabled = disabled
    || (['mcq', 'truefalse'].includes(q.qtype) && !selected)
    || (q.qtype === 'multi' && !multiSel.length)
    || (['fillblank', 'short', 'scenario', 'numerical', 'assertion'].includes(q.qtype) && !text.trim());

  return (
    <div className={compact ? '' : 'card p-5 md:p-6'}>
      {!compact && (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {q.subject && <Badge tone="blue">{q.subject}</Badge>}
          {q.topic && <Badge>{q.topic}</Badge>}
          {q.difficulty && <Badge tone={DIFF_TONES[q.difficulty]}>L{q.difficulty} · {DIFF_LABELS[q.difficulty]}</Badge>}
          {q.source === 'uploaded' && <Badge tone="purple">From Your Syllabus</Badge>}
          {q.source === 'supplement' && <Badge tone="amber">Placement Topic</Badge>}
          {q.isPractical && <Badge tone="green">Practical</Badge>}
        </div>
      )}

      <p className="text-[15px] font-semibold leading-relaxed text-slate-900">{q.text}</p>

      <div className="mt-4 space-y-2.5">
        {(q.qtype === 'mcq' || q.qtype === 'truefalse') && opts.map((opt, i) => {
          const letter = String.fromCharCode(65 + i);
          const isSelected = selected === opt;
          return (
            <button
              key={i}
              disabled={disabled}
              onClick={() => setSelected(opt)}
              className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors ${
                isSelected ? 'border-primary-500 bg-primary-50 ring-2 ring-primary-200' : 'border-slate-200 bg-white hover:bg-slate-50'
              } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
            >
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${isSelected ? 'border-primary-500 bg-primary-600 text-white' : 'border-slate-300 text-slate-500'}`}>
                {letter}
              </span>
              <span className="text-slate-800">{stripPrefix(opt)}</span>
            </button>
          );
        })}

        {q.qtype === 'multi' && (
          <div className="flex flex-wrap gap-2">
            {opts.map((opt, i) => {
              const on = multiSel.includes(opt);
              return (
                <button
                  key={i}
                  disabled={disabled}
                  onClick={() => setMultiSel(on ? multiSel.filter((x) => x !== opt) : [...multiSel, opt])}
                  className={`rounded-lg border px-3 py-2 text-sm ${on ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                >
                  {stripPrefix(opt)}
                </button>
              );
            })}
            {multiSel.length > 0 && <p className="w-full text-xs text-slate-500">Selected: {multiSel.map(stripPrefix).join(', ')}</p>}
          </div>
        )}

        {(q.qtype === 'fillblank' || q.qtype === 'short' || q.qtype === 'scenario' || q.qtype === 'numerical' || q.qtype === 'assertion') && (
          <textarea
            disabled={disabled}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(); }}
            rows={q.qtype === 'short' || q.qtype === 'scenario' ? 4 : 2}
            placeholder={q.qtype === 'short' || q.qtype === 'scenario'
              ? 'Write your answer in short sentences…'
              : q.qtype === 'fillblank'
                ? 'Type the missing word(s)…'
                : q.qtype === 'numerical'
                  ? 'Type your numeric answer…'
                  : 'Type your answer…'}
            className="input resize-y"
          />
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button className="btn-primary" disabled={submitDisabled} onClick={handleSubmit}>Submit Answer</button>
        {(q.qtype === 'short' || q.qtype === 'scenario' || q.qtype === 'assertion' || q.qtype === 'numerical' || q.qtype === 'fillblank') && onLearn && (
          <button className="btn-outline text-red-600" disabled={disabled} onClick={onLearn}>I Don't Know</button>
        )}
      </div>
      {!compact && <p className="mt-3 text-xs text-slate-400">Tip: Press Ctrl+Enter to submit short answers.</p>}
    </div>
  );
}

export function stripPrefix(opt) {
  return String(opt || '').replace(/^\s*[A-Da-d]\s*[.):]\s*/, '').trim();
}

// Detailed answer feedback (the learning block after submission)
export function AnswerFeedback({ result, onNext, onRetry, onLearn }) {
  const r = result || {};
  const tone = r.correctness === 'correct' ? 'green' : r.correctness === 'partial' ? 'amber' : r.correctness === 'incorrect' ? 'red' : 'slate';
  const icon = r.correctness === 'correct' ? '✔' : r.correctness === 'partial' ? '◐' : r.correctness === 'incorrect' ? '✘' : '?';

  const badges = {
    correct: <Badge tone="green">Correct</Badge>,
    partial: <Badge tone="amber">Partially Correct</Badge>,
    incorrect: <Badge tone="red">Incorrect</Badge>,
    dontknow: <Badge tone="blue">Learning Mode</Badge>,
    'cannot determine': <Badge tone="slate">Cannot Determine</Badge>,
  };

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 ${tone === 'green' ? 'border-emerald-200 bg-emerald-50' : tone === 'amber' ? 'border-amber-200 bg-amber-50' : tone === 'red' ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50'}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-lg">{icon}</span>
            <span className="text-sm font-bold text-slate-800">Result</span>
            {badges[r.correctness]}
          </div>
          <span className="text-sm font-bold text-slate-700">Score: {Math.round(r.score || 0)}/100</span>
        </div>
      </div>

      {r.feedback && <FeedbackBlock title="Feedback" body={r.feedback} tone="slate" />}
      {r.correctAnswer && <FeedbackBlock title="Correct Answer" body={r.correctAnswer} tone="green" />}
      {r.explanation && <FeedbackBlock title="Detailed Explanation" body={r.explanation} tone="blue" />}
      {Array.isArray(r.optionAnalysis) && r.optionAnalysis.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h4 className="mb-2 text-sm font-bold text-slate-800">Why each option?</h4>
          <div className="space-y-1.5">
            {r.optionAnalysis.map((o, i) => (
              <div key={i} className={`rounded-lg px-3 py-2 text-sm ${o.isCorrect ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-50 text-slate-600'}`}>
                <span className="font-semibold">{o.isCorrect ? '✓' : '✗'} </span>
                {o.option}: {o.reasoning}
              </div>
            ))}
          </div>
        </div>
      )}
      {r.misconception && <FeedbackBlock title="Where you went wrong" body={r.misconception} tone="red" />}
      {Array.isArray(r.mistakes) && r.mistakes.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-white p-4">
          <h4 className="mb-2 text-sm font-bold text-red-700">Mistakes / Missing</h4>
          <ul className="list-inside list-disc space-y-1 text-sm text-slate-700">
            {r.mistakes.map((m, i) => <li key={i}>{m}</li>)}
          </ul>
        </div>
      )}
      {r.betterAnswer && <FeedbackBlock title="Interview Ready Answer" body={r.betterAnswer} tone="purple" />}
      {r.interviewTakeaway && <FeedbackBlock title="Interview Takeaway" body={r.interviewTakeaway} tone="purple" />}
      {r.memoryTip && <FeedbackBlock title="Memory Tip" body={r.memoryTip} tone="amber" />}
      {r.relatedConcept && <FeedbackBlock title="Related Concept to Revise" body={r.relatedConcept} tone="blue" />}

      <div className="flex flex-wrap gap-2 pt-2">
        {onNext && <button className="btn-primary" onClick={onNext}>Next Question →</button>}
        {onRetry && <button className="btn-outline" onClick={onRetry}>Try Again</button>}
        {onLearn && <button className="btn-ghost text-primary-700" onClick={onLearn}>Understanding gap? Learn this topic</button>}
      </div>
    </div>
  );
}

function FeedbackBlock({ title, body, tone = 'slate' }) {
  const tones = {
    slate: 'border-slate-200',
    green: 'border-emerald-200 bg-emerald-50/50',
    blue: 'border-primary-200 bg-primary-50/50',
    red: 'border-red-200 bg-red-50/50',
    amber: 'border-amber-200 bg-amber-50/50',
    purple: 'border-violet-200 bg-violet-50/50',
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <h4 className="mb-1.5 text-sm font-bold text-slate-800">{title}</h4>
      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{body}</p>
    </div>
  );
}

// "LEARN THIS" content panel (spec §41)
export function LearnPanel({ content, onReturn }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge tone="blue">Learn This Topic</Badge>
      </div>
      <FeedbackBlock title="Simple Explanation" body={content.simpleExplanation} tone="green" />
      <FeedbackBlock title="Detailed Explanation" body={content.detailedExplanation} tone="blue" />
      <FeedbackBlock title="Real-world Example" body={content.realWorldExample} tone="amber" />
      <FeedbackBlock title="Common Interview Question" body={content.commonInterviewQuestion} tone="purple" />
      {content.commonMistake && <FeedbackBlock title="Common Mistake" body={content.commonMistake} tone="red" />}
      <FeedbackBlock title="Quick Self-Test" body={content.selfTestQuestion} tone="slate" />
      <div className="flex gap-2">
        <button className="btn-primary" onClick={onReturn}>← Back to Practice</button>
      </div>
    </div>
  );
}
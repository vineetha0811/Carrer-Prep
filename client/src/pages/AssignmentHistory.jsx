import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../services/api.js';
import { Loading, Badge } from '../components/ui.jsx';

export default function AssignmentHistory() {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewId, setPreviewId] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await request('/assignment/history');
        setAssignments(data.assignments || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function openPreview(id) {
    setPreviewId(id);
    setPreview(null);
    setLoadingPreview(true);
    try {
      const data = await request(`/assignment/history/${id}`);
      setPreview(data.assignment);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoadingPreview(false);
    }
  }

  if (loading) return <Loading label="Loading past assignments…" />;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Past Assignments</h1>
          <p className="mt-0.5 text-sm text-slate-500">Preview every daily assignment you have taken.</p>
        </div>
        <Link to="/assignment" className="btn-ghost">← Today's Assignment</Link>
      </div>

      {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {assignments.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-sm text-slate-500">No assignments yet. Complete today's assignment and it will appear here.</p>
          <Link to="/assignment" className="btn-primary mt-4">Start Today's Assignment</Link>
        </div>
      )}

      <div className="space-y-3">
        {assignments.map((a) => {
          const isOpen = previewId === a.id;
          return (
            <div key={a.id} className={`card overflow-hidden ${isOpen ? 'ring-2 ring-primary-300' : ''}`}>
              <button
                className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left"
                onClick={() => (isOpen ? setPreviewId(null) : openPreview(a.id))}
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-sm font-bold text-primary-700">{a.dayNumber}</span>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Day {a.dayNumber} Assignment</p>
                    <p className="text-xs text-slate-500">{new Date(a.date).toLocaleDateString()} · ~{a.estimatedMinutes} min</p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {a.sections.slice(0, 4).map((s) => (
                    <span key={s.key} className="chip bg-slate-100 text-slate-600">{s.label} · {s.count}</span>
                  ))}
                  <span className="chip bg-primary-50 text-primary-700">{isOpen ? 'Hide' : 'Preview'} →</span>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-slate-100 bg-slate-50/60 p-4">
                  {loadingPreview ? (
                    <div className="flex items-center justify-center py-6 text-slate-400"><Loading label="Loading…" /></div>
                  ) : preview ? (
                    <div className="space-y-4">
                      {(preview.sections || []).map((s) => (
                        <PreviewSection key={s.key} section={s} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">Nothing to preview.</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PreviewSection({ section }) {
  const questions = Array.isArray(section.questions) ? section.questions : [];
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-sm font-bold text-slate-800">{section.label}</span>
        <span className="chip bg-slate-100 text-slate-500">~{section.minutes} min · {questions.length || section.count || 0} task{questions.length === 1 ? '' : 's'}</span>
        {section.speakingChallenge && <Badge tone="amber">Speaking</Badge>}
        {section.interview && <Badge tone="purple">Interview</Badge>}
      </div>

      {section.speakingChallenge && (
        <div className="rounded-lg bg-white p-3 text-sm text-slate-700">
          <span className="font-semibold text-slate-500">Topic: </span>{section.speakingChallenge.topic}
        </div>
      )}
      {section.interview && (
        <div className="rounded-lg bg-white p-3 text-sm text-slate-700">
          A short mock interview (intro, technical, scenario and HR rounds).
        </div>
      )}

      {questions.length > 0 && (
        <div className="space-y-2">
          {questions.map((q, i) => (
            <div key={q._localKey || i} className="rounded-lg bg-white p-3">
              <div className="mb-1 flex flex-wrap gap-2">
                {q.topic && <span className="chip bg-primary-50 text-primary-700">{q.topic}</span>}
                {q.difficulty && <span className="chip bg-slate-100 text-slate-500">Level {q.difficulty}</span>}
              </div>
              <p className="text-sm text-slate-800">{i + 1}. {q.text}</p>
              {Array.isArray(q.options) && q.options.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
                  {q.options.map((o, j) => (
                    <li key={j}><span className="mr-1 font-semibold text-slate-400">{String.fromCharCode(65 + j)}.</span>{String(o).replace(/^\s*[A-Za-z]\s*[.):]\s*/, '')}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
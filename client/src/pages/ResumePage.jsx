import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { request, upload } from '../services/api.js';
import { Card, Badge, Loading, EmptyState, SectionTitle, Spinner, Modal } from '../components/ui.jsx';

const MAX_FILES = 10;

function fmtDate(t) {
  if (!t) return '—';
  const d = new Date(t);
  if (isNaN(d.getTime())) return '—';
  return (
    d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  );
}

function parseAnalysis(a) {
  if (!a) return null;
  if (typeof a === 'string') {
    try {
      const v = JSON.parse(a);
      return v && typeof v === 'object' ? v : null;
    } catch (e) {
      return null;
    }
  }
  return a && typeof a === 'object' ? a : null;
}

function statusTone(s) {
  if (s === 'ready') return 'green';
  if (s === 'failed') return 'red';
  if (s === 'analyzing') return 'amber';
  return 'slate';
}

function statusLabel(s) {
  if (s === 'analyzing') return 'Analyzing';
  if (s === 'ready') return 'Ready';
  if (s === 'failed') return 'Failed';
  return s || '—';
}

function itemText(item) {
  if (item == null) return '';
  if (typeof item === 'string') return item;
  if (typeof item === 'object') return item.text || item.point || item.title || item.name || '';
  return String(item);
}

function AnalyzedResume({ analysis }) {
  const lists = {
    strengths: ['strengths', 'strength', 'pros'],
    weakPoints: ['weakPoints', 'weaknesses', 'weakness', 'cons'],
    overall: ['overall', 'score', 'totalScore'],
  };

  let strengths = [];
  let weakPoints = [];
  for (const key of lists.strengths) {
    if (Array.isArray(analysis[key])) { strengths = analysis[key].filter(Boolean); break; }
  }
  for (const key of lists.weakPoints) {
    if (Array.isArray(analysis[key])) { weakPoints = analysis[key].filter(Boolean); break; }
  }
  let overall = null;
  for (const key of lists.overall) {
    if (typeof analysis[key] === 'number') { overall = analysis[key]; break; }
  }
  if (analysis.score != null && typeof Number(analysis.score) === 'number' && !Number.isNaN(Number(analysis.score))) {
    overall = Number(analysis.score);
  }
  const score = typeof overall === 'number' ? overall : null;

  return (
    <div className="space-y-4">
      {score != null && (
        <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
          <span className="text-sm font-semibold text-slate-600">Overall</span>
          <span className={`text-3xl font-extrabold ${score >= 70 ? 'text-emerald-600' : score >= 45 ? 'text-amber-600' : 'text-red-600'}`}>{Math.round(score)}</span>
          <span className="text-xs text-slate-400">/ 100</span>
        </div>
      )}

      {strengths.length > 0 && (
        <div>
          <p className="label !mb-2 text-emerald-600">Strengths</p>
          <ul className="space-y-1.5">
            {strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <svg className="mt-0.5 shrink-0 text-emerald-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {itemText(s)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {weakPoints.length > 0 && (
        <div>
          <p className="label !mb-2 text-amber-600">Things to watch</p>
          <ul className="space-y-1.5">
            {weakPoints.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <svg className="mt-0.5 shrink-0 text-amber-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 3v12M12 19v.01" />
                </svg>
                {itemText(w)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!strengths.length && !weakPoints.length && score == null && (
        <p className="text-sm text-slate-500">No analysis details are available for this resume yet.</p>
      )}
    </div>
  );
}

function ResumeIcon({ className = 'mx-auto h-10 w-10 text-slate-400' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="10" r="2" />
      <path d="M6.5 15c.6-1.2 1.5-1.8 2.5-1.8s1.9.6 2.5 1.8M14 8h3.5M14 12h3.5M14 16h3.5" />
    </svg>
  );
}

export default function ResumePage() {
  const [resumes, setResumes] = useState(null);
  const [error, setError] = useState('');

  const [chosen, setChosen] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploaded, setUploaded] = useState([]);
  const fileRef = useRef(null);

  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');

  const [questionTarget, setQuestionTarget] = useState(null);
  const [questions, setQuestions] = useState(null);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [questionError, setQuestionError] = useState('');

  const [analysisView, setAnalysisView] = useState(null);

  async function loadResumes(showLoading = true) {
    if (showLoading) setResumes(null);
    setError('');
    try {
      const data = await request('/resume');
      setResumes(Array.isArray(data.resumes) ? data.resumes : []);
    } catch (e) {
      setError(e.message || 'Could not load resumes.');
      if (showLoading) setResumes([]);
    }
  }

  useEffect(() => {
    loadResumes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!resumes || !resumes.some((r) => r.status === 'analyzing')) return undefined;
    const iv = setInterval(() => loadResumes(false), 4000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resumes]);

  function addFiles(list) {
    const incoming = Array.from(list || []);
    const allowed = incoming.filter((f) => /\.(pdf|docx)$/i.test(f.name));
    setUploadError('');
    if (allowed.length !== incoming.length) {
      setUploadError('Only PDF and DOCX files are accepted.');
    }
    const total = [...chosen, ...allowed];
    if (total.length > MAX_FILES) {
      setUploadError((prev) => (prev ? `${prev} ` : '') + `Up to ${MAX_FILES} files at once — extra files were ignored.`);
    }
    setChosen(total.slice(0, MAX_FILES));
  }

  async function handleUpload() {
    if (!chosen.length || uploading) return;
    setUploading(true);
    setUploadError('');
    setActionError('');
    setUploaded([]);
    try {
      const data = await upload('/resume/upload', chosen, {});
      const list = Array.isArray(data.files) ? data.files : data.resume ? [data.resume] : [];
      setUploaded(list);
      setChosen([]);
      await loadResumes(false);
    } catch (e) {
      setUploadError(e.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function openQuestions(r) {
    setQuestionTarget(r);
    setQuestions(null);
    setQuestionError('');
    setQuestionLoading(true);
    try {
      const data = await request(`/resume/${r.id}/questions`, { method: 'POST', body: {} });
      setQuestions(Array.isArray(data.questions) ? data.questions : []);
    } catch (e) {
      setQuestionError(e.message || 'Could not generate questions.');
    } finally {
      setQuestionLoading(false);
    }
  }

  async function deleteResume(r) {
    if (!window.confirm(`Delete "${r.originalName || r.fileName}"?`)) return;
    setBusyId(r.id);
    setActionError('');
    try {
      await request(`/resume/${r.id}`, { method: 'DELETE' });
      await loadResumes(false);
      if (analysisView && analysisView.id === r.id) setAnalysisView(null);
    } catch (e) {
      setActionError(e.message || 'Could not delete this resume.');
    } finally {
      setBusyId(null);
    }
  }

  const parsedAnalysis = analysisView ? parseAnalysis(analysisView.analysis) : null;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Resume</h1>
          <p className="text-sm text-slate-500">AI analyzes your resume so interviews can drill into it.</p>
        </div>
        <Link to="/" className="btn-ghost">← Dashboard</Link>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">Something went wrong</p>
          <p className="mt-0.5">{error}</p>
          <button className="btn mt-3 !bg-red-600 !text-white hover:!bg-red-700" onClick={() => loadResumes(true)}>Retry</button>
        </div>
      )}

      {/* Note block */}
      <Card className="border-amber-200 bg-amber-50/60">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </span>
          <p className="text-sm leading-relaxed text-slate-700">
            <span className="font-semibold text-slate-800">Spec honesty:</span> Resume must be your own work. The AI will cross-question you on everything it reads.
          </p>
        </div>
      </Card>

      {/* Upload card */}
      <Card>
        <SectionTitle sub="Upload your resume (PDF or DOCX) and we will analyze it for interview prep.">
          Upload your resume
        </SectionTitle>

        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-600">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 16V4M7 9l5-5 5 5M4 17v3h16v-3" />
            </svg>
          </span>
          <p className="text-sm font-semibold text-slate-700">Pick your resume file</p>
          <p className="text-xs text-slate-500">PDF or DOCX, up to {MAX_FILES} files at a time</p>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".pdf,.docx"
            className="hidden"
            onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
          />
          <button type="button" className="btn-outline" onClick={() => fileRef.current && fileRef.current.click()}>
            Browse files
          </button>
        </div>

        {chosen.length > 0 && (
          <div className="mt-4 space-y-2">
            {chosen.map((f, i) => (
              <div key={`${f.name}-${i}`} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Badge tone="slate">{(f.name.split('.').pop() || 'file').toUpperCase()}</Badge>
                  <span className="truncate text-sm text-slate-700">{f.name}</span>
                  <span className="shrink-0 text-xs text-slate-400">{Math.max(1, Math.round(f.size / 1024))} KB</span>
                </div>
                <button type="button" className="shrink-0 text-xs font-semibold text-slate-400 hover:text-red-600" onClick={() => setChosen(chosen.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {uploadError && <p className="mt-3 text-sm text-red-600">{uploadError}</p>}

        {uploaded.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {uploaded.map((fn) => (
              <Badge key={fn.id || fn.originalName || fn.fileName} tone={statusTone(fn.status)}>
                {fn.originalName || fn.fileName} · {statusLabel(fn.status)}{fn.message ? ` · ${fn.message}` : ''}
              </Badge>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" className="btn-primary" disabled={chosen.length === 0 || uploading} onClick={handleUpload}>
            {uploading ? <><Spinner size={14} /> Uploading…</> : `Upload ${chosen.length ? `${chosen.length} file${chosen.length === 1 ? '' : 's'}` : ''}`.trim()}
          </button>
          {resumes && resumes.some((r) => r.status === 'analyzing') && (
            <span className="flex items-center gap-2 text-xs text-slate-500">
              <Spinner size={12} /> Refreshing analysis status…
            </span>
          )}
        </div>
      </Card>

      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="mt-0.5">{actionError}</p>
        </div>
      )}

      {/* Resumes list */}
      {!resumes ? (
        <Loading label="Loading resumes…" />
      ) : resumes.length === 0 ? (
        <EmptyState
          icon={<ResumeIcon />}
          title="No resumes yet"
          subtitle="Upload your resume and the AI will analyze it and generate questions that drill into it."
          action={<button type="button" className="btn-primary" onClick={() => fileRef.current && fileRef.current.click()}>Upload your resume</button>}
        />
      ) : (
        <div className="space-y-3">
          {resumes.map((r) => {
            const mainName = r.fileName || r.originalName || 'Untitled';
            const hasOriginal = r.originalName && r.originalName !== mainName;
            return (
              <Card key={r.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-bold text-slate-800">{mainName}</span>
                      <Badge tone={statusTone(r.status)}>{statusLabel(r.status)}</Badge>
                      {r.photoPath && <Badge tone="green">Photo attached</Badge>}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">
                      {hasOriginal && <span>{r.originalName} · </span>}
                      {fmtDate(r.createdAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-outline !py-1.5 !text-xs" disabled={busyId === r.id} onClick={() => openQuestions(r)}>
                      Generate Interview Questions
                    </button>
                    {r.analysis && (
                      <button type="button" className="btn-outline !py-1.5 !text-xs" disabled={busyId === r.id} onClick={() => setAnalysisView(r)}>
                        View Analysis
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn !py-1.5 !text-xs !bg-red-600 !text-white hover:!bg-red-700"
                      disabled={busyId === r.id}
                      onClick={() => deleteResume(r)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Questions modal */}
      <Modal
        open={Boolean(questionTarget)}
        onClose={() => setQuestionTarget(null)}
        title={`Interview Questions · ${questionTarget ? (questionTarget.originalName || questionTarget.fileName) : ''}`}
        size="lg"
      >
        {questionLoading && <p className="flex items-center gap-2 text-sm text-slate-500"><Spinner size={14} /> Generating questions…</p>}
        {questionError && <p className="text-sm text-red-600">{questionError}</p>}
        {!questionLoading && !questionError && (
          (questions || []).length === 0 ? (
            <p className="text-sm text-slate-500">No questions were generated for this resume.</p>
          ) : (
            <ol className="space-y-3">
              {questions.map((q, i) => (
                <li key={i} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex flex-wrap items-start gap-2">
                    <span className="text-sm font-semibold leading-relaxed text-slate-800">{i + 1}. {q.text}</span>
                    {q.category && <Badge tone="purple">{q.category}</Badge>}
                  </div>
                  {q.rationale && (
                    <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                      <span className="font-semibold text-slate-600">Why: </span>{q.rationale}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )
        )}
      </Modal>

      {/* Analysis modal */}
      <Modal
        open={Boolean(analysisView)}
        onClose={() => setAnalysisView(null)}
        title={`Analysis · ${analysisView ? (analysisView.originalName || analysisView.fileName) : ''}`}
        size="lg"
      >
        {parsedAnalysis ? (
          <AnalyzedResume analysis={parsedAnalysis} />
        ) : (
          <p className="whitespace-pre-wrap text-sm text-slate-700">
            {analysisView && analysisView.analysis ? String(analysisView.analysis) : 'No analysis is available for this resume yet.'}
          </p>
        )}
      </Modal>
    </div>
  );
}
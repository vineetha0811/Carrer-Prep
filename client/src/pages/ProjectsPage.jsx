import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../services/api.js';
import { Card, Badge, Loading, EmptyState, SectionTitle, Spinner, Modal } from '../components/ui.jsx';

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

function parseTech(ts) {
  if (Array.isArray(ts)) return ts.map((s) => String(s).trim()).filter(Boolean);
  if (typeof ts === 'string') return ts.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean);
  return [];
}

function FolderIcon({ className = 'mx-auto h-10 w-10 text-slate-400' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M3 7a2 2 0 0 1 2-2h4l2 3h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </svg>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState(null);
  const [error, setError] = useState('');

  const [form, setForm] = useState({ title: '', techStack: '', description: '', link: '' });
  const [posting, setPosting] = useState(false);
  const [formError, setFormError] = useState('');
  const titleRef = useRef(null);

  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');

  const [questionTarget, setQuestionTarget] = useState(null);
  const [questions, setQuestions] = useState(null);
  const [questionLoading, setQuestionLoading] = useState(false);
  const [questionError, setQuestionError] = useState('');

  async function loadProjects(showLoading = true) {
    if (showLoading) setProjects(null);
    setError('');
    try {
      const data = await request('/projects');
      setProjects(Array.isArray(data.projects) ? data.projects : []);
    } catch (e) {
      setError(e.message || 'Could not load projects.');
      if (showLoading) setProjects([]);
    }
  }

  useEffect(() => {
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submitProject() {
    const title = form.title.trim();
    const techStack = form.techStack.trim();
    if (!title || !techStack || posting) return;
    setPosting(true);
    setFormError('');
    const body = { title, techStack, description: form.description.trim(), link: form.link.trim() };
    if (!body.description) delete body.description;
    if (!body.link) delete body.link;
    try {
      await request('/projects', { method: 'POST', body });
      setForm({ title: '', techStack: '', description: '', link: '' });
      await loadProjects(false);
    } catch (e) {
      setFormError(e.message || 'Could not save the project.');
    } finally {
      setPosting(false);
    }
  }

  async function openQuestions(p) {
    setQuestionTarget(p);
    setQuestions(null);
    setQuestionError('');
    setQuestionLoading(true);
    try {
      const data = await request(`/projects/${p.id}/questions`, { method: 'POST', body: {} });
      setQuestions(Array.isArray(data.questions) ? data.questions : []);
    } catch (e) {
      setQuestionError(e.message || 'Could not generate questions.');
    } finally {
      setQuestionLoading(false);
    }
  }

  async function deleteProject(p) {
    if (!window.confirm(`Delete "${p.title}"?`)) return;
    setBusyId(p.id);
    setActionError('');
    try {
      await request(`/projects/${p.id}`, { method: 'DELETE' });
      await loadProjects(false);
    } catch (e) {
      setActionError(e.message || 'Could not delete this project.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500">Interviewers drill into your projects. Prepare the answers here.</p>
        </div>
        <Link to="/" className="btn-ghost">← Dashboard</Link>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">Something went wrong</p>
          <p className="mt-0.5">{error}</p>
          <button className="btn mt-3 !bg-red-600 !text-white hover:!bg-red-700" onClick={() => loadProjects(true)}>Retry</button>
        </div>
      )}

      {/* Add project form */}
      <Card>
        <SectionTitle sub="Add a project, then generate interview questions that drill into it.">
          Add project
        </SectionTitle>
        <div className="space-y-4">
          <div>
            <p className="label">Title</p>
            <input
              ref={titleRef}
              className="input"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Placement AI Chatbot"
            />
          </div>
          <div>
            <p className="label">Tech stack</p>
            <input
              className="input"
              value={form.techStack}
              onChange={(e) => setForm({ ...form, techStack: e.target.value })}
              placeholder="e.g. React, Node.js, MongoDB"
            />
            <p className="mt-1 text-xs text-slate-400">Comma or space separated.</p>
          </div>
          <div>
            <p className="label">Description</p>
            <textarea
              className="input min-h-[110px] leading-relaxed"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="What it does, what you built, any challenges you solved…"
            />
          </div>
          <div>
            <p className="label">Link <span className="font-normal text-slate-400">(optional)</span></p>
            <input
              className="input"
              value={form.link}
              onChange={(e) => setForm({ ...form, link: e.target.value })}
              placeholder="https://github.com/you/project"
            />
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn-primary"
              disabled={!form.title.trim() || !form.techStack.trim() || posting}
              onClick={submitProject}
            >
              {posting ? <><Spinner size={14} /> Saving…</> : 'Add Project'}
            </button>
          </div>
        </div>
      </Card>

      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="mt-0.5">{actionError}</p>
        </div>
      )}

      {/* Projects list */}
      {!projects ? (
        <Loading label="Loading projects…" />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<FolderIcon />}
          title="No projects yet"
          subtitle="Add a project above and prepare answers for the interview questions it generates."
          action={<button type="button" className="btn-primary" onClick={() => titleRef.current && titleRef.current.focus()}>Add your first project</button>}
        />
      ) : (
        <div className="space-y-3">
          {projects.map((p) => {
            const tech = parseTech(p.techStack);
            return (
              <Card key={p.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">{p.title}</h3>
                      {p.link && (
                        <a href={p.link} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-primary-600 hover:underline">
                          Visit ↗
                        </a>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-400">{fmtDate(p.createdAt)}</p>

                    {tech.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {tech.map((t) => <Badge key={t} tone="blue">{t}</Badge>)}
                      </div>
                    )}

                    {p.description && <p className="mt-3 text-sm leading-relaxed text-slate-600">{p.description}</p>}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="btn-outline !py-1.5 !text-xs" disabled={busyId === p.id} onClick={() => openQuestions(p)}>
                      Interview Questions
                    </button>
                    <button
                      type="button"
                      className="btn !py-1.5 !text-xs !bg-red-600 !text-white hover:!bg-red-700"
                      disabled={busyId === p.id}
                      onClick={() => deleteProject(p)}
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
        title={`Interview Questions · ${questionTarget ? questionTarget.title : ''}`}
        size="lg"
      >
        {questionLoading && <p className="flex items-center gap-2 text-sm text-slate-500"><Spinner size={14} /> Generating questions…</p>}
        {questionError && <p className="text-sm text-red-600">{questionError}</p>}
        {!questionLoading && !questionError && (
          (questions || []).length === 0 ? (
            <p className="text-sm text-slate-500">No questions were generated for this project.</p>
          ) : (
            <ol className="space-y-3">
              {questions.map((q, i) => (
                <li key={i} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-sm font-semibold leading-relaxed text-slate-800">{i + 1}. {q.text}</p>
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
    </div>
  );
}
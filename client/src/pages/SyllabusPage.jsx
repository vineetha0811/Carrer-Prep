import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { request, upload } from '../services/api.js';
import { Card, Badge, Loading, EmptyState, SectionTitle, Spinner, Modal } from '../components/ui.jsx';

const MAX_FILES = 10;
const ACTIVE_STATUSES = ['uploading', 'processing', 'analyzing', 'structuring'];
const PREVIEW_CHARS = 4000;

const STATUS_TONE = {
  uploading: 'amber',
  processing: 'blue',
  analyzing: 'blue',
  structuring: 'blue',
  ready: 'green',
  failed: 'red',
};

const STATUS_LABEL = {
  uploading: 'Uploading',
  processing: 'Processing',
  analyzing: 'Analyzing',
  structuring: 'Structuring',
  ready: 'Ready',
  failed: 'Failed',
};

function statusTone(s) {
  return STATUS_TONE[s] || 'slate';
}

function statusLabel(s) {
  return STATUS_LABEL[s] || s || '—';
}

function hasActive(list) {
  return (list || []).some((f) => ACTIVE_STATUSES.includes(f && f.status));
}

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

function FileIcon({ className = 'h-6 w-6' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5M9 13h6M9 17h6" />
    </svg>
  );
}

function OutlineIcon({ className = 'h-10 w-10 mx-auto text-slate-400' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4 6h16M4 12h16M4 18h16M8 6v.01M12 12v.01M7 18v.01" />
    </svg>
  );
}

export default function SyllabusPage() {
  const [tab, setTab] = useState('files');

  const [files, setFiles] = useState(null);
  const [error, setError] = useState('');

  const [chosen, setChosen] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploaded, setUploaded] = useState([]);
  const fileRef = useRef(null);

  const [busyId, setBusyId] = useState(null);
  const [actionError, setActionError] = useState('');

  const [previewFile, setPreviewFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  const [outline, setOutline] = useState(null);
  const [outlineLoading, setOutlineLoading] = useState(false);
  const [outlineError, setOutlineError] = useState('');

  async function loadFiles(showLoading = true) {
    if (showLoading) setFiles(null);
    setError('');
    try {
      const data = await request('/syllabus');
      setFiles(Array.isArray(data.files) ? data.files : []);
    } catch (e) {
      setError(e.message || 'Could not load syllabus files.');
      if (showLoading) setFiles([]);
    }
  }

  useEffect(() => {
    loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!files || !hasActive(files)) return undefined;
    const iv = setInterval(() => loadFiles(false), 4000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  function addFiles(list) {
    const incoming = Array.from(list || []);
    const allowed = incoming.filter((f) => /\.(pdf|docx|txt)$/i.test(f.name));
    setUploadError('');
    if (allowed.length !== incoming.length) {
      setUploadError('Only .pdf, .docx and .txt files are accepted.');
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
      const data = await upload('/syllabus/upload', chosen, {});
      setUploaded(Array.isArray(data.files) ? data.files : []);
      setChosen([]);
      await loadFiles(false);
    } catch (e) {
      setUploadError(e.message || 'Upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function openPreview(f) {
    setPreviewFile(f);
    setPreviewData(null);
    setPreviewError('');
    setPreviewLoading(true);
    try {
      const data = await request(`/syllabus/${f.id}/preview`);
      setPreviewData(data.preview || null);
    } catch (e) {
      setPreviewError(e.message || 'Could not load the preview.');
    } finally {
      setPreviewLoading(false);
    }
  }

  function closePreview() {
    setPreviewFile(null);
    setPreviewData(null);
    setPreviewError('');
  }

  async function retryFile(f) {
    setBusyId(f.id);
    setActionError('');
    try {
      await request(`/syllabus/retry/${f.id}`, { method: 'POST', body: {} });
      await loadFiles(false);
    } catch (e) {
      setActionError(e.message || 'Could not retry this file.');
    } finally {
      setBusyId(null);
    }
  }

  async function deleteFile(f) {
    if (!window.confirm(`Delete "${f.originalName}"?`)) return;
    setBusyId(f.id);
    setActionError('');
    try {
      await request(`/syllabus/${f.id}`, { method: 'DELETE' });
      await loadFiles(false);
      if (previewFile && previewFile.id === f.id) closePreview();
    } catch (e) {
      setActionError(e.message || 'Could not delete this file.');
    } finally {
      setBusyId(null);
    }
  }

  function onOutlineTab() {
    setTab('outline');
    if (!outline && !outlineLoading) loadOutline();
  }

  async function loadOutline() {
    setOutlineLoading(true);
    setOutlineError('');
    try {
      const data = await request('/syllabus/outline');
      setOutline(data || null);
    } catch (e) {
      setOutlineError(e.message || 'Could not load the outline.');
    } finally {
      setOutlineLoading(false);
    }
  }

  const previewRaw = previewData && previewData.text ? previewData.text : '';
  const previewText =
    previewRaw.length > PREVIEW_CHARS
      ? `${previewRaw.slice(0, PREVIEW_CHARS)}\n\n… (truncated — full preview is ${previewRaw.length.toLocaleString()} characters)`
      : previewRaw;

  const uploadLabel = chosen.length
    ? `Upload ${chosen.length} file${chosen.length === 1 ? '' : 's'}`
    : 'Upload';

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">My Syllabus</h1>
          <p className="text-sm text-slate-500">Upload papers — we build your live subject outline for question generation.</p>
        </div>
        <Link to="/" className="btn-ghost">← Dashboard</Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={tab === 'files' ? 'btn-primary' : 'btn-outline'} onClick={() => setTab('files')}>
          Files
        </button>
        <button type="button" className={tab === 'outline' ? 'btn-primary' : 'btn-outline'} onClick={onOutlineTab}>
          Outline
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">Something went wrong</p>
          <p className="mt-0.5">{error}</p>
          <button className="btn mt-3 !bg-red-600 !text-white hover:!bg-red-700" onClick={() => loadFiles(true)}>Retry</button>
        </div>
      )}

      {tab === 'files' && (
        <div className="space-y-5">
          {/* Upload card */}
          <Card>
            <SectionTitle sub="Drop one or more syllabus papers. We extract subjects and topics and keep the outline live.">
              Upload syllabus papers
            </SectionTitle>

            <div
              className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-10 text-center transition-colors ${
                dragOver ? 'border-primary-500 bg-primary-50' : 'border-slate-300 bg-slate-50'
              }`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer && e.dataTransfer.files); }}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 text-primary-600">
                <FileIcon />
              </span>
              <p className="text-sm font-semibold text-slate-700">Drag & drop papers here</p>
              <p className="text-xs text-slate-500">or</p>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt"
                className="hidden"
                onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
              />
              <button type="button" className="btn-outline" onClick={() => fileRef.current && fileRef.current.click()}>
                Browse files
              </button>
              <p className="text-xs text-slate-400">Up to {MAX_FILES} files · .pdf .docx .txt</p>
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
                  <Badge key={fn.id || fn.originalName} tone={statusTone(fn.status)}>
                    {fn.originalName} · {statusLabel(fn.status)}{fn.message ? ` · ${fn.message}` : ''}
                  </Badge>
                ))}
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" className="btn-primary" disabled={chosen.length === 0 || uploading} onClick={handleUpload}>
                {uploading ? <><Spinner size={14} /> Uploading…</> : uploadLabel}
              </button>
              {hasActive(files || []) && (
                <span className="flex items-center gap-2 text-xs text-slate-500">
                  <Spinner size={12} /> Live status refresh is running…
                </span>
              )}
            </div>
          </Card>

          {actionError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <p className="mt-0.5">{actionError}</p>
            </div>
          )}

          {/* Files list */}
          {!files ? (
            <Loading label="Loading syllabus files…" />
          ) : files.length === 0 ? (
            <EmptyState
              icon={<FileIcon className="mx-auto h-10 w-10 text-slate-400" />}
              title="No syllabus papers yet"
              subtitle="Upload a paper and it will appear here with its processing status."
              action={<button type="button" className="btn-primary" onClick={onOutlineTab}>View Outline</button>}
            />
          ) : (
            <div className="space-y-3">
              {files.map((f) => {
                const mainName = f.fileName || f.originalName || 'Untitled';
                const hasOriginal = f.originalName && f.originalName !== mainName;
                return (
                  <Card key={f.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-bold text-slate-800">{mainName}</span>
                          <Badge tone={statusTone(f.status)}>{statusLabel(f.status)}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          {hasOriginal && <span>{f.originalName} · </span>}
                          {fmtDate(f.createdAt)}
                          {f.mimeType && <span> · {f.mimeType}</span>}
                        </p>
                        {f.message && <p className="mt-1 text-xs text-red-600">{f.message}</p>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className="btn-outline !py-1.5 !text-xs" onClick={() => openPreview(f)}>View Preview</button>
                        {f.status === 'failed' && (
                          <button type="button" className="btn-outline !py-1.5 !text-xs" disabled={busyId === f.id} onClick={() => retryFile(f)}>
                            {busyId === f.id ? 'Retrying…' : 'Retry'}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn !py-1.5 !text-xs !bg-red-600 !text-white hover:!bg-red-700"
                          disabled={busyId === f.id}
                          onClick={() => deleteFile(f)}
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
        </div>
      )}

      {tab === 'outline' && (
        outlineLoading ? (
          <Loading label="Building your live outline…" />
        ) : outlineError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p className="font-semibold">Something went wrong</p>
            <p className="mt-0.5">{outlineError}</p>
            <button className="btn mt-3 !bg-red-600 !text-white hover:!bg-red-700" onClick={loadOutline}>Retry</button>
          </div>
        ) : !outline || !Array.isArray(outline.outline) || outline.outline.length === 0 ? (
          <EmptyState
            icon={<OutlineIcon />}
            title="No outline yet"
            subtitle="Upload a syllabus paper to generate live questions from it."
            action={<button type="button" className="btn-primary" onClick={() => setTab('files')}>Upload a paper</button>}
          />
        ) : (
          <div className="space-y-4">
            <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">Live outline</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  {outline.outline.length} subject{outline.outline.length === 1 ? '' : 's'} ·{' '}
                  <span className="font-semibold text-slate-600">{outline.totalTopics || 0} topics</span>
                </p>
              </div>
              {outline.source === 'builtin' ? (
                <Badge tone="purple">Standard {outline.branch || 'branch'} curriculum — add your paper to personalize</Badge>
              ) : (
                <Badge tone="green">Personalized from your papers</Badge>
              )}
            </Card>

            {outline.outline.map((subject) => (
              <Card key={subject.subject} className="p-5">
                <h3 className="text-base font-bold text-slate-900">{subject.subject}</h3>
                <div className="mt-4 space-y-4">
                  {(Array.isArray(subject.units) ? subject.units : []).map((unit) => (
                    <div key={unit.title}>
                      <p className="text-sm font-semibold text-slate-700">{unit.title}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(Array.isArray(unit.topics) ? unit.topics : []).map((tp, i) => {
                          const name = typeof tp === 'string' ? tp : tp && tp.name;
                          const st = typeof tp === 'object' && tp ? tp.status : null;
                          const keyBase = name || String(i);
                          return (
                            <span key={`${keyBase}-${i}`} className="chip bg-slate-100 text-slate-700" title={st || undefined}>
                              {st && <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-amber-400" />}
                              {name}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {/* Preview modal */}
      <Modal
        open={Boolean(previewFile)}
        onClose={closePreview}
        title={`Preview · ${previewFile ? (previewFile.fileName || previewFile.originalName) : ''}`}
        size="lg"
      >
        {previewLoading && <p className="flex items-center gap-2 text-sm text-slate-500"><Spinner size={14} /> Loading preview…</p>}
        {previewError && <p className="text-sm text-red-600">{previewError}</p>}
        {!previewLoading && !previewError && (
          <>
            {previewData && (
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge tone="slate">{previewData.chars != null ? previewData.chars.toLocaleString() : '—'} chars</Badge>
                <Badge tone="slate">{previewData.lines != null ? previewData.lines.toLocaleString() : '—'} lines</Badge>
              </div>
            )}
            <div className="max-h-[55vh] overflow-y-auto whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
              {previewText || 'No text extracted from this file yet.'}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../services/api.js';
import { startVoice, supportsVoiceCapture } from '../services/voice.js';
import { Card, Badge, Loading, EmptyState, SectionTitle, Spinner } from '../components/ui.jsx';

const micCapable = typeof window !== 'undefined' && supportsVoiceCapture();

function fm(t) {
  if (!t) return '';
  const d = new Date(t);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function speakerLabel(s) {
  if (s === 'student') return 'You';
  if (s === 'moderator') return 'Moderator';
  if (s === 'ai') return 'Participant';
  return s || 'Participant';
}

function Bubble({ speaker, content }) {
  const isStudent = speaker === 'student';
  const isModerator = speaker === 'moderator' || String(speaker).toLowerCase() === 'moderator';
  const label = speakerLabel(speaker);
  if (isStudent) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[82%] rounded-2xl rounded-br-sm bg-primary-600 px-4 py-3 text-sm leading-relaxed text-white">
          <p className="whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[82%]">
        <div className={`inline-flex items-center gap-2 rounded-2xl rounded-bl-sm px-4 py-3 text-sm leading-relaxed ${isModerator ? 'bg-primary-50 text-primary-900 ring-1 ring-primary-100' : 'bg-slate-100 text-slate-800'}`}>
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${isModerator ? 'bg-primary-600' : 'bg-slate-400'}`}>
            {label ? label.charAt(0) : 'P'}
          </span>
          <span className="whitespace-pre-wrap">{content}</span>
        </div>
        <p className={`mt-1 text-[11px] font-semibold ${isModerator ? 'text-primary-600' : 'text-slate-400'}`}>{label}</p>
      </div>
    </div>
  );
}

function titleCase(k) {
  return k
    .replace(/([A-Z])/g, ' $1')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase());
}

function SummaryRenderer({ summary }) {
  if (summary == null) return <p className="text-sm text-slate-500">No feedback was returned for this session.</p>;

  if (typeof summary === 'string') {
    return <p className="text-sm leading-relaxed text-slate-700">{summary}</p>;
  }

  if (Array.isArray(summary)) {
    return (
      <ul className="space-y-1.5">
        {summary.map((s, i) => <li key={i} className="text-sm text-slate-700">• {typeof s === 'string' ? s : JSON.stringify(s)}</li>)}
      </ul>
    );
  }

  if (typeof summary === 'object') {
    const scalars = [];
    const lists = [];
    const nested = [];
    for (const [k, v] of Object.entries(summary)) {
      if (Array.isArray(v)) lists.push([k, v]);
      else if (v && typeof v === 'object') nested.push([k, v]);
      else scalars.push([k, v]);
    }

    const scoreEntry = scalars.find(([k]) => /score|rating/i.test(k));
    const scor = scoreEntry != null && typeof scoreEntry[1] === 'number' ? scoreEntry[1] : null;

    const paragraphKeys = ['summary', 'verdict', 'feedback', 'message', 'conclusion'];
    const mainParagraphs = scalars.filter(([k, v]) => paragraphKeys.includes(k.toLowerCase()) && typeof v === 'string');
    const remainingScalars = scalars.filter(([k]) => !paragraphKeys.includes(k.toLowerCase()) && !(/score|rating/i.test(k)));

    const toneFor = (k) => {
      if (/weak|improve|suggest|gap|issue|downside/i.test(k)) return 'orange';
      if (/strong|strength|point|good|positive|highlight/i.test(k)) return 'green';
      return 'slate';
    };

    return (
      <div className="space-y-5">
        {scor != null && (
          <div className="flex flex-col items-center gap-2">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary-50">
              <span className="text-3xl font-extrabold text-primary-700">{scor}</span>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Contribution Score</p>
          </div>
        )}

        {mainParagraphs.map(([k, v]) => (
          <p key={k} className="text-sm leading-relaxed text-slate-700">{v}</p>
        ))}

        {lists.map(([k, items]) => {
          const tone = toneFor(k);
          const entries = items.filter(Boolean);
          if (!entries.length) return null;
          return (
            <div key={k}>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titleCase(k)}</p>
              <ul className="mt-2 space-y-1.5">
                {entries.map((s, i) => (
                  <li key={i} className={`flex items-start gap-2 text-sm text-slate-700 ${tone === 'orange' ? 'text-amber-700' : ''}`}>
                    <svg className={`mt-0.5 shrink-0 ${tone === 'green' ? 'text-emerald-500' : tone === 'orange' ? 'text-amber-500' : 'text-slate-400'}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      {tone === 'green' ? <path d="M20 6 9 17l-5-5" /> : <path d="M12 3v12M12 19v.01" />}
                    </svg>
                    {typeof s === 'string' ? s : JSON.stringify(s)}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}

        {nested.map(([k, v]) => (
          <div key={k} className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titleCase(k)}</p>
            <div className="mt-1"><SummaryRenderer summary={v} /></div>
          </div>
        ))}

        {remainingScalars.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {remainingScalars.map(([k, v]) => (
              <div key={k} className="rounded-lg bg-slate-50 p-3 text-sm">
                <span className="font-semibold capitalize text-slate-700">{titleCase(k)}</span>
                <span className="text-slate-600">: {' '}{String(v)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return <p className="text-sm text-slate-500">Feedback summary is unavailable for this session.</p>;
}

export default function GdDebate() {
  const [view, setView] = useState('start'); // start | room | summary
  const [topics, setTopics] = useState([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [topicsError, setTopicsError] = useState('');

  const [kind, setKind] = useState('gd'); // gd | debate
  const [topic, setTopic] = useState('');
  const [surprise, setSurprise] = useState(true);
  const [side, setSide] = useState('for'); // for | against

  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [ending, setEnding] = useState(false);
  const [summary, setSummary] = useState(null);
  const [roomError, setRoomError] = useState('');
  const [startError, setStartError] = useState('');

  const [listening, setListening] = useState(false);
  const [micError, setMicError] = useState('');
  const [micBusy, setMicBusy] = useState(false);
  const voiceRecRef = useRef(null);

  const [showHistory, setShowHistory] = useState(false);
  const [sessions, setSessions] = useState(null);
  const [histLoading, setHistLoading] = useState(false);
  const [histError, setHistError] = useState('');
  const [histOpen, setHistOpen] = useState(null);

  useEffect(() => {
    loadTopics();
    return () => {
      if (voiceRecRef.current) {
        try { voiceRecRef.current.stop(); } catch (e) { /* ignore */ }
        voiceRecRef.current = null;
      }
    };
  }, []);

  async function loadTopics() {
    setTopicsLoading(true);
    setTopicsError('');
    try {
      const data = await request('/gd/topics');
      setTopics(Array.isArray(data.topics) ? data.topics : []);
    } catch (e) {
      setTopicsError(e.message || 'Could not load GD topics.');
    } finally {
      setTopicsLoading(false);
    }
  }

  async function start() {
    setStartError('');
    setRoomError('');
    try {
      const data = await request('/gd/start', {
        method: 'POST',
        body: { topic: surprise || !topic ? undefined : topic, kind, side },
      });
      setSession({ id: data.session.id, topic: data.session.topic, kind: data.session.kind, side: data.session.side });
      setMessages(Array.isArray(data.messages) ? data.messages : []);
      setSummary(null);
      setInput('');
      setView('room');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setStartError(e.message || 'Could not start the session.');
    }
  }

  async function contribute() {
    const text = input.trim();
    if (!text || sending || !session) return;
    setSending(true);
    setRoomError('');
    try {
      const data = await request(`/gd/${session.id}/contribute`, { method: 'POST', body: { message: text } });
      setMessages((prev) => [
        ...prev,
        { speaker: 'student', content: text },
        { speaker: data.response?.speaker || 'Participant', content: data.response?.text || '' },
      ]);
      setInput('');
    } catch (e) {
      setRoomError(e.message || 'Could not send your point.');
    } finally {
      setSending(false);
    }
  }

  async function toggleVoice() {
    if (listening) {
      const h = voiceRecRef.current;
      voiceRecRef.current = null;
      setListening(false);
      setMicBusy(true);
      try {
        const payload = h ? await h.stop() : null;
        const { base64 } = payload || {};
        if (!base64) throw new Error('No audio was captured.');
        const d = await request('/asr/transcribe', { method: 'POST', body: { audioBase64: base64 } });
        const t = (d && d.transcript || '').trim();
        if (t) setInput((prev) => [prev, t].filter(Boolean).join(' '));
        else setMicError('Could not hear clear speech. Try speaking closer to the mic, or type your point.');
      } catch (e) {
        setMicError(`Could not transcribe your voice. ${e.message || ''}`.trim());
      } finally {
        setMicBusy(false);
      }
      return;
    }

    setMicBusy(true);
    setMicError('');
    try {
      const h = await startVoice();
      voiceRecRef.current = h;
      setListening(true);
    } catch (e) {
      setMicError(`Could not start the microphone (${e.message || 'permission denied'}). Allow mic access or type your point.`);
    } finally {
      setMicBusy(false);
    }
  }

  async function end() {
    if (!session || ending) return;
    setEnding(true);
    setRoomError('');
    try {
      const data = await request(`/gd/${session.id}/end`, { method: 'POST' });
      setSummary(data.summary ?? null);
      setView('summary');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setRoomError(e.message || 'Could not end the session.');
    } finally {
      setEnding(false);
    }
  }

  function resetAll() {
    setView('start');
    setSession(null);
    setMessages([]);
    setSummary(null);
    setInput('');
    setStartError('');
    setRoomError('');
  }

  function toggleHistory() {
    setShowHistory((prev) => !prev);
    if (!showHistory && !sessions) loadHistory();
  }

  async function loadHistory() {
    setHistLoading(true);
    setHistError('');
    try {
      const data = await request('/gd/history');
      setSessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch (e) {
      setHistError(e.message || 'Could not load session history.');
    } finally {
      setHistLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">GD / Debate</h1>
          <p className="text-sm text-slate-500">Solo practice inside group discussions and debates with AI participants.</p>
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
      {roomError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="mt-0.5">{roomError}</p>
        </div>
      )}
      {topicsError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">Something went wrong</p>
          <p className="mt-0.5">{topicsError}</p>
          <button className="btn mt-3 !bg-red-600 !text-white hover:!bg-red-700" onClick={loadTopics}>Retry</button>
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
        <HistorySection loading={histLoading} sessions={sessions} onRetry={loadHistory} openId={histOpen} onOpen={setHistOpen} />
      )}

      {view === 'start' && !showHistory && (
        <Card>
          <SectionTitle sub="Group discussion or a formal debate. AI participants will push back on your points.">Setup</SectionTitle>

          <p className="label">Mode</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setKind('gd')}
              className={kind === 'gd' ? 'btn-primary' : 'btn-outline'}
            >
              Group Discussion
            </button>
            <button
              type="button"
              onClick={() => setKind('debate')}
              className={kind === 'debate' ? 'btn-primary' : 'btn-outline'}
            >
              Debate
            </button>
          </div>

          <p className="label mt-5">Topic</p>
          {topicsLoading ? (
            <p className="flex items-center gap-2 text-xs text-slate-400"><Spinner size={14} /> Loading topics…</p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <select className="input !w-auto" value={topic} onChange={(e) => { setTopic(e.target.value); if (e.target.value) setSurprise(false); }}>
                <option value="">— Choose a topic —</option>
                {topics.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <button
                type="button"
                onClick={() => { setSurprise(true); setTopic(''); }}
                className={`rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${surprise ? 'border-primary-500 bg-primary-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                🎲 Surprise me
              </button>
            </div>
          )}

          {kind === 'debate' && (
            <>
              <p className="label mt-5">Your side</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setSide('for')} className={side === 'for' ? 'btn-primary' : 'btn-outline'}>For</button>
                <button type="button" onClick={() => setSide('against')} className={side === 'against' ? 'btn-primary' : 'btn-outline'}>Against</button>
              </div>
            </>
          )}

          <div className="mt-6">
            <button type="button" className="btn-primary" onClick={start}>
              Start {kind === 'debate' ? 'Debate' : 'Discussion'}
            </button>
          </div>
        </Card>
      )}

      {view === 'room' && session && (
        <>
          <Card className="border-primary-100 bg-primary-50/60">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="purple">{kind === 'debate' ? 'Debate' : 'Group Discussion'}</Badge>
                  {kind === 'debate' && <Badge tone={side === 'for' ? 'green' : 'amber'}>{side === 'for' ? 'For' : 'Against'}</Badge>}
                </div>
                <p className="mt-1.5 text-sm font-bold text-slate-800">{session.topic}</p>
              </div>
              <button type="button" className="btn-outline !py-1.5 !text-xs" disabled={ending} onClick={end}>
                {ending ? <><Spinner size={12} /> Summarizing…</> : 'End & Get Feedback'}
              </button>
            </div>
            {kind === 'debate' && (
              <p className={`mt-3 rounded-lg px-3 py-2 text-sm font-bold ${side === 'for' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                You are arguing {side === 'for' ? 'FOR' : 'AGAINST'} this statement.
              </p>
            )}
          </Card>

          <Card className="flex h-[380px] flex-col">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-slate-800">Room</p>
              <p className="text-xs text-slate-400">{messages.length} messages</p>
            </div>
            <div className="flex-1 space-y-3 overflow-y-auto pr-1">
              {messages.map((m, i) => <Bubble key={`${i}-${m.speaker}-${m.content.slice(0, 12)}`} speaker={m.speaker} content={m.content} />)}
              {messages.length === 0 && <p className="text-sm text-slate-400">The room is empty. Start with a point.</p>}
            </div>
            <div className="mt-4 flex gap-3 border-t border-slate-100 pt-4">
              <input
                className="input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); contribute(); } }}
                placeholder="Type your point…"
              />
              {micCapable && (
                <button
                  type="button"
                  className={`btn shrink-0 ${listening ? '!bg-red-600 !text-white hover:!bg-red-700' : 'btn-outline'}`}
                  disabled={micBusy}
                  onClick={toggleVoice}
                  title={listening ? 'Stop recording — transcribe into your message' : 'Record your point and let the server transcribe it'}
                >
                  {micBusy ? <Spinner size={14} /> : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3zM5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
                  )}
                  <span className="ml-1.5">{listening ? 'Stop · transcribing' : 'Speak'}</span>
                </button>
              )}
              <button type="button" className="btn-primary shrink-0" disabled={!input.trim() || sending} onClick={contribute}>
                {sending ? <Spinner size={14} /> : 'Send'}
              </button>
            </div>
            {micError && <p className="mt-2 text-xs text-red-600">{micError}</p>}
            {listening && (
              <p className="mt-2 flex items-center gap-2 text-xs font-semibold text-emerald-600">
                <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                Listening — say your point. Press “Stop · transcribing” when done.
              </p>
            )}
          </Card>
        </>
      )}

      {view === 'summary' && session && (
        <Card className="p-6">
          <SectionTitle sub="Server feedback on your participation in this session.">Session Feedback</SectionTitle>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Badge tone="purple">{kind === 'debate' ? 'Debate' : 'Group Discussion'}</Badge>
            {session.topic && <Badge tone="blue">{session.topic}</Badge>}
          </div>
          {summary ? <SummaryRenderer summary={summary} /> : <Loading label="Building your feedback…" />}
          <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-100 pt-4">
            <button type="button" className="btn-primary" onClick={resetAll}>Start New Session</button>
            <Link to="/gd" className="btn-outline">Back to Setup</Link>
          </div>
        </Card>
      )}
    </div>
  );
}

function HistorySection({ loading, sessions, onRetry, openId, onOpen }) {
  if (loading) return <Loading label="Loading your sessions…" />;

  if (!sessions || sessions.length === 0) {
    return (
      <EmptyState
        icon="💬"
        title="No sessions yet"
        subtitle="Start a GD or debate and your sessions will appear here."
        action={<button type="button" className="btn-primary" onClick={onRetry}>Refresh</button>}
      />
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((s) => {
        const open = openId === s.id;
        const msgs = Array.isArray(s.messages) ? s.messages : [];
        return (
          <Card key={s.id}>
            <button
              type="button"
              className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
              onClick={() => onOpen(open ? null : s.id)}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-slate-800">{s.topic}</span>
                  <Badge tone="slate">{s.kind === 'debate' ? 'Debate' : 'GD'}</Badge>
                  {s.side && <Badge tone={s.side === 'for' ? 'green' : 'amber'}>{s.side === 'for' ? 'For' : 'Against'}</Badge>}
                  <Badge tone={s.status === 'completed' ? 'green' : 'slate'}>{s.status === 'completed' ? 'Completed' : s.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-400">{fm(s.createdAt)} · {msgs.length} messages</p>
              </div>
              <span className="text-xs font-semibold text-slate-400">{open ? 'Hide ▴' : 'Show ▾'}</span>
            </button>
            {open && (
              <div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto border-t border-slate-100 pt-4 pr-1">
                {msgs.map((m, i) => <Bubble key={i} speaker={m.speaker} content={m.content} />)}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
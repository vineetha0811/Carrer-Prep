import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../services/api.js';
import { startVoice, supportsVoiceCapture } from '../services/voice.js';
import { Card, Badge, Loading, EmptyState, SectionTitle, Spinner, ProgressBar } from '../components/ui.jsx';

const PURPOSES = ['Introduce', 'Explain', 'Convince', 'Report', 'Story'];
const STRUCTURE_TYPES = ['Chronological', 'Problem→Solution', 'Anecdote', 'Fact-based', 'STAR'];

const PURPOSE_OPENERS = {
  Introduce: 'Opening: Introduce the topic in one line — “{topic}” and why it matters.',
  Explain: 'Opening: Define the topic clearly — “{topic} is basically…” then unpack it.',
  Convince: 'Opening: State your position — “I believe {topic} deserves attention because…”',
  Report: 'Opening: Set the scene — “Here is a quick snapshot of {topic} and where it stands.”',
  Story: 'Opening: Capture attention — “Let me start with a short story about {topic}.”',
};

const STRUCTURE_GUIDANCE = {
  'Chronological': 'Body: Walk through events in time order — start, turning point, outcome.',
  'Problem→Solution': 'Body: Name the problem, its cost, then the solution that worked.',
  'Anecdote': 'Body: Tell one relevant story, then connect it back to the point.',
  'Fact-based': 'Body: Lead with 2-3 concrete facts or numbers, then explain why they matter.',
  'STAR': 'Body: Situation, Task, Action, Result — one real example from your experience.',
};

const DEFAULT_DURATIONS = [
  { label: '1 min', value: 60 },
  { label: '2 min', value: 120 },
];

const SR = typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition);
const voiceSupported = Boolean(SR);
const captureSupported = typeof window !== 'undefined' && supportsVoiceCapture();

function fmtTime(sec) {
  if (sec == null || isNaN(sec)) return '0:00';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function fmtDate(d) {
  if (!d) return '';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' + date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function parseBuilder(builder) {
  if (typeof builder === 'string') {
    try {
      const v = JSON.parse(builder);
      return v;
    } catch (e) {
      return builder;
    }
  }
  return builder || null;
}

function openingText(purpose, topic) {
  const t = topic || 'the topic at hand';
  return (PURPOSE_OPENERS[purpose] || PURPOSE_OPENERS.Introduce).split('{topic}').join(t);
}

function buildSkeleton(builder, purpose, structure, topic) {
  const lines = [];
  lines.push({ tag: 'Opening', kind: 'opening', text: openingText(purpose, topic) });
  lines.push({ tag: 'Body', kind: 'body', text: STRUCTURE_GUIDANCE[structure] || STRUCTURE_GUIDANCE['Chronological'] });

  const parsed = parseBuilder(builder);
  let customSteps = null;
  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.structure)) {
    customSteps = parsed.structure;
  } else if (typeof parsed === 'string') {
    lines.push({ tag: 'Guidance', kind: 'builder', text: parsed });
  }

  if (customSteps && customSteps.length) {
    customSteps.forEach((s) => {
      if (s && typeof s === 'object' && s.detail) {
        lines.push({ tag: s.step || 'Point', kind: 'builder', text: s.detail });
      }
    });
  } else {
    lines.push({ tag: 'Point 1', kind: 'builder', text: 'Main point / key idea about the topic.' });
    lines.push({ tag: 'Point 2', kind: 'builder', text: 'One concrete example or piece of evidence.' });
  }

  lines.push({ tag: 'Closing', kind: 'closing', text: 'Closing: Summarize your main point in one line and add a clear next step.' });
  return lines;
}

function durationOptions(durations) {
  if (durations && typeof durations === 'object' && !Array.isArray(durations)) {
    const opts = Object.entries(durations)
      .map(([label, value]) => ({ label, value: Number(value) }))
      .filter((o) => Number.isFinite(o.value));
    if (opts.length) return opts;
  }
  return DEFAULT_DURATIONS;
}

function parseEval(e) {
  if (!e) return {};
  if (typeof e === 'string') {
    try {
      const v = JSON.parse(e);
      return v && typeof v === 'object' ? v : {};
    } catch (err) {
      return {};
    }
  }
  return e && typeof e === 'object' ? e : {};
}

function barColor(v) {
  if (v >= 70) return 'bg-emerald-500';
  if (v >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

function barTextColor(v) {
  if (v >= 70) return 'text-emerald-500';
  if (v >= 50) return 'text-amber-500';
  return 'text-red-500';
}

function ringColor(v) {
  if (v >= 70) return '#10b981';
  if (v >= 50) return '#f59e0b';
  return '#ef4444';
}

function ScoreRing({ score }) {
  const R = 42;
  const CIRC = 2 * Math.PI * R;
  const pct = Math.max(0, Math.min(100, Number(score) || 0));
  return (
    <div className="relative inline-flex h-[120px] w-[120px] items-center justify-center">
      <svg className="h-[120px] w-[120px] -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={R} fill="none" stroke="#e2e8f0" strokeWidth="10" />
        <circle
          cx="60" cy="60" r={R} fill="none"
          stroke={ringColor(pct)} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * CIRC} ${CIRC}`}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-extrabold text-slate-900">{Math.round(pct)}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">overall</span>
      </div>
    </div>
  );
}

function ChipButton({ active, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-4 py-2.5 text-sm font-semibold transition-colors ${className} ${
        active
          ? 'border-primary-500 bg-primary-600 text-white'
          : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {children}
    </button>
  );
}

export default function SpeakingLab() {
  const [tab, setTab] = useState('practice');

  const [topics, setTopics] = useState([]);
  const [durations, setDurations] = useState(null);
  const [builder, setBuilder] = useState(null);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [topicsError, setTopicsError] = useState('');

  const [purpose, setPurpose] = useState('Introduce');
  const [structure, setStructure] = useState('Chronological');
  const [topic, setTopic] = useState('');
  const [durationSec, setDurationSec] = useState(60);

  const [session, setSession] = useState(null);
  const [creating, setCreating] = useState(false);
  const [practiceError, setPracticeError] = useState('');

  const [status, setStatus] = useState('idle'); // idle | recording | done | evaluating
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimText, setInterimText] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [recError, setRecError] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [evaluation, setEvaluation] = useState(null);
  const [asrAvailable, setAsrAvailable] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  const [historySessions, setHistorySessions] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [expandedSession, setExpandedSession] = useState(null);
  const [compareData, setCompareData] = useState(null); // { sessionId, pairs, loading, error }

  const finalTranscriptRef = useRef('');
  const interimRef = useRef('');
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const timeRemainingRef = useRef(60);
  const manualStopRef = useRef(false);
  const engineRetryRef = useRef(0);
  const voiceRecRef = useRef(null);
  const audioB64Ref = useRef('');

  const queryTopic = typeof window !== 'undefined'
    ? (new URLSearchParams(window.location.search).get('topic') || '').trim()
    : '';

  useEffect(() => {
    loadTopics();
    return () => {
      manualStopRef.current = true;
      if (timerRef.current) clearInterval(timerRef.current);
      if (recognitionRef.current) {
        try { recognitionRef.current.onend = null; recognitionRef.current.stop(); } catch (e) { /* ignore */ }
      }
      if (voiceRecRef.current) {
        try { voiceRecRef.current.stop(); } catch (e) { /* ignore */ }
        voiceRecRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setAsrAvailable(false);
    request('/asr/status')
      .then((d) => setAsrAvailable(Boolean(d && d.available)))
      .catch(() => setAsrAvailable(false));
  }, []);

  useEffect(() => {
    const opts = durationOptions(durations);
    if (opts.some((o) => o.value === 60)) return;
    if (opts.length) setDurationSec(opts[0].value);
  }, [durations]);

  async function loadTopics() {
    setTopicsLoading(true);
    setTopicsError('');
    try {
      const data = await request('/speaking/topics');
      const list = Array.isArray(data.topics) ? data.topics : [];
      setTopics(list);
      setDurations(data.durations || null);
      setBuilder(data.builder || null);
      const opts = durationOptions(data.durations || null);
      if (opts.some((o) => o.value === 60)) setDurationSec(60);
      else if (opts.length) setDurationSec(opts[0].value);
      if (queryTopic) setTopic(queryTopic);
      else if (list.length) setTopic(list[0]);
    } catch (e) {
      setTopicsError(e.message || 'Could not load speaking topics.');
    } finally {
      setTopicsLoading(false);
    }
  }

  async function createSession() {
    if (!topic || creating) return;
    setCreating(true);
    setPracticeError('');
    try {
      const data = await request('/speaking/session', {
        method: 'POST',
        body: { topic, durationSec, kind: 'builder' },
      });
      setSession(data.session);
      setStatus('idle');
      setTranscript('');
      setInterimText('');
      setSecondsLeft(data.session.durationSec || durationSec);
      setEvaluation(null);
      setRecError('');
      setSubmitError('');
      finalTranscriptRef.current = '';
      interimRef.current = '';
      audioB64Ref.current = '';
      setTranscribing(false);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setPracticeError(e.message || 'Could not create speaking session.');
    } finally {
      setCreating(false);
    }
  }

  function flushInterim() {
    const i = interimRef.current.trim();
    if (!i) return;
    finalTranscriptRef.current = [finalTranscriptRef.current, i].filter(Boolean).join(' ');
    interimRef.current = '';
    setTranscript(finalTranscriptRef.current);
    setInterimText('');
  }

  function stopVoiceCapture() {
    const h = voiceRecRef.current;
    if (!h) return;
    voiceRecRef.current = null;
    h.stop()
      .then((r) => { if (r && r.base64) audioB64Ref.current = r.base64; })
      .catch(() => { /* capture already stopped */ });
  }

  function finishRecording(silent) {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    flushInterim();
    stopVoiceCapture();
    if (recognitionRef.current) {
      try { recognitionRef.current.onend = null; recognitionRef.current.stop(); } catch (e) { /* ignore */ }
      recognitionRef.current = null;
    }
    setRecording(false);
    if (!silent) setStatus('done');
  }

  function stopRec() {
    manualStopRef.current = true;
    finishRecording(false);
  }

  // Build a fresh SpeechRecognition engine. Chrome auto-stops the recognizer
  // after ~silence; we reconnect it automatically so the full speaking slot is
  // captured and the recording never dies silently in the middle of an answer.
  function makeEngine() {
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';

    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i += 1) {
        const r = e.results[i];
        if (r.isFinal) {
          const t = (r[0] && r[0].transcript ? r[0].transcript : '').trim();
          if (t) finalTranscriptRef.current = [finalTranscriptRef.current, t].filter(Boolean).join(' ');
        } else {
          interim += r[0] && r[0].transcript ? r[0].transcript : '';
        }
      }
      interimRef.current = interim;
      setTranscript(finalTranscriptRef.current);
      setInterimText(interim);
    };

    rec.onerror = (ev) => {
      const code = ev && ev.error;
      if (code === 'not-allowed' || code === 'service-not-allowed') {
        manualStopRef.current = true;
        setRecError('Microphone permission was denied. Enable mic access in your browser, or type your answer below.');
        finishRecording(false);
        return;
      }
      // Transient failures (network / aborted / no-speech / audio-capture) —
      // retry a few times, then surface the error honestly.
      engineRetryRef.current += 1;
      if (engineRetryRef.current > 4 || timeRemainingRef.current <= 0) {
        manualStopRef.current = true;
        setRecError('Speech recognition failed. Check your microphone and connection, or type your answer below.');
        finishRecording(false);
        return;
      }
      setTimeout(() => {
        if (!manualStopRef.current && timeRemainingRef.current > 0) startEngine();
      }, 400);
    };

    rec.onend = () => {
      recognitionRef.current = null;
      if (!manualStopRef.current && timeRemainingRef.current > 0) {
        engineRetryRef.current = 0;
        setTimeout(() => {
          if (!manualStopRef.current && timeRemainingRef.current > 0) startEngine();
        }, 200);
        return;
      }
      flushInterim();
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setRecording(false);
      if (statusRef.current === 'recording') setStatus('done');
    };

    return rec;
  }

  function startEngine() {
    if (manualStopRef.current) return;
    try {
      const rec = makeEngine();
      recognitionRef.current = rec;
      rec.start();
    } catch (e) {
      // e.g. insecure (non-localhost LAN) context → give up gracefully
      manualStopRef.current = true;
      setRecError('Could not start voice recognition. Type your answer below instead.');
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setRecording(false);
      setStatus('done');
    }
  }

  function beginRecording() {
    if (!session) return;
    setPracticeError('');
    setRecError('');
    setSubmitError('');
    setTranscript('');
    setInterimText('');
    setEvaluation(null);
    finalTranscriptRef.current = '';
    interimRef.current = '';
    audioB64Ref.current = '';
    manualStopRef.current = false;
    engineRetryRef.current = 0;

    const dur = session.durationSec || 60;
    timeRemainingRef.current = dur;
    setSecondsLeft(dur);

    if (!SR && !captureSupported) {
      setStatus('done');
      return;
    }

    if (SR) startEngine();

    // Capture real microphone audio so the server can transcribe what was spoken.
    // Works even when the browser exposes no Web Speech API.
    if (captureSupported) {
      startVoice()
        .then((h) => { voiceRecRef.current = h; })
        .catch((e) => {
          setRecError(`Could not start the microphone (${e.message || 'permission denied'}). Allow mic access, or type your answer below.`);
        });
    }

    setStatus('recording');
    setRecording(true);

    const iv = setInterval(() => {
      timeRemainingRef.current -= 1;
      if (timeRemainingRef.current <= 0) {
        timeRemainingRef.current = 0;
        setSecondsLeft(0);
        stopRec();
      } else {
        setSecondsLeft(timeRemainingRef.current);
      }
    }, 1000);
    timerRef.current = iv;
  }

  const statusRef = useRef(status);
  statusRef.current = status;

  async function submitEvaluation() {
    const useAudio = asrAvailable && Boolean(audioB64Ref.current);
    let text = transcript.trim();

    if (useAudio) {
      setStatus('evaluating');
      setTranscribing(true);
      setSubmitError('');
      try {
        const d = await request('/asr/transcribe', {
          method: 'POST',
          body: { audioBase64: audioB64Ref.current },
        });
        const t = (d && d.transcript || '').trim();
        if (t) {
          setTranscript(t);
          text = t;
        }
      } catch (e) {
        setSubmitError(`Could not transcribe your voice. ${e.message || 'Check the server speech engine.'}`);
        setTranscribing(false);
        setStatus('done');
        return;
      }
      setTranscribing(false);
    }

    if (!text) {
      setSubmitError('Please provide a transcript before evaluating.');
      setStatus('done');
      return;
    }
    setStatus('evaluating');
    setSubmitError('');
    try {
      const data = await request('/speaking/attempt', {
        method: 'POST',
        body: { sessionId: session.id, transcript: text, durationSec: session.durationSec || 60 },
      });
      setEvaluation(data.evaluation || {});
      setStatus('result');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setSubmitError(e.message || 'Could not evaluate your speech.');
      setStatus('done');
    }
  }

  function tryAgain() {
    finalTranscriptRef.current = '';
    interimRef.current = '';
    setTranscript('');
    setInterimText('');
    setEvaluation(null);
    setRecError('');
    setSubmitError('');
    setSecondsLeft(session ? session.durationSec : 60);
    setStatus('idle');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function newTopic() {
    setSession(null);
    setStatus('idle');
    setTranscript('');
    setInterimText('');
    setEvaluation(null);
    setRecError('');
    setSubmitError('');
    setPracticeError('');
    finalTranscriptRef.current = '';
    interimRef.current = '';
    audioB64Ref.current = '';
    setTranscribing(false);
  }

  function openHistoryTab() {
    setTab('history');
    if (!historySessions) loadHistory();
  }

  async function loadHistory() {
    setHistoryLoading(true);
    setHistoryError('');
    try {
      const data = await request('/speaking/history');
      setHistorySessions(Array.isArray(data.sessions) ? data.sessions : []);
    } catch (e) {
      setHistoryError(e.message || 'Could not load your speaking history.');
    } finally {
      setHistoryLoading(false);
    }
  }

  async function loadCompare(sessionId) {
    setCompareData({ sessionId, pairs: [], loading: true, error: '' });
    try {
      const data = await request(`/speaking/compare/${sessionId}`);
      setCompareData({ sessionId, pairs: Array.isArray(data.pairs) ? data.pairs : [], loading: false, error: '' });
    } catch (e) {
      setCompareData({ sessionId, pairs: [], loading: false, error: e.message || 'Could not compare attempts.' });
    }
  }

  const allTopicOptions = topic ? [topic] : [];
  if (queryTopic && !allTopicOptions.includes(queryTopic)) allTopicOptions.unshift(queryTopic);
  topics.forEach((t) => { if (!allTopicOptions.includes(t)) allTopicOptions.push(t); });

  const skeleton = buildSkeleton(builder, purpose, structure, topic);
  const durOptions = durationOptions(durations);

  const evalv = parseEval(evaluation);
  const metricRows = [
    { label: 'Fluency', value: evalv.fluency },
    { label: 'Structure', value: evalv.structure },
    { label: 'Grammar', value: evalv.grammar != null ? evalv.grammar : evalv.grammarScore },
    { label: 'Vocabulary', value: evalv.vocabulary },
    { label: 'Content', value: evalv.content },
  ].filter((m) => typeof m.value === 'number');

  const fillerWords = Array.isArray(evalv.fillerWords) ? evalv.fillerWords : [];
  const didWell = Array.isArray(evalv.didWell) ? evalv.didWell.filter(Boolean) : [];
  const needImp = Array.isArray(evalv.needsImprovement) ? evalv.needsImprovement.filter(Boolean) : [];
  const bullets = Array.isArray(evalv.bullets) ? evalv.bullets.filter(Boolean) : [];
  const tipsObj = evalv.tips && typeof evalv.tips === 'object' && !Array.isArray(evalv.tips) ? evalv.tips : null;
  const specificMistakes = Array.isArray(evalv.specificMistakes) ? evalv.specificMistakes.filter(Boolean) : [];

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Speaking Lab</h1>
          <p className="text-sm text-slate-500">Practice talking out loud with instant, honest feedback.</p>
        </div>
        <Link to="/" className="btn-ghost">← Dashboard</Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab('practice')}
          className={tab === 'practice' ? 'btn-primary' : 'btn-outline'}
        >
          Practice
        </button>
        <button
          type="button"
          onClick={openHistoryTab}
          className={tab === 'history' ? 'btn-primary' : 'btn-outline'}
        >
          History & Progress
        </button>
      </div>

      {topicsError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">Something went wrong</p>
          <p className="mt-0.5">{topicsError}</p>
          <button className="btn mt-3 !bg-red-600 !text-white hover:!bg-red-700" onClick={loadTopics}>Retry</button>
        </div>
      )}

      {practiceError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="mt-0.5">{practiceError}</p>
        </div>
      )}

      {tab === 'practice' && (
        <div className="space-y-5">
          <Card className="border-primary-100 bg-primary-50/50">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-600 text-white">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3zM5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
              </span>
              <p className="text-xs leading-relaxed text-slate-600">
                Feedback here is generated from your transcript by the server — it is meant to be specific and honest, not flattering. Focus on the concrete points under <span className="font-semibold">needs improvement</span> and re-record.
              </p>
            </div>
          </Card>

          <Card>
            <SectionTitle sub="Layer by layer: purpose → structure → topic. Guidance builds into your skeleton below.">Answer Builder</SectionTitle>

            <p className="label">Step 1 · Purpose — sets your opening line</p>
            <div className="flex flex-wrap gap-2">
              {PURPOSES.map((p) => (
                <ChipButton key={p} active={purpose === p} onClick={() => setPurpose(p)}>{p}</ChipButton>
              ))}
            </div>

            <p className="label mt-5">Step 2 · Structure — how to organise the middle</p>
            <div className="flex flex-wrap gap-2">
              {STRUCTURE_TYPES.map((s) => (
                <ChipButton key={s} active={structure === s} onClick={() => setStructure(s)}>{s}</ChipButton>
              ))}
            </div>

            <p className="label mt-5">Step 3 · Topic — what you will talk about</p>
            {topicsLoading ? (
              <p className="flex items-center gap-2 text-xs text-slate-400"><Spinner size={14} /> Loading topics…</p>
            ) : (
              <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto pr-1">
                {allTopicOptions.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTopic(t)}
                    title={t}
                    className={`max-w-full truncate rounded-lg border px-3 py-2 text-left text-[13px] font-medium transition-colors ${
                      topic === t ? 'border-primary-500 bg-primary-600 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}

            <p className="label mt-5">Duration</p>
            <div className="flex flex-wrap gap-2">
              {durOptions.map((o) => (
                <ChipButton key={o.value} active={durationSec === o.value} onClick={() => setDurationSec(o.value)}>
                  {o.label}
                </ChipButton>
              ))}
            </div>

            <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
              <button
                type="button"
                className="btn-primary h-fit"
                disabled={!topic || creating || topicsLoading}
                onClick={createSession}
              >
                {creating ? <><Spinner size={14} /> Starting session…</> : 'Practice This'}
              </button>

              <Card className="border-primary-100 bg-primary-50/50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-primary-700">Your skeleton</p>
                <ul className="mt-3 space-y-2">
                  {skeleton.map((line) => (
                    <li key={line.text} className="flex items-start gap-2 text-[13px] leading-snug text-slate-700">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />
                      <span>
                        <span className="font-semibold text-slate-800">{line.tag}: </span>
                        {line.text}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </Card>

          {session && (
            evaluation && status === 'result' ? (
              <EvaluationCard
                session={session}
                evalv={evalv}
                metricRows={metricRows}
                fillerWords={fillerWords}
                didWell={didWell}
                needImp={needImp}
                bullets={bullets}
                tipsObj={tipsObj}
                specificMistakes={specificMistakes}
                onTryAgain={tryAgain}
                onNewTopic={newTopic}
                ScoreRing={ScoreRing}
                barColor={barColor}
              />
            ) : (
              <Card>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-slate-900">Record your answer</h3>
                    <p className="mt-0.5 line-clamp-2 max-w-lg text-sm text-slate-500">{session.topic}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge tone="blue">{durOptions.find((o) => o.value === (session.durationSec || 60))?.label || 'Timed'}</Badge>
                    <button type="button" className="btn-outline !py-1.5 !text-xs" onClick={newTopic}>New Topic</button>
                  </div>
                </div>

                {!voiceSupported && !captureSupported && (
                  <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                    This browser does not expose the microphone APIs, so recording is unavailable here. Type your answer in the box below.
                  </div>
                )}
                {recError && (
                  <div className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{recError}</div>
                )}
                {asrAvailable && captureSupported && (
                  <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-700">
                    Your voice is recorded in the browser and transcribed by the server speech engine — no external speech API needed.
                  </div>
                )}

                {(voiceSupported || captureSupported) && status === 'idle' && (
                  <div className="mt-5 flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 py-10 text-center">
                    <button type="button" className="btn-primary" onClick={beginRecording}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3zM5 11a7 7 0 0 0 14 0M12 18v3" /></svg>
                      Start Recording
                    </button>
                    <p className="text-xs text-slate-500">Speak for about {durOptions.find((o) => o.value === (session.durationSec || 60))?.label || `${session.durationSec || 60}s`}. The timer stops automatically.</p>
                  </div>
                )}

                {(voiceSupported || captureSupported) && status === 'recording' && (
                  <div className="mt-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${secondsLeft < 30 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                        <span className={`h-2 w-2 rounded-full ${secondsLeft < 30 ? 'animate-pulse bg-red-500' : 'animate-pulse bg-emerald-500'}`} />
                        Recording · {fmtTime(secondsLeft)}
                      </span>
                      <button type="button" className="btn !bg-red-600 !text-white hover:!bg-red-700" onClick={stopRec}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                        Stop
                      </button>
                    </div>
                    <div className="mt-3 min-h-[120px] rounded-xl bg-slate-900 p-4 text-sm leading-relaxed text-slate-100">
                      {transcript || interimText ? (
                        <>
                          {transcript && <span>{transcript} </span>}
                          {interimText && <span className="text-primary-300">{interimText}</span>}
                        </>
                      ) : (
                        <span className="text-slate-400">
                          {voiceSupported ? 'Listening… speak now. Your words will appear here live.' : 'Recording your voice… it will be transcribed when you stop.'}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {(status === 'done' || (!voiceSupported && !captureSupported)) && status !== 'evaluating' && (
                  <div className="mt-5 space-y-3">
                    <p className="label !mb-0">Transcript — correct or re-type anything misheard</p>
                    <textarea
                      className="input min-h-[140px] font-normal leading-relaxed"
                      value={transcript}
                      onChange={(e) => setTranscript(e.target.value)}
                      placeholder={voiceSupported
                        ? 'Your speech will appear here after you stop. Fix errors before submitting.'
                        : captureSupported
                          ? 'Your recording will be transcribed here when you evaluate. Fix anything the engine misheard.'
                          : 'Type what you would say for this topic…'}
                    />
                    {submitError && <p className="text-xs text-red-600">{submitError}</p>}
                    <button type="button" className="btn-primary" disabled={status === 'evaluating'} onClick={submitEvaluation}>
                      {status === 'evaluating' ? <><Spinner size={14} /> {transcribing ? 'Transcribing…' : 'Evaluating…'}</> : 'Evaluate My Speaking'}
                    </button>
                    {asrAvailable && captureSupported && audioB64Ref.current && (
                      <p className="text-xs text-emerald-600">Your voice recording is ready — it will be transcribed on the server for honest evaluation.</p>
                    )}
                  </div>
                )}

                {status === 'evaluating' && (
                  <p className="mt-4 flex items-center gap-2 text-xs text-slate-400"><Spinner size={14} /> {transcribing ? 'Transcribing your voice…' : 'Evaluating your speech…'}</p>
                )}
              </Card>
            )
          )}
        </div>
      )}

      {tab === 'history' && (
        <HistoryPanel
          sessions={historySessions}
          loading={historyLoading}
          error={historyError}
          onRetry={loadHistory}
          expanded={expandedSession}
          onExpand={setExpandedSession}
          compareData={compareData}
          onCompare={loadCompare}
        />
      )}
    </div>
  );
}

function EvaluationCard({ session, evalv, metricRows, fillerWords, didWell, needImp, bullets, tipsObj, specificMistakes, onTryAgain, onNewTopic, ScoreRing, barColor }) {
  const [showCoach, setShowCoach] = useState(true);
  const overall = typeof evalv.overall === 'number' ? evalv.overall : 0;
  return (
    <Card className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <SectionTitle sub="Server-generated feedback on this attempt. Review the specifics — they point to exactly what to fix.">Feedback</SectionTitle>
          <div className="flex flex-wrap gap-2">
            <Badge tone="blue">{session.topic}</Badge>
            <Badge tone="slate">{session.durationSec || 60} sec · attempt evaluated</Badge>
          </div>
        </div>
        <ScoreRing score={overall} />
      </div>

      {metricRows.length > 0 && (
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          {metricRows.map((m) => (
            <div key={m.label} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-sm font-medium text-slate-600">{m.label}</span>
              <ProgressBar value={m.value} max={100} color={barColor(m.value)} className="flex-1" />
              <span className={`w-10 text-right text-sm font-bold ${barTextColor(m.value)}`}>{Math.round(m.value)}</span>
            </div>
          ))}
        </div>
      )}

      {(typeof evalv.wordCount === 'number' || typeof evalv.wpm === 'number' || typeof evalv.fillerCount === 'number' || typeof evalv.pronunciation === 'number') && (
        <div className="flex flex-wrap gap-2">
          {typeof evalv.wordCount === 'number' && <Badge tone="slate">{evalv.wordCount} words</Badge>}
          {typeof evalv.wpm === 'number' && <Badge tone="slate">{evalv.wpm} wpm</Badge>}
          {typeof evalv.fillerCount === 'number' && <Badge tone={evalv.fillerCount > 0 ? 'amber' : 'green'}>filler words: {evalv.fillerCount}</Badge>}
          {typeof evalv.pronunciation === 'number' && <Badge tone="purple">delivery proxy {evalv.pronunciation}</Badge>}
          {evalv.topicCovered != null && <Badge tone={evalv.topicCovered ? 'green' : 'red'}>{evalv.topicCovered ? 'Topic covered' : 'Topic not clearly covered'}</Badge>}
          {evalv.speed != null && <Badge tone="slate">speed {evalv.speed}</Badge>}
        </div>
      )}

      {fillerWords.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Watch for these filler words</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {fillerWords.map((f) => <Badge key={f} tone="amber">“{f}”</Badge>)}
          </div>
        </div>
      )}

      {didWell.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">What worked</p>
          <ul className="mt-2 space-y-1.5">
            {didWell.map((d) => (
              <li key={d} className="flex items-start gap-2 text-sm text-slate-700">
                <svg className="mt-0.5 shrink-0 text-emerald-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5" /></svg>
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}

      {needImp.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-600">Needs improvement</p>
          <ul className="mt-2 space-y-1.5">
            {needImp.map((d) => (
              <li key={d} className="flex items-start gap-2 text-sm text-slate-700">
                <svg className="mt-0.5 shrink-0 text-amber-500" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 3v12M12 19v.01" /></svg>
                {d}
              </li>
            ))}
          </ul>
        </div>
      )}

      {bullets.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Score explanation</p>
          <ul className="mt-2 space-y-1.5">
            {bullets.map((b) => (
              <li key={b} className="text-sm text-slate-700">• {b}</li>
            ))}
          </ul>
        </div>
      )}

      {tipsObj && Object.keys(tipsObj).length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tips</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {Object.entries(tipsObj).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-slate-50 p-3 text-sm">
                <span className="font-semibold capitalize text-slate-700">{k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}: </span>
                <span className="text-slate-600">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(specificMistakes.length > 0 || evalv.betterWay || evalv.recommendation) && (
        <div className="rounded-xl border border-primary-100 bg-primary-50/50 p-4">
          <button
            type="button"
            className="flex w-full items-center justify-between text-left"
            onClick={() => setShowCoach(!showCoach)}
          >
            <span className="text-sm font-bold text-slate-800">Coach notes</span>
            <span className="text-xs text-slate-500">{showCoach ? 'Hide' : 'Show'}</span>
          </button>
          {showCoach && (
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              {specificMistakes.map((m) => <p key={m}>• {m}</p>)}
              {evalv.betterWay && <p className="text-emerald-700">💡 {evalv.betterWay}</p>}
              {evalv.recommendation && <p className="rounded-lg bg-white p-2.5 text-slate-700">{evalv.recommendation}</p>}
            </div>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
        <button type="button" className="btn-primary" onClick={onTryAgain}>Try Again</button>
        <button type="button" className="btn-outline" onClick={onNewTopic}>New Topic</button>
      </div>
    </Card>
  );
}

function HistoryPanel({ sessions, loading, error, onRetry, expanded, onExpand, compareData, onCompare }) {
  if (loading) return <Loading label="Loading your speaking history…" />;

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        <p className="font-semibold">Something went wrong</p>
        <p className="mt-0.5">{error}</p>
        <button className="btn mt-3 !bg-red-600 !text-white hover:!bg-red-700" onClick={onRetry}>Retry</button>
      </div>
    );
  }

  if (!sessions || sessions.length === 0) {
    return (
      <EmptyState
        icon="🎙️"
        title="No speaking sessions yet"
        subtitle="Complete a speaking practice and your attempts will show up here with scores."
        action={<Link to="/speaking" className="btn-primary">Start Practice</Link>}
      />
    );
  }

  return (
    <div className="space-y-4">
      {sessions.map((s) => {
        const attempts = Array.isArray(s.attempts) ? s.attempts : [];
        const last = attempts.length ? attempts[attempts.length - 1] : null;
        const open = expanded === s.id;
        return (
          <Card key={s.id}>
            <button
              type="button"
              className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
              onClick={() => onExpand(open ? null : s.id)}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-slate-800">{s.topic}</span>
                  <Badge tone="purple">{s.kind || 'speaking'}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-400">
                  {fmtDate(s.createdAt)} · {attempts.length} attempt{attempts.length === 1 ? '' : 's'}
                  {typeof last?.overall === 'number' && <span className="ml-1">· last score <span className="font-bold text-slate-600">{last.overall}</span></span>}
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-400">{open ? 'Hide ▴' : 'Show ▾'}</span>
            </button>

            {open && (
              <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                {attempts.length === 0 && <p className="text-sm text-slate-400">No attempts recorded for this session yet.</p>}

                {attempts.map((a) => {
                  const ev = parseEval(a.evaluation);
                  const wc = typeof ev.wordCount === 'number' ? ev.wordCount : null;
                  return (
                    <div key={a.id} className="rounded-xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="blue">Attempt {a.attemptNo}</Badge>
                        <Badge tone={a.overall >= 70 ? 'green' : a.overall >= 50 ? 'amber' : 'red'}>Overall {a.overall ?? '—'}</Badge>
                        <Badge tone="slate">Fluency {a.fluency ?? '—'}</Badge>
                        <Badge tone="slate">Structure {a.structure ?? '—'}</Badge>
                        <Badge tone="slate">Grammar {a.gramScore ?? (ev.grammarScore ?? '—')}</Badge>
                        {wc != null && <Badge tone="slate">{wc} words</Badge>}
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{a.transcript}</p>
                    </div>
                  );
                })}

                {attempts.length >= 2 && (
                  <div>
                    <button
                      type="button"
                      className="btn-outline !py-1.5 !text-xs"
                      onClick={() => onCompare(s.id)}
                    >
                      Compare attempts
                    </button>

                    {compareData?.sessionId === s.id && (
                      <div className="mt-3 rounded-xl bg-slate-50 p-4">
                        {compareData.loading && <p className="flex items-center gap-2 text-xs text-slate-400"><Spinner size={12} /> Comparing…</p>}
                        {compareData.error && <p className="text-xs text-red-600">{compareData.error}</p>}
                        {!compareData.loading && !compareData.error && compareData.pairs.length > 1 && (
                          <ul className="space-y-1.5 text-sm text-slate-700">
                            {compareData.pairs.slice(0, compareData.pairs.length - 1).map((p, i) => {
                              const n = compareData.pairs[i + 1];
                              const trend = n.overall > p.overall ? 'improved' : n.overall < p.overall ? 'declined' : 'steady';
                              const tone = n.overall > p.overall ? 'text-emerald-700' : n.overall < p.overall ? 'text-red-700' : 'text-slate-600';
                              return (
                                <li key={p.attemptNo}>
                                  Attempt {p.attemptNo} ({p.overall}) → Attempt {n.attemptNo} ({n.overall}) —{' '}
                                  <span className={`font-semibold ${tone}`}>{trend}</span>
                                </li>
                              );
                            })}
                          </ul>
                        )}
                        {!compareData.loading && !compareData.error && compareData.pairs.length <= 1 && (
                          <p className="text-xs text-slate-500">Not enough attempts to compare yet.</p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
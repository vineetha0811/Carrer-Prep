import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { request } from '../services/api.js';
import { Card, Badge, Loading, EmptyState, SectionTitle, ProgressBar, Stat } from '../components/ui.jsx';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  Legend,
} from 'recharts';

const CATEGORY_LABELS = { technical: 'Technical', aptitude: 'Aptitude', english: 'English' };
const BREAKDOWN_LABELS = {
  technical: 'Technical',
  aptitude: 'Aptitude',
  english: 'English',
  communication: 'Communication',
  speaking: 'Speaking',
  interview: 'Interviews',
  consistency: 'Consistency',
};
const WEEK_LABELS = ['This week', 'Last week', '2 weeks ago', '3 weeks ago'];
const PHASES = ['Core Revision', 'Aptitude + English', 'Practice Sessions', 'Interviews + Revision'];

function barColor(value) {
  if (value >= 70) return 'bg-emerald-500';
  if (value >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

function readinessLevel(score) {
  if (score >= 80) return 'Strong & Interview Ready';
  if (score >= 60) return 'Interview Ready';
  if (score >= 40) return 'Building Momentum';
  if (score >= 20) return 'Getting Started';
  return 'Just Starting';
}

function catLabel(key) {
  return CATEGORY_LABELS[key] || key.charAt(0).toUpperCase() + key.slice(1);
}

function dayOfMonth(iso) {
  return iso && String(iso).length >= 10 ? String(iso).slice(8, 10) : iso || '';
}

function shortWeek(iso) {
  if (!iso) return '';
  const s = String(iso);
  return s.length >= 10 ? `${s.slice(5, 7)}/${s.slice(8, 10)}` : s;
}

function buildPlanWeeks(totalDays) {
  const days = Math.max(1, Number(totalDays) || 60);
  const weeks = Math.max(1, Math.ceil(days / 7));
  return Array.from({ length: weeks }, (_, i) => {
    const weekNo = i + 1;
    const phaseIdx = Math.floor(i / 2) % PHASES.length;
    return { week: weekNo, focus: PHASES[phaseIdx], days: Math.min(7, Math.max(0, days - i * 7)) };
  });
}

function normalizeReport(raw) {
  const r = (raw && raw.report) || raw || {};
  const cleanNum = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

  const totals = r.totals && typeof r.totals === 'object' && !Array.isArray(r.totals) ? r.totals : null;
  const byCategory = r.byCategory && typeof r.byCategory === 'object' && !Array.isArray(r.byCategory) ? r.byCategory : null;
  const speaking = r.speaking && typeof r.speaking === 'object' && !Array.isArray(r.speaking) ? r.speaking : null;
  const interviews = r.interviews && typeof r.interviews === 'object' && !Array.isArray(r.interviews) ? r.interviews : null;

  const insights = Array.isArray(r.insights)
    ? r.insights
    : [
        ...(typeof r.biggestWeakness === 'string' && r.biggestWeakness ? [`Biggest weakness: ${r.biggestWeakness}`] : []),
        ...(Array.isArray(r.nextWeekFocus) ? r.nextWeekFocus.map((f) => `Next week: focus on ${f}`) : []),
      ];

  const tops = Array.isArray(r.tops) ? r.tops : [];
  const actionItems = Array.isArray(r.actionItems) ? r.actionItems : (Array.isArray(r.nextWeekFocus) ? r.nextWeekFocus : []);
  const verdict = typeof r.verdict === 'string' ? r.verdict : '';
  const period = typeof r.period === 'string' ? r.period : '';

  const simpleScores = Object.fromEntries(
    ['technical', 'aptitude', 'english', 'speaking', 'interview']
      .map((k) => [k, cleanNum(r[k])])
      .filter(([, v]) => v !== null)
  );
  const improvement = r.improvement && typeof r.improvement === 'object' && !Array.isArray(r.improvement) ? r.improvement : {};

  return { totals, byCategory, speaking, interviews, insights, tops, actionItems, verdict, period, simpleScores, improvement };
}

export default function ProgressPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');

  const [week, setWeek] = useState(0);
  const [reportRetry, setReportRetry] = useState(0);
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');

  async function loadProgress(showLoading = true) {
    if (showLoading) setData(null);
    setError('');
    try {
      const d = await request('/progress');
      setData(d);
    } catch (e) {
      setError(e.message || 'Could not load your progress.');
      if (showLoading) setData(null);
    }
  }

  useEffect(() => {
    loadProgress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (tab !== 'report') return;
    let cancelled = false;
    (async () => {
      setReportLoading(true);
      setReportError('');
      setReport(null);
      try {
        const res = await request(`/settings/report/${week}`);
        if (!cancelled) setReport(res);
      } catch (e) {
        if (!cancelled) setReportError(e.message || 'Could not load this week\'s report.');
      } finally {
        if (!cancelled) setReportLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [tab, week, reportRetry]);

  if (error) {
    return (
      <div className="mx-auto max-w-2xl py-10 text-center">
        <h1 className="text-lg font-bold text-slate-900">Progress & Report</h1>
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          <p className="font-semibold">Something went wrong</p>
          <p className="mt-0.5">{error}</p>
          <button className="btn mt-3 !bg-red-600 !text-white hover:!bg-red-700" onClick={() => loadProgress(true)}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Progress & Report</h1>
        <p className="text-sm text-slate-500">Your readiness, accuracy and weekly trends.</p>
      </div>

      <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
        {['overview', 'report'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-5 py-2 text-sm font-semibold transition-colors ${tab === t ? 'bg-primary-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            {t === 'overview' ? 'Overview' : 'Weekly Report'}
          </button>
        ))}
      </div>

      {!data ? (
        <Loading label="Loading your progress…" />
      ) : tab === 'overview' ? (
        <Overview data={data} />
      ) : (
        <div className="space-y-5">
          <Card className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <SectionTitle sub="Pick a week to see how it went and what to focus on next.">
                Weekly Report
              </SectionTitle>
              <div className="flex flex-wrap gap-2">
                {WEEK_LABELS.map((label, i) => (
                  <button
                    key={i}
                    onClick={() => setWeek(i)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors ${week === i ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2">
              {reportError && (
                <EmptyState
                  icon="📄"
                  title="Couldn't load this week's report"
                  subtitle={reportError}
                  action={<button type="button" className="btn-outline" onClick={() => setReportRetry((n) => n + 1)}>Retry</button>}
                />
              )}
              {reportLoading && <Loading label="Generating report…" />}
              {!reportError && !reportLoading && report && <ReportBody report={report} />}
            </div>
          </Card>

          <PlanTimeline profile={data.profile} assignmentsComplete={data.assignmentsComplete} totalAssignments={data.totalAssignments} />
        </div>
      )}
    </div>
  );
}

function Overview({ data }) {
  const readiness = data.readiness || {};
  const readyScore = readiness.score ?? 0;
  const readyLevel = readiness.level || readinessLevel(readyScore);
  const breakdown = readiness.breakdown || readiness.dimensions || {};
  const totals = data.totals || { attempted: 0, correct: 0 };
  const accuracy = totals.attempted ? Math.round((totals.correct / totals.attempted) * 100) : 0;
  const byCategory = data.byCategory || {};
  const weekly = Array.isArray(data.weekly) ? data.weekly : [];
  const weeklyAverages = (data.weeklyAverages || []).map((w) => ({ ...w, weekStart: shortWeek(w.weekStart) }));
  const achievements = data.achievements || [];
  const weakAreas = data.weakAreas || [];
  const speaking = data.speaking || { attempts: 0, avg: 0 };
  const interviews = data.interviews || { count: 0, avg: 0 };

  const r = 42;
  const circ = 2 * Math.PI * r;
  const dash = (readyScore / 100) * circ;

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <SectionTitle sub="Overall placement readiness score.">Readiness</SectionTitle>
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <div className="relative shrink-0" style={{ width: 128, height: 128 }}>
              <svg width="128" height="128" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r={r} fill="none" stroke="#e2e8f0" strokeWidth="9" />
                <circle
                  cx="50" cy="50" r={r} fill="none"
                  stroke={readyScore >= 70 ? '#10b981' : readyScore >= 40 ? '#f59e0b' : '#ef4444'}
                  strokeWidth="9" strokeLinecap="round"
                  strokeDasharray={`${dash} ${circ}`}
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-extrabold text-slate-900">{readyScore}</span>
                <span className="text-[10px] text-slate-400">/ 100</span>
              </div>
            </div>
            <div className="text-center sm:text-left">
              <p className="text-sm font-bold text-slate-800">{readyLevel}</p>
              <p className="mt-0.5 text-xs text-slate-500">{totals.attempted} attempted · {totals.correct} correct</p>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {Object.keys(breakdown).length === 0 ? (
              <p className="text-sm text-slate-400">Solve a few questions to unlock your breakdown.</p>
            ) : (
              Object.entries(breakdown).map(([key, value]) => {
                const v = Number.isFinite(value) ? Math.round(value) : 0;
                return (
                  <div key={key}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-600">{BREAKDOWN_LABELS[key] || catLabel(key)}</span>
                      <span className="font-bold text-slate-700">{v}%</span>
                    </div>
                    <ProgressBar value={v} color={barColor(v)} />
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <div className="lg:col-span-2">
          <h3 className="mb-3 text-sm font-bold text-slate-900">Overall Stats</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <Stat label="Attempted" value={totals.attempted} tone="blue" />
            <Stat label="Correct" value={totals.correct} tone="green" />
            <Stat label="Accuracy" value={accuracy} suffix="%" tone={accuracy >= 70 ? 'green' : accuracy >= 50 ? 'amber' : 'red'} />
            <Stat label="Speaking Avg" value={speaking.avg ?? 0} tone="purple" />
            <Stat label="Interview Avg" value={interviews.avg ?? 0} tone="amber" />
            <Stat label="GD Sessions" value={data.gdCount ?? 0} tone="slate" />
            <Stat label="Streak" value={data.streak ?? 0} suffix="d" tone="slate" />
          </div>

          <h3 className="mb-3 mt-5 text-sm font-bold text-slate-900">Accuracy by Category</h3>
          {Object.keys(byCategory).length === 0 ? (
            <Card><p className="text-sm text-slate-400">No attempts yet — your category accuracy will appear here.</p></Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {Object.entries(byCategory).map(([key, c]) => {
                const pct = c.pct ?? (c.total ? Math.round((c.correct / c.total) * 100) : 0);
                return (
                  <Card key={key} className="p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-slate-800">{catLabel(key)}</p>
                      <Badge tone={pct >= 70 ? 'green' : pct >= 50 ? 'amber' : 'red'}>{pct}%</Badge>
                    </div>
                    <div className="mt-3">
                      <ProgressBar value={pct} color={barColor(pct)} />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{c.correct} / {c.total} correct</p>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle sub="Daily attempted questions & accuracy over the last 7 days.">Weekly Accuracy</SectionTitle>
          {weekly.length === 0 ? (
            <EmptyState icon="📈" title="No weekly data yet" subtitle="Answer questions for a few days and your trend will appear here." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={weekly} margin={{ top: 10, right: 16, bottom: 0, left: -18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey={(d) => dayOfMonth(d.date)} tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <Tooltip
                  labelStyle={{ fontWeight: 700 }}
                  labelFormatter={(label, payload) => (payload?.[0]?.payload?.date ? `Day ${dayOfMonth(payload[0].payload.date)}` : `Day ${label}`)}
                  formatter={(value, name, entry) => [`${value}${name === 'accuracy' ? '%' : ''}`, name === 'accuracy' ? 'Accuracy' : 'Attempted']}
                />
                <Line type="monotone" dataKey="accuracy" name="accuracy" stroke="#6366f1" strokeWidth={2.5} dot={{ r: 3, fill: '#6366f1' }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <SectionTitle sub="Accuracy trend by category, week over week.">Weekly Averages</SectionTitle>
          {weeklyAverages.length === 0 ? (
            <EmptyState icon="📊" title="No weekly averages yet" subtitle="Complete a full week of practice to see your category trend." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={weeklyAverages} margin={{ top: 10, right: 16, bottom: 0, left: -18 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="weekStart" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#cbd5e1' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="technical" name="Technical" fill="#6366f1" radius={[3, 3, 0, 0]} />
                <Bar dataKey="aptitude" name="Aptitude" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                <Bar dataKey="english" name="English" fill="#10b981" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <SectionTitle sub="Milestones you've unlocked along the way.">Achievements</SectionTitle>
          {achievements.length === 0 ? (
            <EmptyState icon="🏆" title="No achievements yet" subtitle="Keep practising — badges unlock as you complete milestones." />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {achievements.map((a) => {
                const earned = Boolean(a.earned);
                return (
                  <div
                    key={a.key || a.label}
                    className={`rounded-xl border p-3 text-center ${earned ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-slate-50 opacity-70'}`}
                  >
                    <div className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${earned ? 'bg-emerald-500 text-white' : 'bg-slate-300 text-slate-600'}`}>
                      {earned ? '✓' : '🔒'}
                    </div>
                    <p className={`mt-2 text-xs font-semibold ${earned ? 'text-emerald-800' : 'text-slate-500'}`}>{a.label || a.key}</p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <SectionTitle sub="Topics to prioritize based on your recent accuracy.">Focus Areas</SectionTitle>
          {weakAreas.length === 0 ? (
            <EmptyState icon="🎯" title="No focus areas yet" subtitle="Solve a few questions to unlock personalized focus areas." />
          ) : (
            <div className="space-y-3">
              {weakAreas.map((w) => (
                <div key={w.topic} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800">{w.topic}</p>
                    <div className="mt-1.5">
                      <ProgressBar value={w.accuracy ?? 0} color={barColor(w.accuracy ?? 0)} />
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className={`text-sm font-bold ${(w.accuracy ?? 0) >= 70 ? 'text-emerald-600' : (w.accuracy ?? 0) >= 50 ? 'text-amber-600' : 'text-red-600'}`}>{w.accuracy ?? 0}%</span>
                    {w.category && <Badge tone="blue">{catLabel(w.category)}</Badge>}
                  </div>
                </div>
              ))}
              <Link to="/practice" className="btn-outline w-full">Practice These →</Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function ReportBody({ report }) {
  const r = normalizeReport(report);

  const totalsRows = r.totals ? Object.entries(r.totals).filter(([, v]) => v != null) : [];
  const hasTotals = totalsRows.length > 0;
  const speakingRows = [];
  if (r.speaking) {
    if (r.speaking.attempts != null && r.speaking.avg != null) speakingRows.push({ label: 'Speaking attempts', value: r.speaking.attempts }, { label: 'Speaking avg', value: r.speaking.avg });
    else if (r.speaking.attempts != null) speakingRows.push({ label: 'Speaking attempts', value: r.speaking.attempts });
    else if (r.speaking.avg != null) speakingRows.push({ label: 'Speaking avg', value: r.speaking.avg });
  }
  if (r.simpleScores.speaking != null) speakingRows.push({ label: 'Speaking avg', value: r.simpleScores.speaking });
  if (r.interviews) {
    if (r.interviews.count != null && r.interviews.avg != null) speakingRows.push({ label: 'Interviews', value: `${r.interviews.count} · avg ${r.interviews.avg}` });
    else if (r.interviews.count != null) speakingRows.push({ label: 'Interviews', value: r.interviews.count });
    else if (r.interviews.avg != null) speakingRows.push({ label: 'Interview avg', value: r.interviews.avg });
  }
  if (r.simpleScores.interview != null) speakingRows.push({ label: 'Interview avg', value: r.simpleScores.interview });

  const catEntries = r.byCategory
    ? Object.entries(r.byCategory).map(([k, c]) => ({ label: catLabel(k), pct: c.pct ?? (c.total ? Math.round((c.correct / c.total) * 100) : 0), total: c.total, correct: c.correct }))
    : ['technical', 'aptitude', 'english']
        .filter((k) => r.simpleScores[k] != null)
        .map((k) => ({ label: CATEGORY_LABELS[k], pct: r.simpleScores[k] }));

  const improvementRows = Object.entries(r.improvement).filter(([, v]) => typeof v === 'number');

  const hasContent =
    hasTotals || catEntries.length > 0 || speakingRows.length > 0 || r.insights.length > 0 || r.tops.length > 0 || r.actionItems.length > 0 || r.verdict;

  if (!hasContent && !r.period) {
    return (
      <EmptyState
        icon="🕑"
        title="Nothing recorded this week"
        subtitle="Complete practice, speaking or interviews in this week to generate a report."
      />
    );
  }

  return (
    <div className="space-y-4">
      {r.period && <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{r.period}</p>}

      {(hasTotals || speakingRows.length > 0) && (
        <Card>
          <SectionTitle sub="What you covered in this period.">At a Glance</SectionTitle>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {totalsRows.map(([label, value]) => (
              <Stat key={label} label={label.replace(/([A-Z])/g, ' $1')} value={value ?? 0} tone="blue" />
            ))}
            {speakingRows.map((s, i) => (
              <Stat key={`s${i}`} label={s.label} value={s.value ?? 0} tone="purple" />
            ))}
          </div>
        </Card>
      )}

      {catEntries.length > 0 && (
        <Card>
          <SectionTitle sub="Accuracy split by category for this period.">Category Accuracy</SectionTitle>
          <div className="space-y-3">
            {catEntries.map((c) => (
              <div key={c.label}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-600">{c.label}</span>
                  <span className="font-bold text-slate-700">{c.pct}%</span>
                </div>
                <ProgressBar value={c.pct} color={barColor(c.pct)} />
                {c.total != null && <p className="mt-0.5 text-[11px] text-slate-400">{c.correct} / {c.total} correct</p>}
              </div>
            ))}
          </div>
        </Card>
      )}

      {improvementRows.length > 0 && (
        <Card>
          <SectionTitle sub="Change vs the previous week.">Improvement</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {improvementRows.map(([k, v]) => (
              <span key={k} className="chip bg-slate-100 text-slate-700">
                {catLabel(k)}: <b className={v >= 0 ? 'text-emerald-600' : 'text-red-600'}>{v >= 0 ? '+' : ''}{v}%</b>
              </span>
            ))}
          </div>
        </Card>
      )}

      {r.insights.length > 0 && (
        <Card>
          <SectionTitle sub="What the data says about this period.">Insights</SectionTitle>
          <ul className="space-y-2">
            {r.insights.map((ins, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
                </span>
                <span className="leading-relaxed">{ins}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {r.tops.length > 0 && (
        <Card>
          <SectionTitle sub="Strongest topics this period.">Top Topics</SectionTitle>
          <div className="space-y-3">
            {r.tops.map((t, i) => {
              const v = typeof t.accuracy === 'number' ? Math.round(t.accuracy) : 0;
              return (
                <div key={i}>
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-600">{t.topic}</span>
                    <span className="font-bold text-emerald-600">{v}%</span>
                  </div>
                  <ProgressBar value={v} color="bg-emerald-500" />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {r.actionItems.length > 0 && (
        <Card>
          <SectionTitle sub="Do these to close your gaps.">Action Items</SectionTitle>
          <ol className="space-y-2">
            {r.actionItems.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-600 text-xs font-bold text-white">{i + 1}</span>
                <span className="leading-relaxed">{item}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {r.verdict && (
        <div className="rounded-xl border border-primary-200 bg-primary-50/70 p-5">
          <p className="text-xs font-bold uppercase tracking-wide text-primary-600">Verdict</p>
          <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-800">{r.verdict}</p>
        </div>
      )}
    </div>
  );
}

function PlanTimeline({ profile, assignmentsComplete, totalAssignments }) {
  const days = profile?.planLengthDays || 60;
  const weeks = buildPlanWeeks(days);
  const done = assignmentsComplete ?? 0;
  const total = totalAssignments ?? 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <Card>
      <SectionTitle sub="Your study plan runs week by week. Repeat phases if your plan is longer.">
        {days}-Day Study Plan
      </SectionTitle>
      <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-medium text-slate-600">Assignments completed</span>
          <span className="font-bold text-slate-700">{done} of {total} ({pct}%)</span>
        </div>
        <ProgressBar value={done} max={total || 1} color="bg-primary-600" />
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {weeks.map((w) => (
          <div key={w.week} className="rounded-xl border border-slate-200 p-3">
            <p className="text-xs font-bold text-primary-700">Week {w.week}</p>
            <p className="mt-1 text-xs font-semibold text-slate-700">— {w.focus}</p>
            <p className="mt-0.5 text-[11px] text-slate-400">{w.days} day{w.days === 1 ? '' : 's'}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
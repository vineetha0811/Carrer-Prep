import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Spinner } from '../components/ui.jsx';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { login, error, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  async function submit(e) {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    try {
      await login(email, password);
      const from = location.state?.from?.pathname;
      navigate(from || '/', { replace: true });
    } catch (err) {
      /* error shown */
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden flex-1 flex-col justify-between bg-primary-700 p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 17V9m6 8V5m6 12v-8m6 8V3" /></svg>
          </span>
          <span className="text-xl font-extrabold tracking-tight">CampusReady AI</span>
        </div>
        <div>
          <h1 className="max-w-md text-3xl font-extrabold leading-tight">
            Your personal AI coach for campus placements.
          </h1>
          <ul className="mt-6 space-y-3 text-sm text-primary-100">
            <li className="flex items-center gap-2.5"><Check /> Daily adaptive assignments built from your syllabus and weak areas</li>
            <li className="flex items-center gap-2.5"><Check /> Technical, aptitude, English, speaking &amp; mock interviews in one place</li>
            <li className="flex items-center gap-2.5"><Check /> Honest, structured feedback you can act on</li>
          </ul>
        </div>
        <p className="text-xs text-primary-200">No job guarantees, ever. Just focused preparation that works.</p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-slate-50 px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-600 text-white">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 17V9m6 8V5m6 12v-8m6 8V3" /></svg>
            </span>
            <h1 className="mt-3 text-2xl font-extrabold text-slate-900">CampusReady AI</h1>
          </div>

          <h2 className="text-2xl font-bold text-slate-900">Welcome back</h2>
          <p className="mt-1 text-sm text-slate-500">Sign in to continue your placement prep.</p>

          {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="you@college.edu" autoComplete="email" />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="••••••••" autoComplete="current-password" />
            </div>
            <button className="btn-primary w-full" disabled={submitting}>
              {submitting ? <Spinner size={16} className="text-white" /> : 'Sign in'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500">
            New to CampusReady?{' '}
            <Link to="/signup" className="font-semibold text-primary-600 hover:underline">Create an account</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function Check() {
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/20">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M20 6L9 17l-5-5" /></svg>
    </span>
  );
}
import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Spinner } from '../components/ui.jsx';

export default function Signup() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [localError, setLocalError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { signup, error } = useAuth();
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setLocalError('');
    if (name.trim().length < 2) return setLocalError('Please enter your name.');
    if (!/^\S+@\S+\.\S+$/.test(email)) return setLocalError('Please enter a valid email address.');
    if (password.length < 6) return setLocalError('Password must be at least 6 characters.');
    if (password !== confirm) return setLocalError('Passwords do not match.');
    setSubmitting(true);
    try {
      await signup(name.trim(), email.trim(), password);
      navigate('/onboarding', { replace: true });
    } catch (err) {
      setLocalError(err.message || 'Could not create account.');
    } finally {
      setSubmitting(false);
    }
  }

  const showError = localError || error;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6 py-12">
      <div className="w-full max-w-md">
        <Link to="/login" className="mb-6 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-600 text-white">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 17V9m6 8V5m6 12v-8m6 8V3" /></svg>
        </Link>
        <h1 className="text-2xl font-extrabold text-slate-900">Create your account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Start your placement prep — it takes 2 minutes.
        </p>

        {showError && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{showError}</div>}

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="label" htmlFor="name">Full name</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} className="input" placeholder="e.g. Priya Sharma" />
          </div>
          <div>
            <label className="label" htmlFor="email">College email</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" placeholder="you@college.edu" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" placeholder="At least 6 characters" />
          </div>
          <div>
            <label className="label" htmlFor="confirm">Confirm password</label>
            <input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className="input" placeholder="Repeat your password" />
          </div>
          <button className="btn-primary w-full" disabled={submitting}>
            {submitting ? <Spinner size={16} className="text-white" /> : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-primary-600 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
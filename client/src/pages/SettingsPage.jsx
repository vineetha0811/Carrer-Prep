import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { request, upload } from '../services/api.js';
import { Card, Loading, SectionTitle, Spinner } from '../components/ui.jsx';

const BRANCHES = ['CSE', 'ECE', 'EEE', 'CIVIL'];
const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8];
const MINUTES = [20, 30, 40, 60];
const PLAN_LENGTHS = [30, 60, 90];
const JOBS = [
  'Software Developer', 'Data Analyst', 'Full-Stack Engineer', 'Core / Hardware Engineer',
  'Embedded Engineer', 'Product Support Engineer', 'NETWORK/IT Engineer', 'Analyst / Consultant',
  'Any software role', 'Not sure yet',
];
const REMINDER_TIMES = Array.from({ length: 17 }, (_, i) => `${String(6 + i).padStart(2, '0')}:00`);
const PREP_DEFAULTS = { dailyMinutes: 30, planLengthDays: 60, emailReports: true, reminderTime: '07:00' };

function Alert({ msg }) {
  if (!msg) return null;
  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${msg.type === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
      {msg.text}
    </div>
  );
}

export default function SettingsPage() {
  const { user, refresh, logout } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef(null);

  const [profile, setProfile] = useState(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);

  const [prep, setPrep] = useState({ ...PREP_DEFAULTS });
  const [prepSaving, setPrepSaving] = useState(false);
  const [prepMsg, setPrepMsg] = useState(null);

  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoSaving, setPhotoSaving] = useState(false);
  const [photoMsg, setPhotoMsg] = useState(null);

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);

  const [deleteText, setDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState(null);

  useEffect(() => {
    if (!user) return;
    setProfile({
      name: user.name || '',
      college: user.college || '',
      location: user.location || '',
      branch: user.branch || '',
      graduationYear: user.graduationYear || new Date().getFullYear() + 1,
      semester: user.semester || 1,
      cgpa: user.cgpa ?? '',
      backlogs: user.backlogs ?? 0,
      preferredJob: user.preferredJob || '',
    });
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await request('/settings');
        if (cancelled) return;
        const s = res?.settings || {};
        const time = s.reminderTime ?? s.dailyTime;
        setPrep({
          dailyMinutes: s.dailyMinutes ?? user?.dailyMinutes ?? PREP_DEFAULTS.dailyMinutes,
          planLengthDays: s.planLengthDays ?? s.planDays ?? user?.planLengthDays ?? PREP_DEFAULTS.planLengthDays,
          emailReports: s.emailReports ?? s.notifications ?? PREP_DEFAULTS.emailReports,
          reminderTime: REMINDER_TIMES.includes(time) ? time : PREP_DEFAULTS.reminderTime,
        });
      } catch (e) {
        setPrep({
          dailyMinutes: user?.dailyMinutes ?? PREP_DEFAULTS.dailyMinutes,
          planLengthDays: user?.planLengthDays ?? PREP_DEFAULTS.planLengthDays,
          emailReports: PREP_DEFAULTS.emailReports,
          reminderTime: PREP_DEFAULTS.reminderTime,
        });
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  function setProfileField(field, value) {
    setProfile((p) => ({ ...p, [field]: value }));
    setProfileMsg(null);
  }

  async function saveProfile() {
    if (!profile) return;
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      const body = {
        name: profile.name.trim(),
        college: profile.college.trim(),
        location: profile.location.trim(),
        branch: profile.branch,
        graduationYear: Number(profile.graduationYear) || null,
        semester: Number(profile.semester) || null,
        cgpa: profile.cgpa === '' ? null : Number(profile.cgpa),
        backlogs: Number(profile.backlogs) || 0,
        preferredJob: profile.preferredJob.trim(),
      };
      await request('/profile', { method: 'PATCH', body });
      await refresh();
      setProfileMsg({ type: 'ok', text: 'Profile saved.' });
    } catch (e) {
      setProfileMsg({ type: 'err', text: e.message || 'Could not save profile.' });
    } finally {
      setProfileSaving(false);
    }
  }

  function onPickPhoto(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setPhotoFile(f);
    setPhotoPreview(URL.createObjectURL(f));
    setPhotoMsg(null);
  }

  async function savePhoto() {
    if (!photoFile) {
      setPhotoMsg({ type: 'err', text: 'Choose a photo first.' });
      return;
    }
    setPhotoSaving(true);
    setPhotoMsg(null);
    try {
      await upload('/profile/photo', { field: 'photo', file: photoFile });
      setPhotoFile(null);
      setPhotoPreview(null);
      if (fileRef.current) fileRef.current.value = '';
      await refresh();
      setPhotoMsg({ type: 'ok', text: 'Profile photo updated.' });
    } catch (e) {
      setPhotoMsg({ type: 'err', text: e.message || 'Could not upload photo.' });
    } finally {
      setPhotoSaving(false);
    }
  }

  function setPrepField(field, value) {
    setPrep((p) => ({ ...p, [field]: value }));
    setPrepMsg(null);
  }

  async function savePrep() {
    setPrepSaving(true);
    setPrepMsg(null);
    try {
      await request('/settings', {
        method: 'PATCH',
        body: {
          dailyMinutes: prep.dailyMinutes,
          planLengthDays: prep.planLengthDays,
          emailReports: prep.emailReports,
          reminderTime: prep.reminderTime,
          notifications: prep.emailReports,
          dailyTime: prep.reminderTime,
        },
      });
      if (prep.planLengthDays !== (user?.planLengthDays || 60)) {
        await request('/profile', { method: 'PATCH', body: { planLengthDays: prep.planLengthDays } });
        await refresh();
      }
      setPrepMsg({ type: 'ok', text: 'Prep settings saved.' });
    } catch (e) {
      setPrepMsg({ type: 'err', text: e.message || 'Could not save prep settings.' });
    } finally {
      setPrepSaving(false);
    }
  }

  async function changePassword() {
    if (!pw.current || !pw.next) {
      setPwMsg({ type: 'err', text: 'Fill in all the password fields.' });
      return;
    }
    if (pw.next.length < 6) {
      setPwMsg({ type: 'err', text: 'New password must be at least 6 characters.' });
      return;
    }
    if (pw.next !== pw.confirm) {
      setPwMsg({ type: 'err', text: 'New passwords do not match.' });
      return;
    }
    setPwSaving(true);
    setPwMsg(null);
    try {
      await request('/settings/password', { method: 'POST', body: { currentPassword: pw.current, newPassword: pw.next } });
      setPw({ current: '', next: '', confirm: '' });
      setPwMsg({ type: 'ok', text: 'Password changed.' });
    } catch (e) {
      setPwMsg({ type: 'err', text: e.message || 'Could not change password.' });
    } finally {
      setPwSaving(false);
    }
  }

  async function deleteAccount() {
    if (deleteText !== 'DELETE') return;
    if (!window.confirm('This permanently deletes your account and all your data. Continue?')) return;
    setDeleting(true);
    setDeleteMsg(null);
    try {
      await request('/settings/account', { method: 'DELETE' });
      logout();
      navigate('/login');
    } catch (e) {
      setDeleteMsg({ type: 'err', text: e.message || 'Could not delete account.' });
      setDeleting(false);
    }
  }

  if (!user) return <Loading label="Loading your settings…" />;

  const photoPathParts = user.profilePhoto ? String(user.profilePhoto).split(/[\\/]/) : null;
  const photoSrc = photoPreview || (photoPathParts && photoPathParts.length ? `/api/uploads/photos/${photoPathParts[photoPathParts.length - 1]}` : null);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500">Manage your profile, prep rhythm and account.</p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <SectionTitle sub="These details show up on your dashboard and reports.">Profile</SectionTitle>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Full name</label>
                <input className="input" value={profile?.name || ''} onChange={(e) => setProfileField('name', e.target.value)} />
              </div>
              <div>
                <label className="label">College / University</label>
                <input className="input" value={profile?.college || ''} onChange={(e) => setProfileField('college', e.target.value)} placeholder="e.g. Anna University" />
              </div>
              <div>
                <label className="label">City / Location</label>
                <input className="input" value={profile?.location || ''} onChange={(e) => setProfileField('location', e.target.value)} placeholder="e.g. Chennai" />
              </div>
              <div>
                <label className="label">Branch</label>
                <select className="input" value={profile?.branch || ''} onChange={(e) => setProfileField('branch', e.target.value)}>
                  <option value="">Select branch</option>
                  {BRANCHES.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Graduation year</label>
                <input className="input" type="number" min={new Date().getFullYear()} max={new Date().getFullYear() + 6} value={profile?.graduationYear ?? ''} onChange={(e) => setProfileField('graduationYear', e.target.value)} />
              </div>
              <div>
                <label className="label">Current semester</label>
                <select className="input" value={profile?.semester || 1} onChange={(e) => setProfileField('semester', +e.target.value)}>
                  {SEMESTERS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="label">CGPA</label>
                <input className="input" type="number" step="0.01" min="0" max="10" value={profile?.cgpa ?? ''} onChange={(e) => setProfileField('cgpa', e.target.value)} placeholder="e.g. 8.2" />
              </div>
              <div>
                <label className="label">Backlogs</label>
                <input className="input" type="number" min="0" value={profile?.backlogs ?? 0} onChange={(e) => setProfileField('backlogs', e.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Preferred job role</label>
                <input className="input" list="jobs" value={profile?.preferredJob || ''} onChange={(e) => setProfileField('preferredJob', e.target.value)} placeholder="e.g. Software Developer" />
                <datalist id="jobs">
                  {JOBS.map((j) => <option key={j} value={j} />)}
                </datalist>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <Alert msg={profileMsg} />
              <button type="button" className="btn-primary" disabled={profileSaving || !profile} onClick={saveProfile}>
                {profileSaving ? <><Spinner size={14} /> Saving…</> : 'Save Changes'}
              </button>
            </div>
          </Card>

          <Card>
            <SectionTitle sub="Your daily practice budget and plan length.">Prep Settings</SectionTitle>
            <div className="space-y-5">
              <div>
                <label className="label">Daily practice time</label>
                <div className="grid grid-cols-4 gap-2 sm:max-w-sm">
                  {MINUTES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPrepField('dailyMinutes', m)}
                      className={`rounded-lg border py-2.5 text-sm font-bold transition-colors ${prep.dailyMinutes === m ? 'border-primary-500 bg-primary-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                      {m} min
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Plan length</label>
                <div className="grid grid-cols-3 gap-2 sm:max-w-sm">
                  {PLAN_LENGTHS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setPrepField('planLengthDays', d)}
                      className={`rounded-lg border py-2.5 text-sm font-bold transition-colors ${prep.planLengthDays === d ? 'border-primary-500 bg-primary-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                    >
                      {d} days
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-3">
                  <input
                    type="checkbox"
                    className="mt-0.5 h-4 w-4 accent-primary-600"
                    checked={prep.emailReports}
                    onChange={(e) => setPrepField('emailReports', e.target.checked)}
                  />
                  <span>
                    <span className="block text-sm font-semibold text-slate-800">Email weekly reports</span>
                    <span className="block text-xs text-slate-500">Get a weekly summary of your progress.</span>
                  </span>
                </label>
                <div>
                  <label className="label">Reminder time</label>
                  <select className="input" value={prep.reminderTime} onChange={(e) => setPrepField('reminderTime', e.target.value)}>
                    {REMINDER_TIMES.map((t) => (
                      <option key={t} value={t}>
                        {new Date(`2000-01-01T${t}:00`).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <Alert msg={prepMsg} />
              <button type="button" className="btn-primary" disabled={prepSaving} onClick={savePrep}>
                {prepSaving ? <><Spinner size={14} /> Saving…</> : 'Save Settings'}
              </button>
            </div>
          </Card>
        </div>

        <Card className="h-fit">
          <SectionTitle sub="Used across the app.">Profile Photo</SectionTitle>
          <div className="flex flex-col items-center gap-4">
            {photoSrc ? (
              <img src={photoSrc} alt="Profile" className="h-24 w-24 rounded-full object-cover ring-4 ring-primary-100" />
            ) : (
              <span className="flex h-24 w-24 items-center justify-center rounded-full bg-primary-100 text-4xl font-bold text-primary-700">
                {(user.name || 'U').charAt(0).toUpperCase()}
              </span>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickPhoto} />
            <button type="button" className="btn-outline w-full" onClick={() => fileRef.current && fileRef.current.click()}>
              Choose Photo
            </button>
            {photoFile && photoPreview && (
              <p className="text-center text-xs text-slate-500">Selected: {photoFile.name}. Save to upload.</p>
            )}
            <button type="button" className="btn-primary w-full" disabled={!photoFile || photoSaving} onClick={savePhoto}>
              {photoSaving ? <><Spinner size={14} /> Uploading…</> : 'Save Photo'}
            </button>
            <Alert msg={photoMsg} />
          </div>
        </Card>
      </div>

      <div className="rounded-xl border-2 border-red-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-red-700">Danger Zone</h2>
        <p className="mt-0.5 text-sm text-slate-500">Irreversible account actions. Proceed carefully.</p>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 p-4">
            <h3 className="text-sm font-bold text-slate-800">Change Password</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <div>
                <label className="label">Current</label>
                <input className="input" type="password" value={pw.current} onChange={(e) => { setPw({ ...pw, current: e.target.value }); setPwMsg(null); }} />
              </div>
              <div>
                <label className="label">New</label>
                <input className="input" type="password" value={pw.next} onChange={(e) => { setPw({ ...pw, next: e.target.value }); setPwMsg(null); }} />
              </div>
              <div>
                <label className="label">Confirm</label>
                <input className="input" type="password" value={pw.confirm} onChange={(e) => { setPw({ ...pw, confirm: e.target.value }); setPwMsg(null); }} />
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <Alert msg={pwMsg} />
              <button type="button" className="btn-outline" disabled={pwSaving} onClick={changePassword}>
                {pwSaving ? <><Spinner size={14} /> Updating…</> : 'Update Password'}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-red-200 bg-red-50/50 p-4">
            <h3 className="text-sm font-bold text-red-800">Delete Account</h3>
            <p className="mt-1 text-xs leading-relaxed text-red-600">
              This deletes your account, profile, progress and all uploaded files permanently. Type <b>DELETE</b> below to enable the button.
            </p>
            <input className="input mt-3" value={deleteText} onChange={(e) => { setDeleteText(e.target.value); setDeleteMsg(null); }} placeholder="Type DELETE" />
            <div className="mt-3 space-y-2">
              <Alert msg={deleteMsg} />
              <button
                type="button"
                className="btn !bg-red-600 !text-white hover:!bg-red-700"
                disabled={deleteText !== 'DELETE' || deleting}
                onClick={deleteAccount}
              >
                {deleting ? <><Spinner size={14} /> Deleting…</> : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
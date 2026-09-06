import React from 'react';
import { NavLink, Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const NAV = [
  { to: '/', label: 'Dashboard', icon: homeIcon, end: true },
  { to: '/practice', label: 'Technical Practice', icon: boltIcon },
  { to: '/aptitude', label: 'Aptitude & Reasoning', icon: brainIcon },
  { to: '/english', label: 'English / Grammar', icon: bookIcon },
  { to: '/speaking', label: 'Speaking Lab', icon: micIcon },
  { to: '/interview', label: 'Mock Interview', icon: chatIcon },
  { to: '/gd', label: 'GD / Debate', icon: usersIcon },
  { to: '/syllabus', label: 'My Syllabus', icon: fileIcon },
  { to: '/resume', label: 'Resume', icon: docIcon },
  { to: '/projects', label: 'Projects', icon: folderIcon },
  { to: '/progress', label: 'Progress & Report', icon: chartIcon },
  { to: '/settings', label: 'Settings', icon: gearIcon },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-slate-200 bg-white lg:flex">
        <Link to="/" className="flex items-center gap-2.5 border-b border-slate-100 px-5 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-600 text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M3 17V9m6 8V5m6 12v-8m6 8V3" /></svg>
          </span>
          <span>
            <span className="block text-sm font-extrabold leading-tight text-slate-900">CampusReady</span>
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-primary-600">AI Placement Coach</span>
          </span>
        </Link>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ${
                  isActive ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <span className="text-slate-400">{item.icon()}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-3">
          {user && (
            <div className="mb-2 flex items-center gap-2.5 px-2">
              <Avatar user={user} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-800">{user.name}</p>
                <p className="truncate text-xs text-slate-500">{user.branch || 'Student'}</p>
              </div>
            </div>
          )}
          <button onClick={handleLogout} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-500 hover:bg-red-50 hover:text-red-600">
            <LogoutIcon /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur lg:px-8">
          <MobileNav />
          <div className="lg:hidden" />
          <div className="flex items-center gap-3">
            {user && (
              <>
                <Link to="/settings" className="hidden text-xs font-medium text-slate-500 hover:text-slate-800 sm:block">
                  {user.preferredJob ? `${user.preferredJob} · ` : ''}{user.cgpa != null ? `CGPA ${user.cgpa}` : ''}
                </Link>
                <div className="hidden sm:block">
                  <Avatar user={user} size={32} />
                </div>
              </>
            )}
          </div>
        </header>
        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function MobileNav() {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="relative lg:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
        aria-label="Menu"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
      </button>
      {open && (
        <div className="absolute left-0 top-11 z-50 max-h-[70vh] w-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <Link to="/" onClick={() => setOpen(false)} className="mb-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-primary-700">
            <span className="font-extrabold">CampusReady AI</span>
          </Link>
          {NAV.map((item, i) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-slate-600 hover:bg-primary-50 hover:text-primary-700"
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function Avatar({ user, size = 36 }) {
  // Backend serves uploads through /api/uploads/... path; build the URL directly.
  const parts = user?.profilePhoto ? String(user.profilePhoto).split(/[\\/]/) : null;
  const src = parts && parts.length ? `/api/uploads/photos/${parts[parts.length - 1]}` : null;
  return src ? (
    <img src={src} alt={user.name} className="rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      className="flex items-center justify-center rounded-full bg-primary-100 font-bold text-primary-700"
      style={{ width: size, height: size, fontSize: size / 2.4 }}
    >
      {(user?.name || 'U').charAt(0).toUpperCase()}
    </span>
  );
}

function homeIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 10.5 12 3l9 7.5V21h-6v-6h-6v6H3z" /></svg>;
}
function boltIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5z" /></svg>;
}
function brainIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 4a3 3 0 0 0-3-3 3 3 0 0 0-2.5 4.6A3 3 0 0 0 4 8a3 3 0 0 0 2 2.8V15a3 3 0 0 0 4 2.8V21a1 1 0 0 0 2 0z" /></svg>;
}
function bookIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19V5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zm0 0a2 2 0 0 0 2 2h13" /></svg>;
}
function micIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3zM5 11a7 7 0 0 0 14 0M12 18v4" /></svg>;
}
function chatIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z" /></svg>;
}
function usersIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm7-2a4 4 0 1 0 0-6 4 4 0 0 0 0 6z" /></svg>;
}
function fileIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M9 13h6M9 17h6" /></svg>;
}
function docIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /></svg>;
}
function folderIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>;
}
function chartIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 3v18h18" /><path d="M7 14v3m5-8v8m5-13v13" /></svg>;
}
function gearIcon() {
  return <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>;
}
function LogoutIcon() {
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></svg>;
}
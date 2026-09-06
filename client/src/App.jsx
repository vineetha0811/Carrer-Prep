import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Layout from './components/Layout.jsx';
import { Loading } from './components/ui.jsx';
import Login from './pages/Login.jsx';
import Signup from './pages/Signup.jsx';
import Onboarding from './pages/Onboarding.jsx';
import Dashboard from './pages/Dashboard.jsx';
import AssignmentPlay from './pages/AssignmentPlay.jsx';
import AssignmentHistory from './pages/AssignmentHistory.jsx';
import Practice from './pages/Practice.jsx';
import Aptitude from './pages/Aptitude.jsx';
import English from './pages/English.jsx';
import SpeakingLab from './pages/SpeakingLab.jsx';
import Interview from './pages/Interview.jsx';
import GdDebate from './pages/GdDebate.jsx';
import SyllabusPage from './pages/SyllabusPage.jsx';
import ResumePage from './pages/ResumePage.jsx';
import ProjectsPage from './pages/ProjectsPage.jsx';
import ProgressPage from './pages/ProgressPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';

function Protected({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Loading label="Checking your session…" />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  // Route students who haven't finished onboarding to the onboarding flow
  if (!user.onboardingDone) {
    const publicOnboarding = '/onboarding';
    if (!location.pathname.startsWith(publicOnboarding)) {
      return <Navigate to={publicOnboarding} replace />;
    }
  } else if (location.pathname.startsWith('/onboarding')) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AuthGate({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading label="Checking your session…" />;
  if (user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<AuthGate><Login /></AuthGate>} />
        <Route path="/signup" element={<AuthGate><Signup /></AuthGate>} />
        <Route path="/onboarding" element={<Protected><Onboarding /></Protected>} />

        <Route element={<Protected><Layout /></Protected>}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/assignment" element={<AssignmentPlay />} />
          <Route path="/assignments" element={<AssignmentHistory />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/aptitude" element={<Aptitude />} />
          <Route path="/english" element={<English />} />
          <Route path="/speaking" element={<SpeakingLab />} />
          <Route path="/interview" element={<Interview />} />
          <Route path="/gd" element={<GdDebate />} />
          <Route path="/syllabus" element={<SyllabusPage />} />
          <Route path="/resume" element={<ResumePage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/progress" element={<ProgressPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
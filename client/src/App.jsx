import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';
import AuthScreen from './pages/AuthScreen.jsx';
import DoctorDashboard from './pages/DoctorDashboard.jsx';
import Dashboard from './pages/Dashboard.jsx';
export default function App() {
  const [session, setSession] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('sweety-token');
    if (!token) { setCheckingSession(false); return; }
    api('/api/auth/me', { token })
      .then(data => setSession({ token, user: data.user }))
      .catch(() => localStorage.removeItem('sweety-token'))
      .finally(() => setCheckingSession(false));
  }, []);

  const onAuthenticated = value => {
    localStorage.setItem('sweety-token', value.token);
    setSession(value);
  };
  const signOut = useCallback(() => {
    localStorage.removeItem('sweety-token');
    setSession(null);
  }, []);

  if (checkingSession) return <div className="page-loading">Opening your tracker…</div>;
  if (!session) return <AuthScreen onAuthenticated={onAuthenticated} />;
  return session.user.role === 'doctor'
    ? <DoctorDashboard session={session} onSignOut={signOut} />
    : <Dashboard session={session} onSignOut={signOut} />;
}

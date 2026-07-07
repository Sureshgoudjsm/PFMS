import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { MotionPreferencesProvider } from './context/MotionPreferencesContext';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import People from './pages/People';
import Accounts from './pages/Accounts';
import AIChat from './pages/AIChat';
import Forecast from './pages/Forecast';
import Audit from './pages/Audit';
import Settings from './pages/Settings';
import Login from './pages/Login';
import { api } from './api/client';

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('pfms_token'));
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (token) {
      api.getMe()
        .then((userData) => {
          localStorage.setItem('pfms_user', JSON.stringify(userData));
        })
        .catch(() => {
          localStorage.removeItem('pfms_token');
          localStorage.removeItem('pfms_user');
          setToken(null);
        })
        .finally(() => {
          setChecking(false);
        });
    } else {
      setChecking(false);
    }
  }, [token]);

  const handleLoginSuccess = (newToken: string) => {
    setToken(newToken);
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400 text-xs">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent mr-2" />
        Securing session connection...
      </div>
    );
  }

  if (!token) {
    return (
      <ThemeProvider>
        <MotionPreferencesProvider>
          <Login onLoginSuccess={handleLoginSuccess} />
        </MotionPreferencesProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <MotionPreferencesProvider>
        <BrowserRouter>
          <Layout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/people" element={<People />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/copilot" element={<AIChat />} />
              <Route path="/forecast" element={<Forecast />} />
              <Route path="/audit" element={<Audit />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Layout>
        </BrowserRouter>
      </MotionPreferencesProvider>
    </ThemeProvider>
  );
}

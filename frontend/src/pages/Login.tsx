import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, User, Wallet, Eye, EyeOff, Mail, AlertTriangle } from 'lucide-react';
import { api } from '../api/client';

interface LoginProps {
  onLoginSuccess: (token: string, user: any) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setLoading(true);

    try {
      if (isLogin) {
        const response = await api.login(username, password);
        localStorage.setItem('pfms_token', response.access_token);
        localStorage.setItem('pfms_user', JSON.stringify(response.user));
        onLoginSuccess(response.access_token, response.user);
      } else {
        await requestRegister();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication failed. Please verify credentials.');
      setLoading(false);
    }
  };

  const requestRegister = async () => {
    try {
      // Use standard fetch or api direct (we need custom fetch for register as it's not a standard REST call on other routers)
      const res = await fetch(`${((import.meta as any).env.VITE_API_URL || '').replace(/\/+$/, '')}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          email,
          password,
          full_name: fullName,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: 'Registration failed.' }));
        throw new Error(err.detail || 'Registration failed.');
      }

      // Auto login after signup
      const loginRes = await api.login(username, password);
      localStorage.setItem('pfms_token', loginRes.access_token);
      localStorage.setItem('pfms_user', JSON.stringify(loginRes.user));
      onLoginSuccess(loginRes.access_token, loginRes.user);
    } catch (err: any) {
      setErrorMsg(err.message || 'Registration failed.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100 relative overflow-hidden select-none">
      {/* Dynamic Background Orbs */}
      <div className="absolute top-1/4 left-1/4 h-[300px] w-[300px] rounded-full bg-indigo-500/10 blur-[120px]" />
      <div className="absolute bottom-1/4 right-1/4 h-[350px] w-[350px] rounded-full bg-violet-600/10 blur-[140px]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-md rounded-2xl border border-slate-800/80 bg-slate-900/40 p-8 shadow-2xl backdrop-blur-xl relative z-10"
      >
        <div className="mb-6 flex flex-col items-center justify-center gap-2">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]">
            <Wallet className="h-6 w-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white mt-2">
            Personal Finance Ledger
          </h1>
          <p className="text-xs text-slate-400">
            Secure multi-user financial tracking
          </p>
        </div>

        {/* Tab Switches */}
        <div className="mb-6 flex rounded-lg bg-slate-950 p-1 border border-slate-800/60">
          <button
            type="button"
            onClick={() => {
              setIsLogin(true);
              setErrorMsg(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
              isLogin ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Log In
          </button>
          <button
            type="button"
            onClick={() => {
              setIsLogin(false);
              setErrorMsg(null);
            }}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-all ${
              !isLogin ? 'bg-indigo-500 text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Register
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <AnimatePresence mode="wait">
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-start gap-2.5 rounded-lg border border-red-800 bg-red-950/20 p-3 text-xs text-red-400 leading-normal"
              >
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form Fields */}
          <div className="flex flex-col gap-3.5">
            {/* Full Name (Register only) */}
            {!isLogin && (
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Full Name</label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    placeholder="Enter your full name"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 pl-10 pr-4 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* Username */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  placeholder="Enter username"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 pl-10 pr-4 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Email (Register only) */}
            {!isLogin && (
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 pl-10 pr-4 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}

            {/* Password */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder={isLogin ? 'Enter password' : 'Create strong password'}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950/60 py-2.5 pl-10 pr-10 text-xs text-slate-100 placeholder-slate-500 outline-none focus:border-indigo-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <motion.button
            type="submit"
            disabled={loading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full rounded-lg bg-indigo-500 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-600 disabled:opacity-50 mt-2 transition-all flex items-center justify-center"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Processing...
              </span>
            ) : isLogin ? (
              'Access Ledger'
            ) : (
              'Create Account'
            )}
          </motion.button>
        </form>
      </motion.div>
    </div>
  );
}

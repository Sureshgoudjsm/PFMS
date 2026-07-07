import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, Sun, Moon, LogOut } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useMotionPreferences } from '../context/MotionPreferencesContext';
import { NotificationBell } from './NotificationBell';
import CommandPalette from './CommandPalette';
import Sidebar from './Sidebar';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();
  const { shouldReduceMotion } = useMotionPreferences();

  const userRaw = localStorage.getItem('pfms_user');
  const user = userRaw ? JSON.parse(userRaw) : null;

  const handleLogout = () => {
    localStorage.removeItem('pfms_token');
    localStorage.removeItem('pfms_user');
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-gradient-to-b from-[#0B132B] to-[#0D1B3E]">
      {/* 1. Desktop Static Sidebar */}
      <div className="hidden lg:flex fixed top-0 bottom-0 left-0 w-64 z-30">
        <Sidebar />
      </div>

      {/* 2. Mobile Sidebar Overlay Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative z-10 w-64 h-full">
            <Sidebar onCloseMobile={() => setMobileSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* 3. Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header Bar */}
        <header className="sticky top-0 z-25 border-b border-slate-800/80 bg-[#090e1b]/80 backdrop-blur-md lg:pl-64">
          <div className="mx-auto flex w-full items-center justify-between px-6 py-4">
            {/* Left: Mobile hamburger menu toggle */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg border border-slate-800 bg-slate-900/50 text-slate-300 hover:bg-slate-800 transition"
                aria-label="Open navigation menu"
              >
                <Menu size={18} />
              </button>

              <div className="lg:hidden flex items-center gap-2">
                <span className="font-extrabold text-sm text-slate-100 tracking-tight">PFMS</span>
              </div>
            </div>

            {/* Right: Theme, Notifications, Profile */}
            <div className="flex items-center gap-4">
              <button
                onClick={toggleTheme}
                className="rounded-xl border border-slate-800 bg-slate-900/50 p-2 text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
                aria-label="Toggle theme"
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>

              <div className="flex items-center justify-center">
                <NotificationBell />
              </div>

              {user && (
                <div className="flex items-center gap-2 border-l border-slate-800 pl-4">
                  <img
                    src={user.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.username}`}
                    alt="avatar"
                    className="h-8 w-8 rounded-full bg-slate-950 border border-slate-800 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
                  />
                  <div className="hidden flex-col sm:flex">
                    <span className="text-xs font-bold text-slate-200 leading-tight">
                      {user.full_name || user.username}
                    </span>
                    <span className="text-[9px] text-slate-400 font-semibold font-mono uppercase tracking-wider leading-none mt-0.5">
                      @{user.username}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="rounded-xl border border-slate-800 bg-slate-900/50 p-2 text-slate-400 hover:text-red-400 hover:bg-red-950/20 active:scale-95 transition ml-2 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]"
                    title="Logout"
                    aria-label="Log out"
                  >
                    <LogOut size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Content Area - Shifted left to clear desktop sidebar */}
        <main className="lg:pl-64 flex-1 w-full max-w-7xl mx-auto px-6 py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={shouldReduceMotion ? { opacity: 1 } : { opacity: 0 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.15 }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}

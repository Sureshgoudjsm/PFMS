import { useState, useCallback, createContext, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trophy } from 'lucide-react';

interface Milestone {
  type: string;
  message: string;
}

interface ToastEntry extends Milestone {
  id: number;
}

interface MilestoneToastContextValue {
  showMilestone: (milestone: Milestone) => void;
}

const MilestoneToastContext = createContext<MilestoneToastContextValue | null>(null);

let idCounter = 0;

export function MilestoneToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const showMilestone = useCallback((milestone: Milestone) => {
    const id = ++idCounter;
    setToasts((prev) => [...prev, { ...milestone, id }]);

    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <MilestoneToastContext.Provider value={{ showMilestone }}>
      {children}
      {/* Toast container - top-right */}
      <div className="fixed top-4 right-4 z-[200] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 100, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="pointer-events-auto w-80 rounded-xl border border-amber-500/30 bg-slate-900 p-4 shadow-2xl shadow-amber-500/10"
            >
              <div className="flex items-start gap-3">
                {/* Confetti / trophy icon */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-400">
                  <Trophy size={20} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🎉</span>
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                      {toast.type}
                    </span>
                    <span className="text-sm">🎊</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-300 leading-snug">
                    {toast.message}
                  </p>
                </div>

                <button
                  onClick={() => dismiss(toast.id)}
                  className="shrink-0 rounded-lg p-1 text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition"
                  aria-label="Dismiss milestone"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Auto-dismiss progress bar */}
              <motion.div
                className="mt-3 h-0.5 rounded-full bg-amber-500/40"
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: 5, ease: 'linear' }}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </MilestoneToastContext.Provider>
  );
}

export function useMilestoneToast() {
  const ctx = useContext(MilestoneToastContext);
  if (!ctx) {
    // Return a no-op fallback so components don't crash if provider is missing
    return {
      showMilestone: (_: Milestone) => {
        console.warn('MilestoneToastProvider not found in tree');
      },
    };
  }
  return ctx;
}

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, CheckCheck, X } from 'lucide-react';
import { api } from '../api/client';
import { useMotionPreferences } from '../context/MotionPreferencesContext';

interface Notification {
  id: number;
  type: string;
  message: string;
  related_entity_type: string | null;
  related_entity_id: number | null;
  created_at: string;
  read_at: string | null;
}

const TYPE_STYLES: Record<string, { color: string; label: string }> = {
  EMI_DUE: { color: 'text-amber-400', label: 'EMI Due' },
  UNUSUAL_SPEND: { color: 'text-blue-400', label: 'Spend Alert' },
  LEDGER_REMINDER: { color: 'text-purple-400', label: 'Ledger' },
  CREDIT_WATCH: { color: 'text-red-400', label: 'Credit' },
};

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function NotificationBell() {
  const { shouldReduceMotion } = useMotionPreferences();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [shouldPing, setShouldPing] = useState(false);
  const prevCountRef = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  const fetchNotifications = async () => {
    try {
      const data = await api.getNotifications();
      const currentUnread = data.filter((n: any) => !n.read_at).length;
      if (currentUnread > prevCountRef.current) {
        setShouldPing(true);
        setTimeout(() => setShouldPing(false), 1000);
      }
      prevCountRef.current = currentUnread;
      setNotifications(data);
    } catch {
      /* silent */
    }
  };

  // Initial fetch + 60s polling
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60_000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const markOne = async (id: number) => {
    try {
      await api.markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
      // Decrement the reference counter accordingly
      prevCountRef.current = Math.max(0, prevCountRef.current - 1);
    } catch {
      /* silent */
    }
  };

  const markAll = async () => {
    setLoading(true);
    try {
      await api.markAllNotificationsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
      );
      prevCountRef.current = 0;
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  };

  const panelVariants = shouldReduceMotion
    ? undefined
    : {
        hidden: { opacity: 0, y: -8, scale: 0.96 },
        visible: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: -4, scale: 0.97 },
      };
  const panelTransition = shouldReduceMotion ? { duration: 0 } : { duration: 0.18 };

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={buttonRef}
        onClick={() => setOpen((v) => !v)}
        className="relative rounded-xl border border-slate-800 bg-slate-900/50 p-2 text-slate-300 hover:bg-slate-800 hover:text-slate-100 transition shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <>
            <span
              className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-extrabold leading-none text-white z-10 shadow-md font-mono"
              aria-live="polite"
              aria-label={`${unreadCount} unread notifications`}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
            {shouldPing && !shouldReduceMotion && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[1rem] rounded-full bg-red-500 animate-ping opacity-75 z-0" />
            )}
          </>
        )}
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-label="Notifications panel"
            variants={panelVariants}
            transition={panelTransition}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute right-0 top-full z-50 mt-2 w-80 origin-top-right overflow-hidden rounded-xl border border-slate-800 bg-[#0d1527]/95 backdrop-blur-md shadow-2xl sm:w-96"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 bg-[#090e1b]/40">
              <span className="text-sm font-bold text-slate-100">
                Notifications
                {unreadCount > 0 && (
                  <span className="ml-2 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-red-400 border border-red-500/20">
                    {unreadCount} new
                  </span>
                )}
              </span>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAll}
                    disabled={loading}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs text-slate-400 hover:bg-slate-800 hover:text-purple-400 disabled:opacity-50 transition"
                    aria-label="Mark all as read"
                  >
                    <CheckCheck size={13} />
                    All read
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 transition"
                  aria-label="Close notifications"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* List */}
            <ul
              role="list"
              className="max-h-80 overflow-y-auto divide-y divide-slate-800/80"
            >
              {notifications.length === 0 ? (
                <li className="flex flex-col items-center gap-2 py-12 text-center">
                  <Bell size={28} className="text-slate-700 animate-pulse" />
                  <p className="text-xs text-slate-500">No notifications yet</p>
                </li>
              ) : (
                notifications.map((n) => {
                  const style = TYPE_STYLES[n.type] ?? { color: 'text-slate-400', label: n.type };
                  const isUnread = !n.read_at;
                  return (
                    <li
                      key={n.id}
                      role="listitem"
                      className={`group relative cursor-pointer px-4 py-3.5 transition-colors hover:bg-slate-800/20 ${
                        isUnread ? 'bg-purple-500/5 border-l-2 border-l-purple-500 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]' : ''
                      }`}
                      onClick={() => isUnread && markOne(n.id)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${style.color} bg-slate-950/60 border border-slate-800`}>
                          {style.label}
                        </span>
                        <span className="shrink-0 text-[10px] text-slate-500 font-semibold font-mono uppercase">
                          {timeAgo(n.created_at)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-300 line-clamp-3 font-medium">
                        {n.message}
                      </p>
                    </li>
                  );
                })
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

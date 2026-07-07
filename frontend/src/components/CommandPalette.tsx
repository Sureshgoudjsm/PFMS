import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, X, ArrowRight, ArrowLeftRight, Wallet, Users, Tag, Calendar, Bell, Sparkles } from 'lucide-react';
import { api } from '../api/client';

interface SearchResult {
  type: 'transaction' | 'account' | 'person' | 'category' | 'emi' | 'notification' | 'copilot';
  id: number;
  label: string;
  sublabel?: string;
}

interface GroupedResults {
  Transactions: SearchResult[];
  Accounts: SearchResult[];
  People: SearchResult[];
  Categories: SearchResult[];
  EMIs: SearchResult[];
  Notifications: SearchResult[];
}

const GROUP_ICONS: Record<string, React.ElementType> = {
  Transactions: ArrowLeftRight,
  Accounts: Wallet,
  People: Users,
  Categories: Tag,
  EMIs: Calendar,
  Notifications: Bell,
};

const TYPE_ROUTE: Record<string, string> = {
  transaction: '/transactions',
  account: '/accounts',
  person: '/people',
  category: '/transactions',
  emi: '/forecast',
  notification: '/',
};

function groupResults(results: SearchResult[]): GroupedResults {
  const grouped: GroupedResults = {
    Transactions: [],
    Accounts: [],
    People: [],
    Categories: [],
    EMIs: [],
    Notifications: [],
  };
  for (const r of results) {
    if (r.type === 'transaction') grouped.Transactions.push(r);
    else if (r.type === 'account') grouped.Accounts.push(r);
    else if (r.type === 'person') grouped.People.push(r);
    else if (r.type === 'category') grouped.Categories.push(r);
    else if (r.type === 'emi') grouped.EMIs.push(r);
    else if (r.type === 'notification') grouped.Notifications.push(r);
  }
  return grouped;
}

// Detect if query looks like a natural language query
function isNLQuery(text: string): boolean {
  const clean = text.toLowerCase().trim();
  if (clean.endsWith('?')) return true;
  const questionWords = ['what', 'how', 'how much', 'why', 'who', 'show', 'get', 'when', 'upcoming', 'average', 'spent'];
  return questionWords.some((word) => clean.startsWith(word + ' ') || clean.includes(' ' + word + ' '));
}

export default function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const navigate = useNavigate();

  // If query is an NL query, insert a special AI Copilot action at index 0
  const aiAction: SearchResult | null = query.trim().length >= 3 && isNLQuery(query) ? {
    type: 'copilot',
    id: -1,
    label: `Ask AI Copilot: "${query}"`,
    sublabel: 'Run query through Gemini intelligence',
  } : null;

  // Flatten results for keyboard navigation
  const flatResults = aiAction ? [aiAction, ...results] : results;

  // Global keyboard shortcut: Ctrl+K / Cmd+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setResults([]);
      setActiveIndex(0);
    }
  }, [open]);

  // Debounced search
  const doSearch = useCallback((q: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (!q.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const data = await api.search(q);
        // Map backend SearchResponse schema into SearchResult items
        const items: SearchResult[] = [];
        if (data.transactions) {
          items.push(...data.transactions.map((t: any) => ({ type: 'transaction' as const, id: t.id, label: t.title, sublabel: t.subtitle })));
        }
        if (data.accounts) {
          items.push(...data.accounts.map((a: any) => ({ type: 'account' as const, id: a.id, label: a.title, sublabel: a.subtitle })));
        }
        if (data.people) {
          items.push(...data.people.map((p: any) => ({ type: 'person' as const, id: p.id, label: p.title, sublabel: p.subtitle })));
        }
        if (data.categories) {
          items.push(...data.categories.map((c: any) => ({ type: 'category' as const, id: c.id, label: c.title, sublabel: c.subtitle })));
        }
        if (data.emis) {
          items.push(...data.emis.map((e: any) => ({ type: 'emi' as const, id: e.id, label: e.title, sublabel: e.subtitle })));
        }
        if (data.notifications) {
          items.push(...data.notifications.map((n: any) => ({ type: 'notification' as const, id: n.id, label: n.title, sublabel: n.subtitle })));
        }
        setResults(items);
        setActiveIndex(0);
      } catch (err) {
        console.error(err);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
  }, []);

  useEffect(() => {
    doSearch(query);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [query, doSearch]);

  function handleSelect(result: SearchResult) {
    setOpen(false);
    if (result.type === 'copilot') {
      navigate('/copilot', { state: { query } });
    } else {
      const route = TYPE_ROUTE[result.type] || '/';
      navigate(route);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flatResults[activeIndex]) {
      handleSelect(flatResults[activeIndex]);
    }
  }

  const grouped = groupResults(results);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={() => setOpen(false)}
        >
          <motion.div
            className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden"
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ duration: 0.15 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Search input */}
            <div className="flex items-center gap-3 border-b border-slate-700 px-4 py-3">
              <Search size={18} className="text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search transactions, accounts, people, EMIs..."
                className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="text-slate-500 hover:text-slate-300"
                >
                  <X size={16} />
                </button>
              )}
              <kbd className="hidden sm:inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400 font-mono">
                ESC
              </kbd>
            </div>

            {/* Results */}
            <div className="max-h-80 overflow-y-auto p-2">
              {loading && (
                <div className="flex items-center justify-center py-8">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                </div>
              )}

              {/* Special AI Copilot Action */}
              {aiAction && (
                <div className="mb-2">
                  <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    <Sparkles size={12} className="text-indigo-400 animate-pulse" />
                    AI Intelligence
                  </div>
                  <button
                    onClick={() => handleSelect(aiAction)}
                    onMouseEnter={() => setActiveIndex(0)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                      activeIndex === 0
                        ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                        : 'text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    <div>
                      <span className="font-semibold text-indigo-400">{aiAction.label}</span>
                      <span className="ml-2 text-xs text-slate-500">{aiAction.sublabel}</span>
                    </div>
                    <ArrowRight size={14} className="text-indigo-400" />
                  </button>
                </div>
              )}

              {!loading && query && flatResults.length === 0 && (
                <p className="py-8 text-center text-xs text-slate-500">
                  No results found for "{query}"
                </p>
              )}

              {!loading && !query && (
                <p className="py-8 text-center text-xs text-slate-500">
                  Start typing to search...
                </p>
              )}

              {!loading &&
                results.length > 0 &&
                (Object.entries(grouped) as [string, SearchResult[]][]).map(
                  ([groupName, items]) => {
                    if (items.length === 0) return null;
                    const GroupIcon = GROUP_ICONS[groupName] || Tag;
                    return (
                      <div key={groupName} className="mb-2">
                        <div className="flex items-center gap-2 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                          <GroupIcon size={12} />
                          {groupName}
                        </div>
                        {items.map((item) => {
                          const globalIdx = flatResults.indexOf(item);
                          const isActive = globalIdx === activeIndex;
                          return (
                            <button
                              key={`${item.type}-${item.id}`}
                              onClick={() => handleSelect(item)}
                              onMouseEnter={() => setActiveIndex(globalIdx)}
                              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition ${
                                isActive
                                  ? 'bg-indigo-500/15 text-indigo-300'
                                  : 'text-slate-300 hover:bg-slate-800'
                              }`}
                            >
                              <div className="truncate pr-4">
                                <span className="font-medium">{item.label}</span>
                                {item.sublabel && (
                                  <span className="ml-2 text-xs text-slate-500 block sm:inline">
                                    {item.sublabel}
                                  </span>
                                )}
                              </div>
                              {isActive && (
                                <ArrowRight size={14} className="text-indigo-400 shrink-0" />
                              )}
                            </button>
                          );
                        })}
                      </div>
                    );
                  }
                )}
            </div>

            {/* Footer hint */}
            <div className="border-t border-slate-700 px-4 py-2 flex items-center gap-4 text-[10px] text-slate-500">
              <span>↑↓ navigate</span>
              <span>↵ select</span>
              <span>esc close</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

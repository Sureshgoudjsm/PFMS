import { useEffect, useState } from 'react';
import { api } from '../api/client';
import SummaryCards from '../components/SummaryCards';
import TrendChart from '../components/TrendChart';
import TransactionList from '../components/TransactionList';
import { HealthScoreCard } from '../components/HealthScoreCard';
import EmptyState from '../components/EmptyState';
import type { DashboardData } from '../types';
import { formatCurrency } from '../utils/format';
import { Sparkles, TrendingUp, Info, Bot, Shield, ChevronDown, Check, LayoutGrid } from 'lucide-react';

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [emis, setEmis] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Sample data states
  const [seeding, setSeeding] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);

  // Customize dropdown state
  const [showCustomize, setShowCustomize] = useState(false);

  // Widget visibility states (loaded from localStorage)
  const [showHealth, setShowHealth] = useState(() => localStorage.getItem('widget_health') !== 'false');
  const [showTrend, setShowTrend] = useState(() => localStorage.getItem('widget_trend') !== 'false');
  const [showEmis, setShowEmis] = useState(() => localStorage.getItem('widget_emis') !== 'false');
  const [showRecent, setShowRecent] = useState(() => localStorage.getItem('widget_recent') !== 'false');

  // Explainer dismissal state
  const [dismissedNetWorth, setDismissedNetWorth] = useState(() => localStorage.getItem('dismiss_net_worth') === 'true');

  const loadData = () => {
    setError(null);
    Promise.all([
      api.getDashboard(),
      api.getEmis()
    ])
      .then(([dbData, emiList]) => {
        setData(dbData);
        setEmis(emiList);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSeedSample = async () => {
    setSeeding(true);
    try {
      await api.seedSampleData();
      loadData();
    } catch (e: any) {
      setError(e.message || 'Failed to seed sample data');
    } finally {
      setSeeding(false);
    }
  };

  const handleClearSample = async () => {
    setClearing(true);
    try {
      await api.clearSampleData();
      setShowClearModal(false);
      loadData();
    } catch (e: any) {
      setError(e.message || 'Failed to clear sample data');
    } finally {
      setClearing(false);
    }
  };

  const handleDismissNetWorth = () => {
    localStorage.setItem('dismiss_net_worth', 'true');
    setDismissedNetWorth(true);
  };

  const toggleWidget = (widget: string, current: boolean, setter: (v: boolean) => void) => {
    localStorage.setItem(`widget_${widget}`, (!current).toString());
    setter(!current);
  };

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
        <p className="text-xs text-slate-400 font-mono uppercase tracking-widest">Loading snapshot...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card border-rose-900/50 bg-rose-950/20 text-rose-300 shadow-2xl p-6">
        <h3 className="font-bold text-sm uppercase tracking-wider mb-1">Connection Error</h3>
        <p className="text-xs leading-relaxed text-slate-400">
          Failed to load dashboard data: {error}. Make sure the backend server is running on port 8000.
        </p>
      </div>
    );
  }

  if (!data) return null;

  const isFirstRun = data.total_accounts === 0 && data.total_transactions === 0;
  const isTrendEmpty = data.trend.length === 0 || data.trend.every(t => t.income === 0 && t.expenses === 0);

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-100 tracking-tight">Dashboard</h2>
          <p className="text-xs text-slate-400 font-medium font-mono uppercase tracking-wider mt-0.5">
            Your financial snap at a glance
          </p>
        </div>

        {/* Customize button */}
        {!isFirstRun && (
          <div className="relative">
            <button
              onClick={() => setShowCustomize(!showCustomize)}
              className="btn-secondary flex items-center gap-2 bg-slate-900/50 border-slate-800 text-slate-300"
            >
              <LayoutGrid size={15} />
              <span>Customize Layout</span>
              <ChevronDown size={14} className={`transform transition-transform ${showCustomize ? 'rotate-180' : ''}`} />
            </button>

            {showCustomize && (
              <div className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-800 bg-[#0d1527]/95 backdrop-blur-md p-2 shadow-2xl z-30">
                <p className="px-3 py-1.5 text-[9px] font-bold text-slate-500 uppercase tracking-widest font-mono">Toggle Widgets</p>
                <div className="space-y-0.5">
                  <button
                    onClick={() => toggleWidget('health', showHealth, setShowHealth)}
                    className="flex w-full items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800/40 text-left transition"
                  >
                    <span>Health Score Card</span>
                    {showHealth && <Check size={14} className="text-purple-400" />}
                  </button>
                  <button
                    onClick={() => toggleWidget('trend', showTrend, setShowTrend)}
                    className="flex w-full items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800/40 text-left transition"
                  >
                    <span>Financial Trends</span>
                    {showTrend && <Check size={14} className="text-purple-400" />}
                  </button>
                  <button
                    onClick={() => toggleWidget('emis', showEmis, setShowEmis)}
                    className="flex w-full items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800/40 text-left transition"
                  >
                    <span>Active EMIs</span>
                    {showEmis && <Check size={14} className="text-purple-400" />}
                  </button>
                  <button
                    onClick={() => toggleWidget('recent', showRecent, setShowRecent)}
                    className="flex w-full items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800/40 text-left transition"
                  >
                    <span>Recent Transactions</span>
                    {showRecent && <Check size={14} className="text-purple-400" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Demo data seeding warning banner */}
      {data.has_sample_data && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-purple-500/20 bg-purple-500/5 px-4 py-3 shadow-[0_4px_20px_-2px_rgba(168,85,247,0.1)]">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
            <p className="text-xs text-slate-300">
              You are currently viewing <strong className="text-purple-400 font-bold">Sample Demo Data</strong>. Real transactions you log will be kept when clearing sample data.
            </p>
          </div>
          <button
            onClick={() => setShowClearModal(true)}
            className="rounded-lg bg-purple-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-700 transition"
          >
            Clear Sample Data
          </button>
        </div>
      )}

      {/* ========================================== */}
      {/* FIRST-RUN STATE (Clean, Centered Layout) */}
      {/* ========================================== */}
      {isFirstRun ? (
        <div className="space-y-6 max-w-4xl mx-auto">
          {/* Health Score above the fold */}
          <HealthScoreCard />

          {/* Welcome Hero Card */}
          <div className="card flex flex-col items-center justify-center p-8 text-center gap-5 border border-purple-500/30 bg-slate-900/40">
            <div className="h-14 w-14 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 border border-purple-500/20 shadow-inner">
              <Sparkles size={26} className="animate-pulse" />
            </div>
            <div className="space-y-2">
              <h3 className="text-2xl font-black text-slate-100 tracking-tight">Welcome to PFMS!</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                Get started by adding accounts, telling the AI Copilot to log transactions, or test the app instantly with pre-populated sample records.
              </p>
            </div>
            <button
              onClick={handleSeedSample}
              disabled={seeding}
              className="btn-primary"
            >
              {seeding ? 'Seeding Sample Data...' : 'Try with Sample Data'}
            </button>
          </div>

          {/* Dismissible Net Worth Explainer Card (Matches `#explainer-card` in demo) */}
          {!dismissedNetWorth && (
            <div id="explainer-card" className="card relative p-5 border border-purple-500/20 bg-[#0d1527]/90 flex items-start gap-4">
              <div className="rounded-full bg-purple-500/10 p-2 text-purple-400 border border-purple-500/20 shrink-0">
                <Info size={16} />
              </div>
              <div className="flex-1 min-w-0 pr-8">
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-400 font-mono">
                  💡 Net Worth Concept
                </h4>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Net Worth represents your total financial value. Calculated as: **Assets** (cash, wallet, bank accounts) minus **Liabilities** (credit cards, loans). Log a transaction or link an account to watch it build!
                </p>
              </div>
              <button
                onClick={handleDismissNetWorth}
                className="absolute top-4 right-4 text-[10px] text-slate-500 hover:text-slate-300 font-bold uppercase font-mono tracking-wider"
                aria-label="Dismiss Net Worth concept explainer"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      ) : (
        /* ========================================== */
        /* WITH-DATA STATE (Rich Bento Layout)        */
        /* ========================================== */
        <div className="space-y-6">
          {/* Health Score Card */}
          {showHealth && <HealthScoreCard />}

          {/* Financial Snapshot summary grids */}
          <SummaryCards summary={data.summary} />

          {/* Bento grid containing Trend Chart, EMIs, and Recent Transactions */}
          <div className="grid gap-6 lg:grid-cols-5">
            {/* Left 3 columns: Charts and EMIs */}
            <div className="lg:col-span-3 space-y-6">
              {/* Trend Chart (toggled) */}
              {showTrend && (
                isTrendEmpty ? (
                  <EmptyState
                    icon={TrendingUp}
                    title="Income & Expense Trends"
                    description="Your income and expense trends will appear here once your transactions are tracked."
                  />
                ) : (
                  <TrendChart data={data.trend} />
                )
              )}

              {/* Active EMIs Section (toggled) */}
              {showEmis && (
                <div className="card">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-3 mb-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                      💳 Active EMIs
                    </h3>
                  </div>
                  {emis.length === 0 ? (
                    <p className="text-xs text-slate-500 py-2">No active EMIs scheduled.</p>
                  ) : (
                    <div className="divide-y divide-slate-800/80">
                      {emis.map((emi) => (
                        <div key={emi.id} className="py-3 flex items-center justify-between gap-3 text-xs">
                          <div>
                            <p className="font-bold text-slate-200">{emi.emi_name}</p>
                            <p className="text-[10px] text-slate-500 mt-0.5">Due: Day {emi.due_date} of the month</p>
                          </div>
                          <p className="font-extrabold text-rose-500">{formatCurrency(emi.amount)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right 2 columns: Recent Transactions & Insights */}
            <div className="lg:col-span-2 space-y-6">
              {/* Recent Transactions List */}
              {showRecent && (
                <div className="w-full">
                  {data.recent_transactions.length === 0 ? (
                    <EmptyState
                      icon={TrendingUp}
                      title="No transactions yet"
                      description="Create your first transaction using the Transactions tab or AI chat."
                    />
                  ) : (
                    <TransactionList transactions={data.recent_transactions} title="Recent Activity" />
                  )}
                </div>
              )}

              {/* System Insights card (Bento layout right pane) */}
              <div className="card space-y-4 bg-slate-900/40 border border-slate-800">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 border-b border-slate-800 pb-3">
                  ⚙️ System Insights
                </h3>

                <div className="space-y-4">
                  {/* Telegram status */}
                  <div className="flex gap-3 items-start">
                    <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 shrink-0 shadow-inner">
                      <Bot size={16} />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xs font-bold text-slate-300">Telegram Bot Linked</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                        To link your Telegram profile, go to the Settings page to generate a verification code. Use the bot to query balances on-the-go.
                      </p>
                    </div>
                  </div>

                  {/* Encryption status */}
                  <div className="flex gap-3 items-start">
                    <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 shrink-0 shadow-inner">
                      <Shield size={16} />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xs font-bold text-slate-300">Local-first Security</h4>
                      <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">
                        All transaction data is encrypted and persisted in your local SQLite file `C:/PFMS/backend/pfms.db`. Private key matches local device auth.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="card max-w-sm w-full border-slate-800 bg-slate-900 text-slate-100 shadow-2xl p-6">
            <h3 className="text-lg font-bold">Remove Sample Data?</h3>
            <p className="text-xs text-slate-400 mt-2 leading-relaxed">
              Are you sure you want to clear all sample data? Any real transactions you've added will be kept.
            </p>
            <div className="mt-5 flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
              <button
                onClick={() => setShowClearModal(false)}
                className="rounded-lg border border-slate-700 px-3.5 py-1.5 text-xs font-semibold hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleClearSample}
                disabled={clearing}
                className="rounded-lg bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 transition"
              >
                {clearing ? 'Clearing...' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

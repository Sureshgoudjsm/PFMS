import { useEffect, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronDown, RefreshCw, Sparkles, TrendingUp } from 'lucide-react';
import { api } from '../api/client';
import { useMotionPreferences } from '../context/MotionPreferencesContext';

// ── Types ────────────────────────────────────────────────────────────────

interface HealthFactor {
  name: string;
  weight: number;
  raw_value: string;
  sub_score: number;       // -1 = N/A / skipped
  weighted_score: number;  // -1 = N/A / skipped
}

interface HealthScoreData {
  score: number;
  is_sufficient_data: boolean;
  factors: HealthFactor[];
}

// ── Score colour helpers ──────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 75) return '#a855f7';  // purple/primary accent
  if (score >= 50) return '#6366f1';  // indigo
  if (score >= 30) return '#f59e0b';  // amber
  return '#ef4444';                   // red
}

function scoreLabel(score: number): string {
  if (score >= 75) return 'Healthy';
  if (score >= 50) return 'Fair';
  if (score >= 30) return 'Needs Work';
  return 'At Risk';
}

// ── Radial Gauge (SVG-based Circular Progress) ───────────────────────────

function RadialGauge({ score, color }: { score: number; color: string }) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center h-28 w-28 shrink-0 select-none">
      <svg className="w-full h-full transform -rotate-90">
        {/* Background Track Circle */}
        <circle
          cx="56"
          cy="56"
          r={radius}
          className="stroke-slate-800/80"
          strokeWidth="8"
          fill="transparent"
        />
        {/* Foreground Progress Circle */}
        <circle
          cx="56"
          cy="56"
          r={radius}
          stroke={color}
          strokeWidth="8"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      {/* Centered Score Label */}
      <div className="absolute text-center flex flex-col justify-center">
        <span className="block text-3xl font-extrabold tracking-tight leading-none" style={{ color }}>
          {score}
        </span>
        <span className="block text-[8px] font-bold text-slate-500 font-mono uppercase tracking-widest mt-1">
          Health
        </span>
      </div>
    </div>
  );
}

// ── Factor Row ────────────────────────────────────────────────────────────

function FactorRow({ factor }: { factor: HealthFactor }) {
  const isNA = factor.sub_score === -1;
  const barWidth = isNA ? 0 : factor.sub_score;
  const barColor = isNA ? '#475569' : scoreColor(factor.sub_score);

  return (
    <div className="space-y-1.5 p-3.5 rounded-xl bg-slate-950/20 border border-slate-800/60">
      <div className="flex items-center justify-between text-xs">
        <span className="font-semibold text-slate-300">{factor.name}</span>
        <span className={`font-mono font-bold ${isNA ? 'text-slate-500' : 'text-slate-200'}`}>
          {isNA ? 'N/A' : `${factor.sub_score}/100`}
        </span>
      </div>
      {/* Mini Progress Bar */}
      <div className="h-2 w-full rounded-full bg-slate-900 overflow-hidden border border-slate-850 shadow-inner">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${barWidth}%`, backgroundColor: barColor }}
        />
      </div>
      <p className="text-[10px] text-slate-400 font-medium leading-snug">{factor.raw_value}</p>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

export function HealthScoreCard() {
  const { shouldReduceMotion } = useMotionPreferences();
  const [data, setData] = useState<HealthScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [narrative, setNarrative] = useState<string>('');
  const [narrativeLoading, setNarrativeLoading] = useState(false);
  const [narrativeFetched, setNarrativeFetched] = useState(false);

  const fetchScore = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getHealthScore();
      setData(result);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    fetchScore();
  }, [fetchScore]);

  const fetchNarrative = async () => {
    setNarrativeLoading(true);
    try {
      const result = await api.getHealthNarrative();
      setNarrative(result.narrative);
      setNarrativeFetched(true);
    } catch { /* silent */ }
    finally { setNarrativeLoading(false); }
  };

  const expandVariants = shouldReduceMotion
    ? undefined
    : {
        hidden: { opacity: 0, height: 0 },
        visible: { opacity: 1, height: 'auto' as const },
      };
  const expandTransition = shouldReduceMotion ? { duration: 0 } : { duration: 0.25 };

  // ── Loading Skeleton ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="card border border-slate-800 bg-slate-900/40 p-6 animate-pulse shadow-2xl">
        <div className="flex items-center gap-5">
          <div className="h-28 w-28 rounded-full bg-slate-850" />
          <div className="flex-1 space-y-3">
            <div className="h-4 w-32 rounded bg-slate-850" />
            <div className="h-3 w-48 rounded bg-slate-850" />
          </div>
        </div>
      </div>
    );
  }

  // ── Insufficient Data State ───────────────────────────────────────────
  if (!data || !data.is_sufficient_data) {
    return (
      <div
        className="card border border-slate-850 bg-slate-900/20 px-6 py-5 flex items-center gap-4 shadow-sm"
        role="region"
        aria-label="Financial health score"
      >
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-purple-500/5 border border-purple-500/10 text-purple-400">
          <TrendingUp size={22} className="animate-pulse" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-200">Financial Health Score</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Not enough data yet — keep logging transactions for at least 30 days
            (minimum 5 entries).
          </p>
        </div>
      </div>
    );
  }

  const color = scoreColor(data.score);
  const label = scoreLabel(data.score);

  // ── Full Score Card ───────────────────────────────────────────────────
  return (
    <div
      className="card p-0 border border-slate-800 bg-slate-900/40 overflow-hidden shadow-2xl hover:border-purple-500/20"
      role="region"
      aria-label="Financial health score"
    >
      {/* Summary Row — always visible */}
      <div className="flex flex-col sm:flex-row items-center gap-6 px-6 py-6">
        <RadialGauge score={data.score} color={color} />

        <div className="flex-1 min-w-0 w-full text-center sm:text-left">
          <div className="flex flex-col sm:flex-row items-center gap-3 mb-2">
            <h2 className="text-lg font-bold text-slate-200">Financial Health Score</h2>
            <span
              className="rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider font-mono border"
              style={{ backgroundColor: `${color}15`, color, borderColor: `${color}30` }}
            >
              {label}
            </span>
          </div>

          {/* AI Narrative insight */}
          {narrativeFetched && narrative ? (
            <p className="text-xs text-slate-300 leading-relaxed mb-3">
              {narrative}
            </p>
          ) : (
            <p className="text-xs text-slate-400 leading-relaxed mb-3">
              Click the AI insight action below to generate a tailored report based on your ledger factors.
            </p>
          )}

          <div className="flex items-center justify-center sm:justify-start gap-4">
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1.5 text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors focus-visible:outline-none"
              aria-expanded={expanded}
              aria-controls="health-score-breakdown"
            >
              <motion.span
                animate={shouldReduceMotion ? {} : { rotate: expanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronDown size={14} />
              </motion.span>
              {expanded ? 'Hide Factor Breakdown' : 'View Factor Breakdown'}
            </button>

            <button
              onClick={fetchNarrative}
              disabled={narrativeLoading}
              className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors"
              aria-label="Refresh AI narrative"
            >
              {narrativeLoading ? (
                <RefreshCw size={12} className="animate-spin text-indigo-400" />
              ) : (
                <Sparkles size={12} className="text-indigo-400" />
              )}
              {narrativeFetched ? 'Recalculate Insight' : 'Unlock AI Insight'}
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Breakdown */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            id="health-score-breakdown"
            role="region"
            aria-label="Health score factor breakdown"
            variants={expandVariants}
            transition={expandTransition}
            initial="hidden"
            animate="visible"
            exit="hidden"
            className="overflow-hidden"
          >
            <div className="border-t border-slate-800/80 px-6 py-5 grid grid-cols-1 sm:grid-cols-2 gap-4 bg-[#090e1b]/40">
              {data.factors.map(f => (
                <FactorRow key={f.name} factor={f} />
              ))}
            </div>

            {/* Weight redistribution note */}
            {data.factors.some(f => f.sub_score === -1) && (
              <p className="px-6 pb-4 pt-1 text-[10px] text-slate-500 font-medium leading-relaxed bg-[#090e1b]/40">
                ⚠️ Some factors are skipped (N/A); their weight is redistributed proportionally across eligible score segments.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

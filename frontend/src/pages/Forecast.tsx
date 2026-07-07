import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { LineChart, Line, XAxis, YAxis, Tooltip as RechartsTooltip, CartesianGrid, ResponsiveContainer, ReferenceDot } from 'recharts';
import { formatCurrency } from '../utils/format';
import type { ForecastDay } from '../types';
import { Sparkles, TrendingUp, Info } from 'lucide-react';

function applyWhatIf(original: ForecastDay[], sliderPct: number): ForecastDay[] {
  const factor = 1 - sliderPct / 100;
  let cumulativeSavings = 0;
  return original.map((day) => {
    const origSpend = Number(day.events.discretionary_spend);
    const reducedSpend = Math.round(origSpend * factor * 100) / 100;
    const savedToday = origSpend - reducedSpend;
    cumulativeSavings += savedToday;
    const newBalance = Math.round((day.balance + cumulativeSavings) * 100) / 100;
    return {
      ...day,
      balance: newBalance,
      events: {
        ...day.events,
        discretionary_spend: reducedSpend,
      },
    };
  });
}

// Generate static fake data for ghost chart
const ghostForecastData: ForecastDay[] = Array.from({ length: 30 }, (_, i) => {
  const date = new Date();
  date.setDate(date.getDate() + i);
  return {
    date: date.toISOString().slice(0, 10),
    balance: 100000 - Math.sin(i / 2) * 5000 - i * 800,
    events: { salary_added: false, emi_deducted: false, discretionary_spend: 500 },
  };
});

export default function Forecast() {
  const [rawData, setRawData] = useState<ForecastDay[]>([]);
  const [data, setData] = useState<ForecastDay[]>([]);
  const [slider, setSlider] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [alertThreshold, setAlertThreshold] = useState(1000);

  useEffect(() => {
    async function fetchForecast() {
      try {
        const resp = await api.getForecast();
        setRawData(resp.projection);
        setData(resp.projection);
        const me = await api.getMe();
        setAlertThreshold(me.forecast_alert_threshold ?? 1000);
      } catch (e: any) {
        setError(e.message || 'Failed to load forecast');
      } finally {
        setLoading(false);
      }
    }
    fetchForecast();
  }, []);

  useEffect(() => {
    if (rawData.length) {
      setData(applyWhatIf(rawData, slider));
    }
  }, [slider, rawData]);

  if (loading) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
        <p className="text-xs text-slate-400 font-mono uppercase tracking-widest">Compiling forecast...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card border-rose-900/50 bg-rose-950/20 text-rose-300 shadow-2xl p-6">
        <h3 className="font-bold text-sm uppercase tracking-wider mb-1">Forecast Error</h3>
        <p className="text-xs leading-relaxed text-slate-400">
          Failed to load cash-flow projection: {error}
        </p>
      </div>
    );
  }

  const isForecastEmpty = rawData.length === 0;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const day = payload[0].payload as ForecastDay;
      return (
        <div className="rounded-xl bg-slate-950/95 p-3 text-xs text-slate-200 shadow-2xl border border-slate-800 leading-normal">
          <p className="font-bold text-slate-400 mb-1">{label}</p>
          <p className="font-semibold text-slate-200">Projected Balance: <span className="text-purple-400">{formatCurrency(day.balance)}</span></p>
          <p className="text-slate-400 mt-1">Salary added: {day.events.salary_added ? 'Yes ✓' : 'No —'}</p>
          <p className="text-slate-400">EMI deducted: {day.events.emi_deducted ? 'Yes ✓' : 'No —'}</p>
          <p className="text-slate-400">Est. Discretionary: {formatCurrency(day.events.discretionary_spend as number)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-black text-slate-100 tracking-tight">30-Day Cash-Flow Forecast</h2>
        <p className="text-xs text-slate-400 font-medium font-mono uppercase tracking-wider mt-0.5">
          Predictive account balance projection based on EMI cycles and discretionary spending
        </p>
      </div>

      {/* Control Panel / What-If Slider Card */}
      {!isForecastEmpty && (
        <div className="card p-5 border border-slate-800 bg-slate-900/40 space-y-4">
          <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
            <Sparkles className="text-purple-400" size={18} />
            <div>
              <h3 className="font-bold text-sm text-slate-200">What-If Expense Optimization</h3>
              <p className="text-[11px] text-slate-400">Reduce projected daily discretionary spending to simulate compounding savings.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-xs font-bold text-slate-300 font-mono uppercase tracking-wide">Reduction Factor:</span>
            <input
              type="range"
              min={0}
              max={50}
              step={5}
              value={slider}
              onChange={(e) => setSlider(Number(e.target.value))}
              className="w-48 accent-purple-500 cursor-pointer h-1.5 rounded-lg bg-slate-900 appearance-none border border-slate-800"
            />
            <span className="text-sm font-extrabold text-purple-400 font-mono">{slider}% Saved</span>
          </div>
        </div>
      )}

      {/* Graph Area */}
      <div className="card border border-slate-800 bg-slate-900/40 relative min-h-[450px] p-6 flex flex-col">
        {isForecastEmpty ? (
          <>
            {/* Ghost background chart */}
            <div className="absolute inset-0 opacity-10 pointer-events-none p-6">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ghostForecastData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                  <XAxis dataKey="date" hide />
                  <YAxis hide />
                  <Line type="monotone" dataKey="balance" stroke="#cbd5e1" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Centered Explainer message */}
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 z-10">
              <div className="w-16 h-16 rounded-full bg-purple-500/5 border border-purple-500/10 flex items-center justify-center text-purple-400 shadow-inner">
                <Info size={28} />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-slate-200">No projection data</h3>
                <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
                  Cash flow projections will appear here once you log active accounts and record initial transactions.
                </p>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200 mb-4 flex items-center gap-1.5">
              <TrendingUp size={16} className="text-purple-400" />
              Cash Flow Projection Curve
            </h3>

            <div className="flex-1 min-h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ top: 20, right: 30, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.15} stroke="#cbd5e1" />
                  <XAxis
                    dataKey="date"
                    stroke="#475569"
                    tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                    tickFormatter={(d) => new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  />
                  <YAxis
                    stroke="#475569"
                    tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
                    tickFormatter={(v) => `₹${v.toLocaleString('en-IN')}`}
                  />
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Line type="monotone" dataKey="balance" stroke="#a855f7" strokeWidth={3} dot={false} />
                  {data.map((d) =>
                    d.balance < alertThreshold ? (
                      <ReferenceDot
                        key={d.date}
                        r={4.5}
                        fill="#ef4444"
                        stroke="#0d1b3e"
                        strokeWidth={1.5}
                        x={d.date}
                        y={d.balance}
                      />
                    ) : null
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useRef } from 'react';
import { useMotionValue, useSpring } from 'framer-motion';
import {

  TrendingDown,
  Wallet,
  Banknote,
  CreditCard,
  HandCoins,
  Landmark,
  PiggyBank,
} from 'lucide-react';
import { formatCurrency } from '../utils/format';
import type { DashboardSummary } from '../types';
import { useMotionPreferences } from '../context/MotionPreferencesContext';

interface Props {
  summary: DashboardSummary;
}

const Tooltip = ({ text }: { text: string }) => (
  <span className="group relative ml-1.5 inline-block cursor-help rounded-full bg-slate-800 px-1.5 py-0.5 text-[9px] text-slate-400 hover:bg-slate-700 select-none normal-case">
    ?
    <span className="absolute bottom-full left-1/2 z-50 mb-2 w-48 -translate-x-1/2 rounded-xl bg-slate-950 border border-slate-800 p-2.5 text-[10px] text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none leading-normal font-normal shadow-2xl whitespace-normal text-left">
      {text}
    </span>
  </span>
);

function AnimatedNumber({ value }: { value: number }) {
  const { shouldReduceMotion } = useMotionPreferences();
  const ref = useRef<HTMLSpanElement>(null);
  
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, { stiffness: 80, damping: 18 });

  useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  useEffect(() => {
    if (shouldReduceMotion) {
      if (ref.current) {
        ref.current.textContent = formatCurrency(value);
      }
      return;
    }
    return spring.on('change', (latest) => {
      if (ref.current) {
        ref.current.textContent = formatCurrency(latest);
      }
    });
  }, [spring, value, shouldReduceMotion]);

  return <span ref={ref}>{formatCurrency(shouldReduceMotion ? value : spring.get())}</span>;
}

export default function SummaryCards({ summary }: Props) {
  return (
    <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
      {/* 1. Net Worth (Spans 2 columns) */}
      <div className="card lg:col-span-2 flex flex-col justify-between border-l-4 border-l-purple-500 bg-slate-900/40 hover:bg-slate-800/40 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-200 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
        <div>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center">
                Net Worth
                <Tooltip text="Net Worth = Assets - Liabilities. It represents the value of everything you own minus what you owe." />
              </p>
              <h3 className="mt-2 text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400">
                <AnimatedNumber value={summary.net_worth} />
              </h3>
            </div>
            <div className="rounded-xl p-3 bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-inner">
              <PiggyBank size={24} />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-800/80 pt-4">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 font-mono flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Assets
              </p>
              <p className="text-sm font-bold text-slate-200 mt-0.5">
                <AnimatedNumber value={summary.total_assets} />
              </p>
            </div>
            <div>
              <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 font-mono flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                Liabilities
              </p>
              <p className="text-sm font-bold text-slate-200 mt-0.5">
                <AnimatedNumber value={summary.total_liabilities} />
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Bank Balance */}
      <div className="card flex flex-col justify-between bg-slate-900/40 hover:bg-slate-800/40 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-200 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Bank Balance</p>
            <h4 className="mt-2 text-xl font-bold text-slate-200">
              <AnimatedNumber value={summary.total_bank_balance} />
            </h4>
          </div>
          <div className="rounded-xl p-3 bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-inner">
            <Landmark size={20} />
          </div>
        </div>
      </div>

      {/* 3. Expenses */}
      <div className="card flex flex-col justify-between bg-slate-900/40 hover:bg-slate-800/40 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-200 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">This Month Expenses</p>
            <h4 className="mt-2 text-xl font-bold text-slate-200">
              <AnimatedNumber value={summary.current_month_expenses} />
            </h4>
          </div>
          <div className="rounded-xl p-3 bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-inner">
            <TrendingDown size={20} />
          </div>
        </div>
      </div>

      {/* 4. Cash Balance */}
      <div className="card flex flex-col justify-between bg-slate-900/40 hover:bg-slate-800/40 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-200 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Cash Balance</p>
            <h4 className="mt-2 text-xl font-bold text-slate-200">
              <AnimatedNumber value={summary.cash_balance} />
            </h4>
          </div>
          <div className="rounded-xl p-3 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-inner">
            <Banknote size={20} />
          </div>
        </div>
      </div>

      {/* 5. Credit Card Due */}
      <div className="card flex flex-col justify-between bg-slate-900/40 hover:bg-slate-800/40 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-200 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono flex items-center">
              Credit Card Due
              <Tooltip text="Credit Card Due. Keep utilization under 30% of your credit limit for a healthy credit score." />
            </p>
            <h4 className="mt-2 text-xl font-bold text-slate-200">
              <AnimatedNumber value={summary.credit_outstanding} />
            </h4>
          </div>
          <div className="rounded-xl p-3 bg-orange-500/10 text-orange-400 border border-orange-500/20 shadow-inner">
            <CreditCard size={20} />
          </div>
        </div>
      </div>

      {/* 6. Money Lent */}
      <div className="card flex flex-col justify-between bg-slate-900/40 hover:bg-slate-800/40 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-200 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Money Lent</p>
            <h4 className="mt-2 text-xl font-bold text-slate-200">
              <AnimatedNumber value={summary.money_lent} />
            </h4>
          </div>
          <div className="rounded-xl p-3 bg-violet-500/10 text-violet-400 border border-violet-500/20 shadow-inner">
            <HandCoins size={20} />
          </div>
        </div>
      </div>

      {/* 7. Money Borrowed */}
      <div className="card flex flex-col justify-between bg-slate-900/40 hover:bg-slate-800/40 hover:border-purple-500/40 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-200 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 font-mono">Money Borrowed</p>
            <h4 className="mt-2 text-xl font-bold text-slate-200">
              <AnimatedNumber value={summary.money_borrowed} />
            </h4>
          </div>
          <div className="rounded-xl p-3 bg-amber-500/10 text-amber-400 border border-amber-500/20 shadow-inner">
            <Wallet size={20} />
          </div>
        </div>
      </div>
    </div>
  );
}

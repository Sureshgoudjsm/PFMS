import {
  TrendingUp,
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

interface Props {
  summary: DashboardSummary;
}

const cards = [
  {
    key: 'current_month_expenses' as const,
    label: 'This Month Expenses',
    icon: TrendingDown,
    color: 'text-rose-500',
    bg: 'bg-rose-500/10',
  },
  {
    key: 'total_bank_balance' as const,
    label: 'Bank Balance',
    icon: Landmark,
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
  },
  {
    key: 'cash_balance' as const,
    label: 'Cash Balance',
    icon: Banknote,
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
  },
  {
    key: 'credit_outstanding' as const,
    label: 'Credit Card Due',
    icon: CreditCard,
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
  },
  {
    key: 'money_lent' as const,
    label: 'Money Lent',
    icon: HandCoins,
    color: 'text-violet-500',
    bg: 'bg-violet-500/10',
  },
  {
    key: 'money_borrowed' as const,
    label: 'Money Borrowed',
    icon: Wallet,
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
  },
  {
    key: 'net_worth' as const,
    label: 'Net Worth',
    icon: PiggyBank,
    color: 'text-accent',
    bg: 'bg-accent/10',
    highlight: true,
  },
];

export default function SummaryCards({ summary }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {cards.map(({ key, label, icon: Icon, color, bg, highlight }) => (
        <div
          key={key}
          className={`card ${highlight ? 'ring-2 ring-accent/30 lg:col-span-1' : ''}`}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                {label}
              </p>
              <p className={`mt-2 text-2xl font-bold ${highlight ? 'text-accent' : ''}`}>
                {formatCurrency(summary[key])}
              </p>
            </div>
            <div className={`rounded-lg p-2.5 ${bg}`}>
              <Icon size={20} className={color} />
            </div>
          </div>
          {key === 'net_worth' && (
            <div className="mt-3 flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1">
                <TrendingUp size={12} className="text-emerald-500" />
                Assets {formatCurrency(summary.total_assets)}
              </span>
              <span className="flex items-center gap-1">
                <TrendingDown size={12} className="text-rose-500" />
                Liabilities {formatCurrency(summary.total_liabilities)}
              </span>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

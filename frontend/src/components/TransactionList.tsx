import { formatCurrency, formatDate } from '../utils/format';
import type { Transaction } from '../types';
import { ArrowLeftRight } from 'lucide-react';
import EmptyState from './EmptyState';

interface Props {
  transactions: Transaction[];
  title?: string;
  onSeedSample?: () => void;
  seeding?: boolean;
}

const typeColors: Record<string, string> = {
  Income: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400',
  Expense: 'border-rose-500/20 bg-rose-500/5 text-rose-400',
  Transfer: 'border-blue-500/20 bg-blue-500/5 text-blue-400',
  'Loan Given': 'border-violet-500/20 bg-violet-500/5 text-violet-400',
  'Loan Received': 'border-amber-500/20 bg-amber-500/5 text-amber-400',
  'Loan Repayment Received': 'border-teal-500/20 bg-teal-500/5 text-teal-400',
  'Loan Repayment Paid': 'border-orange-500/20 bg-orange-500/5 text-orange-400',
  'Credit Card Payment': 'border-indigo-500/20 bg-indigo-500/5 text-indigo-400',
};

export default function TransactionList({ transactions, title = 'Recent Transactions', onSeedSample, seeding }: Props) {
  if (transactions.length === 0) {
    return (
      <EmptyState
        icon={ArrowLeftRight}
        title="No transactions yet"
        description="Transactions you log will be tracked here in real-time."
        actionLabel={onSeedSample ? 'Try with Sample Data' : undefined}
        onAction={onSeedSample}
        loading={seeding}
      />
    );
  }

  return (
    <div className="card overflow-hidden p-0 border border-slate-800 bg-slate-900/40">
      <div className="border-b border-slate-800/80 px-5 py-4 bg-[#090e1b]/40">
        <h3 className="font-bold text-xs uppercase tracking-wider text-slate-300">{title}</h3>
      </div>
      <div className="divide-y divide-slate-800/80" role="table" aria-label="Transactions list">
        {transactions.map((txn) => (
          <div
            key={txn.id}
            role="row"
            className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-slate-800/20 transition-colors"
          >
            <div className="min-w-0 flex-1" role="cell">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
                    typeColors[txn.transaction_type] ?? 'border-slate-800 bg-slate-950/60 text-slate-400'
                  }`}
                >
                  {txn.transaction_type}
                </span>
                <span className="text-[10px] text-slate-500 font-semibold font-mono uppercase">{formatDate(txn.date)}</span>
              </div>
              <p className="mt-1.5 truncate text-sm text-slate-200 font-medium">{txn.description || '—'}</p>
              {txn.processing_fee && (
                <p className="mt-1 text-[10px] text-orange-400 font-medium font-mono">
                  + Fee {formatCurrency(txn.processing_fee.amount)}
                </p>
              )}
            </div>
            <p className="shrink-0 text-sm font-extrabold text-slate-100 font-mono" role="cell">
              {formatCurrency(txn.amount)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

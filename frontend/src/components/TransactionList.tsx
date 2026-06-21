import { formatCurrency, formatDate } from '../utils/format';
import type { Transaction } from '../types';

interface Props {
  transactions: Transaction[];
  title?: string;
}

const typeColors: Record<string, string> = {
  Income: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  Expense: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  Transfer: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  'Loan Given': 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
  'Loan Received': 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  'Loan Repayment Received': 'bg-teal-500/10 text-teal-600 dark:text-teal-400',
  'Loan Repayment Paid': 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
  'Credit Card Payment': 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
};

export default function TransactionList({ transactions, title = 'Recent Transactions' }: Props) {
  if (transactions.length === 0) {
    return (
      <div className="card">
        <h2 className="mb-4 text-lg font-semibold">{title}</h2>
        <p className="text-sm text-slate-500">No transactions yet.</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden p-0">
      <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="divide-y divide-slate-100 dark:divide-slate-700">
        {transactions.map((txn) => (
          <div
            key={txn.id}
            className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-slate-50 dark:hover:bg-surface-hover"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    typeColors[txn.transaction_type] ?? 'bg-slate-500/10 text-slate-600'
                  }`}
                >
                  {txn.transaction_type}
                </span>
                <span className="text-xs text-slate-500">{formatDate(txn.date)}</span>
              </div>
              <p className="mt-1 truncate text-sm">{txn.description || '—'}</p>
              {txn.processing_fee && (
                <p className="mt-0.5 text-xs text-orange-500">
                  + Fee {formatCurrency(txn.processing_fee.amount)}
                </p>
              )}
            </div>
            <p className="shrink-0 text-sm font-semibold">{formatCurrency(txn.amount)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { formatCurrency, formatDate } from '../utils/format';
import { Download, FileText, FileJson, Calendar } from 'lucide-react';
import type { Account } from '../types';

interface AuditSummary {
  total_transactions: number;
  date_range: { start: string; end: string } | null;
  breakdown_by_type: Record<string, number>;
}

interface RunningBalanceItem {
  transaction_id: number;
  date: string;
  description: string;
  amount: number;
  type: 'inflow' | 'outflow';
  running_balance: number;
}

export default function Audit() {
  const [audit, setAudit] = useState<AuditSummary | null>(null);
  const [runningBalances, setRunningBalances] = useState<Record<number, RunningBalanceItem[]>>({});
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exporting, setExporting] = useState<'json' | 'csv' | null>(null);

  useEffect(() => {
    Promise.all([api.getAudit(), api.getRunningBalances(), api.getAccounts()])
      .then(([auditData, runningData, accountsData]) => {
        setAudit(auditData);
        setRunningBalances(runningData);
        setAccounts(accountsData);
      })
      .catch((e: any) => setError(e.message || 'Failed to load audit data'))
      .finally(() => setLoading(false));
  }, []);

  async function handleExport(format: 'json' | 'csv') {
    setExporting(format);
    try {
      const data = await api.exportData(format, startDate || undefined, endDate || undefined);
      if (format === 'csv' && typeof data === 'string') {
        const blob = new Blob([data], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pfms_export.csv`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pfms_export.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e: any) {
      setError(e.message || `Failed to export ${format}`);
    } finally {
      setExporting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-300">
        Failed to load audit data: {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Audit &amp; Export</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Review your transaction audit trail, per-account running balances, and export data
        </p>
      </div>

      {/* Audit Summary */}
      {audit && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="card">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Total Transactions
            </p>
            <p className="mt-1 text-2xl font-bold">{audit.total_transactions}</p>
          </div>

          <div className="card">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Date Range
            </p>
            {audit.date_range ? (
              <p className="mt-1 text-sm font-semibold">
                {formatDate(audit.date_range.start)} — {formatDate(audit.date_range.end)}
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-500">No data</p>
            )}
          </div>

          <div className="card">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Transaction Types
            </p>
            <p className="mt-1 text-2xl font-bold">
              {audit.breakdown_by_type ? Object.keys(audit.breakdown_by_type).length : 0}
            </p>
          </div>
        </div>
      )}

      {/* Per-Account Running Balances */}
      <div className="space-y-6">
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100">Per-Account Running Balances</h3>
        {accounts.map((acc) => {
          const items = runningBalances[acc.id] || [];
          return (
            <div key={acc.id} className="card space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
                <div>
                  <h4 className="font-semibold text-slate-800 dark:text-slate-100">{acc.account_name}</h4>
                  <p className="text-xs text-slate-500">{acc.account_type}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-400">Current Balance</p>
                  <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{formatCurrency(acc.current_balance)}</p>
                </div>
              </div>

              {items.length === 0 ? (
                <p className="text-sm text-slate-500 py-2">No transactions recorded for this account.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    <thead>
                      <tr className="text-left text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider">
                        <th className="py-2 pr-4">Date</th>
                        <th className="py-2 px-4">Description</th>
                        <th className="py-2 px-4 text-right">Amount</th>
                        <th className="py-2 pl-4 text-right">Running Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {items.map((item, idx) => (
                        <tr key={`${item.transaction_id}-${idx}`} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                          <td className="py-2 pr-4 whitespace-nowrap text-slate-500">{formatDate(item.date)}</td>
                          <td className="py-2 px-4 max-w-xs truncate text-slate-700 dark:text-slate-300" title={item.description}>
                            {item.description}
                          </td>
                          <td className={`py-2 px-4 text-right font-medium whitespace-nowrap ${
                            item.type === 'inflow' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500'
                          }`}>
                            {item.type === 'inflow' ? '+' : '-'}{formatCurrency(item.amount)}
                          </td>
                          <td className="py-2 pl-4 text-right font-semibold tabular-nums text-slate-800 dark:text-slate-200">
                            {formatCurrency(item.running_balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Export Section */}
      <div className="card">
        <h3 className="text-base font-semibold border-b border-slate-200 dark:border-slate-700 pb-3 mb-4">
          Export Data
        </h3>

        {/* Date Range Filter */}
        <div className="flex flex-wrap items-end gap-4 mb-4">
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Calendar size={12} />
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Calendar size={12} />
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>
        </div>

        {/* Export Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => handleExport('json')}
            disabled={exporting !== null}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition disabled:opacity-50"
          >
            <FileJson size={16} />
            {exporting === 'json' ? 'Exporting...' : 'Export JSON'}
          </button>
          <button
            onClick={() => handleExport('csv')}
            disabled={exporting !== null}
            className="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-semibold hover:bg-slate-100 dark:hover:bg-slate-800 transition disabled:opacity-50"
          >
            <FileText size={16} />
            {exporting === 'csv' ? 'Exporting...' : 'Export CSV'}
          </button>
        </div>
      </div>
    </div>
  );
}

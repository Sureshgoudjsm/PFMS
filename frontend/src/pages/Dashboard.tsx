import { useEffect, useState } from 'react';
import { api } from '../api/client';
import SummaryCards from '../components/SummaryCards';
import TrendChart from '../components/TrendChart';
import TransactionList from '../components/TransactionList';
import type { DashboardData } from '../types';

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getDashboard()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

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
        Failed to load dashboard: {error}. Make sure the backend is running on port 8000.
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Dashboard</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Your financial snapshot at a glance
        </p>
      </div>

      <SummaryCards summary={data.summary} />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <TrendChart data={data.trend} />
        </div>
        <div className="lg:col-span-2">
          <TransactionList transactions={data.recent_transactions} />
        </div>
      </div>
    </div>
  );
}

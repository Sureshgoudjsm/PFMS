import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import type { TrendPoint } from '../types';
import { formatCurrency } from '../utils/format';

interface Props {
  data: TrendPoint[];
}

export default function TrendChart({ data }: Props) {
  return (
    <div className="card">
      <h2 className="mb-4 text-lg font-semibold">6-Month Trend</h2>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-700" />
            <XAxis dataKey="month" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{
                backgroundColor: 'var(--tooltip-bg, #1e293b)',
                border: 'none',
                borderRadius: '8px',
                color: '#f1f5f9',
              }}
            />
            <Legend />
            <Area
              type="monotone"
              dataKey="income"
              stroke="#10b981"
              fill="url(#incomeGrad)"
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="expenses"
              stroke="#f43f5e"
              fill="url(#expenseGrad)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

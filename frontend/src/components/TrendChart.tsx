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
import { TrendingUp } from 'lucide-react';

interface Props {
  data: TrendPoint[];
}

export default function TrendChart({ data }: Props) {
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-xl bg-slate-950/95 p-3.5 text-xs text-slate-200 shadow-2xl border border-slate-800 leading-normal">
          <p className="font-bold text-slate-400 mb-1.5">{label}</p>
          <p className="font-semibold text-emerald-400">Income: {formatCurrency(payload[0].value)}</p>
          <p className="font-semibold text-rose-400 mt-0.5">Expenses: {formatCurrency(payload[1].value)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="card border border-slate-800 bg-slate-900/40">
      <div className="flex items-center gap-1.5 mb-4">
        <TrendingUp size={16} className="text-purple-400" />
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">Financial Trends (6-Month)</h3>
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#34d399" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" opacity={0.1} stroke="#cbd5e1" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'monospace' }}
              stroke="#475569"
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'monospace' }}
              tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`}
              stroke="#475569"
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              height={36}
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 600 }}
            />
            <Area
              type="monotone"
              dataKey="income"
              stroke="#34d399"
              fill="url(#incomeGrad)"
              strokeWidth={2.5}
              name="Income"
            />
            <Area
              type="monotone"
              dataKey="expenses"
              stroke="#ef4444"
              fill="url(#expenseGrad)"
              strokeWidth={2.5}
              name="Expenses"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

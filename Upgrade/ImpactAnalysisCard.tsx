import React from "react";
import { motion } from "framer-motion";
import type { ImpactAnalysis } from "./types";

export interface ImpactAnalysisCardProps {
  impact: ImpactAnalysis;
}

const inr = (n: number) =>
  `₹${Math.abs(Math.round(n)).toLocaleString("en-IN")}`;

export const ImpactAnalysisCard: React.FC<ImpactAnalysisCardProps> = ({
  impact,
}) => {
  const budgetPct = Math.min(
    100,
    Math.round((impact.budgetSpent / impact.budgetTotal) * 100)
  );
  const budgetTone =
    budgetPct >= 90 ? "bg-rose-400" : budgetPct >= 70 ? "bg-amber-400" : "bg-emerald-400";
  const positive = impact.netWorthDelta >= 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: 0.5 }}
      className="mt-3 rounded-xl border border-slate-800 bg-slate-950/60 p-3"
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
        Impact Analysis
      </p>

      <div className="mt-2 flex items-center justify-between text-[12.5px]">
        <span className="text-slate-400">Cash Balance</span>
        <span className="font-mono text-slate-200">
          {inr(impact.cashBefore)}{" "}
          <span className="text-slate-500">→</span>{" "}
          <span
            className={
              impact.cashAfter >= impact.cashBefore
                ? "text-emerald-400"
                : "text-rose-400"
            }
          >
            {inr(impact.cashAfter)}
          </span>
        </span>
      </div>

      <div className="mt-2.5">
        <div className="flex items-center justify-between text-[12.5px]">
          <span className="text-slate-400">Monthly Budget</span>
          <span className="font-mono text-slate-300">
            {inr(impact.budgetSpent)} / {inr(impact.budgetTotal)}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
          <motion.div
            className={`h-full rounded-full ${budgetTone}`}
            initial={{ width: 0 }}
            animate={{ width: `${budgetPct}%` }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
          />
        </div>
      </div>

      <div className="mt-2.5 flex items-center justify-between text-[12.5px]">
        <span className="text-slate-400">Net Worth Change</span>
        <span
          className={`font-mono font-medium ${
            positive ? "text-emerald-400" : "text-rose-400"
          }`}
        >
          {positive ? "+" : "-"}
          {inr(impact.netWorthDelta)}
        </span>
      </div>
    </motion.div>
  );
};

export default ImpactAnalysisCard;

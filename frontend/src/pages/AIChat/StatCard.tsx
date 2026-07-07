import React from "react";
import { motion } from "framer-motion";

export interface StatCardProps {
  label: string;
  value: string;
  trend?: "up" | "down" | "flat";
  tone?: "default" | "success" | "warning" | "error";
}

const toneText: Record<NonNullable<StatCardProps["tone"]>, string> = {
  default: "text-slate-100",
  success: "text-emerald-400",
  warning: "text-amber-400",
  error: "text-rose-400",
};

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  trend,
  tone = "default",
}) => {
  return (
    <motion.div
      className="rounded-xl border border-slate-700/40 bg-slate-800/60 p-2.5 px-3.5 backdrop-blur-md"
      whileHover={{ y: -4, borderColor: "rgba(99,102,241,0.5)" }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
    >
      <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">{label}</p>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`text-base font-semibold ${toneText[tone]}`}>
          {value}
        </span>
        {trend && trend !== "flat" && (
          <span
            className={
              trend === "up" ? "text-emerald-400 text-xs" : "text-rose-400 text-xs"
            }
          >
            {trend === "up" ? "↗" : "↘"}
          </span>
        )}
      </div>
    </motion.div>
  );
};

export default StatCard;

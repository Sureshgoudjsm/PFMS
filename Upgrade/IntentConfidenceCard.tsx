import React from "react";
import { motion } from "framer-motion";
import type { Intent } from "./types";
import { intentColor } from "./types";

export interface IntentConfidenceCardProps {
  intent: Intent;
  confidence: number; // 0-1
}

export const IntentConfidenceCard: React.FC<IntentConfidenceCardProps> = ({
  intent,
  confidence,
}) => {
  const pct = Math.round(confidence * 100);
  const barTone =
    pct >= 85
      ? "bg-emerald-400"
      : pct >= 60
      ? "bg-amber-400"
      : "bg-rose-400";

  return (
    <div className="mt-3 flex items-center justify-between gap-4 rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="text-[11px] text-slate-500">Intent</span>
        <span
          className={`rounded-md border px-2 py-0.5 font-mono text-[11px] font-medium ${intentColor[intent]}`}
        >
          {intent}
        </span>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2">
        <span className="text-[11px] text-slate-500">Confidence</span>
        <div className="relative h-1.5 w-20 overflow-hidden rounded-full bg-slate-800">
          <motion.div
            className={`h-full rounded-full ${barTone}`}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.1 }}
          />
        </div>
        <span className="font-mono text-[11px] font-medium text-slate-300">
          {pct}%
        </span>
      </div>
    </div>
  );
};

export default IntentConfidenceCard;

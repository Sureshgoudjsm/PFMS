import React from "react";
import { motion } from "framer-motion";
import type { ExecutionRecord } from "./types";

export interface DatabaseExecutionCardProps {
  record: ExecutionRecord;
}

/**
 * Unfolds via a clip-path wipe once the parent bubble has settled,
 * then reveals fields one by one. Neon-cyan glow per spec:
 * 0 0 10px / 20px / 40px rgba(34,211,238, .4/.2/.1)
 */
export const DatabaseExecutionCard: React.FC<DatabaseExecutionCardProps> = ({
  record,
}) => {
  return (
    <motion.div
      initial={{ clipPath: "inset(0 0 100% 0)", opacity: 0 }}
      animate={{ clipPath: "inset(0 0 0% 0)", opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.18 }}
      whileHover={{ y: -2 }}
      className="relative mt-3 overflow-hidden rounded-xl border border-cyan-400/40 bg-slate-950/80 p-3"
      style={{
        boxShadow:
          "0 0 10px rgba(34,211,238,0.4), 0 0 20px rgba(34,211,238,0.2), 0 0 40px rgba(34,211,238,0.1)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-2.5 py-0.5 font-mono text-[11px] font-medium tracking-wide text-cyan-300">
          [{record.status}]
        </span>
        <span
          className={`font-mono text-[10px] uppercase tracking-wider ${
            record.executed ? "text-emerald-400" : "text-amber-400"
          }`}
        >
          {record.executed ? "● committed" : "● dry-run"}
        </span>
      </div>

      <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 font-mono text-[12.5px]">
        {record.fields.map((f, i) => (
          <motion.div
            key={f.label}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.32 + i * 0.05 }}
            className="contents"
          >
            <dt className="text-slate-500">{f.label}</dt>
            <dd className="truncate text-right text-slate-200">{f.value}</dd>
          </motion.div>
        ))}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.32 + record.fields.length * 0.05 }}
          className="contents"
        >
          <dt className="text-slate-500">Record ID</dt>
          <dd className="truncate text-right text-cyan-300">{record.recordId}</dd>
        </motion.div>
      </dl>
    </motion.div>
  );
};

export default DatabaseExecutionCard;

import React from "react";
import { motion } from "framer-motion";

export const ThinkingIndicator: React.FC = () => {
  return (
    <div className="flex w-full justify-start">
      <div className="flex items-center gap-2 rounded-2xl rounded-tl-md border border-slate-800 bg-slate-900 px-4 py-3">
        <span className="text-[13px] text-slate-400">Thinking</span>
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-indigo-400"
              animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
              transition={{
                duration: 1.1,
                repeat: Infinity,
                delay: i * 0.18,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ThinkingIndicator;

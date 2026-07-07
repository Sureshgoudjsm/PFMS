import React from "react";
import { motion } from "framer-motion";

export interface SuggestedActionsProps {
  actions: string[];
  onSelect: (action: string) => void;
}

export const SuggestedActions: React.FC<SuggestedActionsProps> = ({
  actions,
  onSelect,
}) => {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
      {actions.map((action, i) => (
        <motion.button
          key={action}
          onClick={() => onSelect(action)}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: i * 0.04 }}
          whileHover={{
            y: -2,
            borderColor: "rgba(99,102,241,0.6)",
            boxShadow: "0 0 14px rgba(99,102,241,0.25)",
          }}
          whileTap={{ scale: 0.97 }}
          className="shrink-0 whitespace-nowrap rounded-full border border-slate-700/60 bg-slate-800/60 px-3.5 py-1.5 text-[13px] text-slate-300 backdrop-blur-md transition-colors hover:text-white"
        >
          {action}
        </motion.button>
      ))}
    </div>
  );
};

export default SuggestedActions;

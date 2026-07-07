import React from "react";
import { motion } from "framer-motion";
import {
  Receipt,
  HandCoins,
  CalendarClock,
  FileBarChart,
  PieChart,
} from "lucide-react";
import { AICoreOrb } from "./AICoreOrb";

export interface EmptyStateProps {
  onQuickAction: (prompt: string) => void;
}

const quickActions = [
  { label: "Track Expense", icon: Receipt, prompt: "I spent [amount] on [category]" },
  { label: "Record Loan", icon: HandCoins, prompt: "Lent [amount] to [person]" },
  { label: "Create EMI", icon: CalendarClock, prompt: "Add a monthly EMI of [amount] for [name] due on [day]" },
  { label: "Generate Report", icon: FileBarChart, prompt: "Generate my monthly report" },
  { label: "View Financial Summary", icon: PieChart, prompt: "Summarize my finances" },
];

export const EmptyState: React.FC<EmptyStateProps> = ({ onQuickAction }) => {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 px-6 text-center">
      <AICoreOrb size={88} />
      <div>
        <h3 className="text-lg font-medium text-slate-100">
          What would you like to do today?
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Tell me in plain English — I&apos;ll record it directly to your database.
        </p>
      </div>

      <div className="grid w-full max-w-md grid-cols-2 gap-2.5">
        {quickActions.map((qa, i) => (
          <motion.button
            key={qa.label}
            onClick={() => onQuickAction(qa.prompt)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: i * 0.06 }}
            whileHover={{ y: -3, borderColor: "rgba(99,102,241,0.5)" }}
            className={`flex flex-col items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-4 text-left backdrop-blur-md ${
              i === quickActions.length - 1 ? "col-span-2" : ""
            }`}
          >
            <qa.icon className="h-4.5 w-4.5 text-indigo-400" />
            <span className="text-[13px] text-slate-300">{qa.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default EmptyState;

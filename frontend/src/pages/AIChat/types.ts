export type Intent =
  | "CREATE_EXPENSE"
  | "CREATE_INCOME"
  | "CREATE_LOAN"
  | "CREATE_EMI"
  | "CREATE_ACCOUNT"
  | "UPDATE_TRANSACTION"
  | "UNKNOWN";

export type RecordStatus =
  | "EXPENSE SAVED"
  | "INCOME SAVED"
  | "LOAN REGISTERED"
  | "EMI SCHEDULED"
  | "ACCOUNT CREATED"
  | "TRANSACTION UPDATED";

export interface ExecutionRecord {
  status: RecordStatus;
  executed: boolean;
  recordId: string;
  fields: { label: string; value: string }[];
}

export interface ImpactAnalysis {
  cashBefore: number;
  cashAfter: number;
  budgetSpent: number;
  budgetTotal: number;
  netWorthDelta: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  intent?: Intent;
  confidence?: number;
  record?: ExecutionRecord;
  impact?: ImpactAnalysis;
  undone?: boolean;
  retryText?: string;
  preview?: {
    previewId: string;
    intent: string;
    intentData: Record<string, any>;
    originalText: string;
    status: "pending" | "confirmed" | "cancelled";
  };
  /** True when the reply comes from /api/query (read-only data lookup). Renders with 📊 tint. */
  isQueryAnswer?: boolean;
}

export interface FinancialStats {
  netWorth: number;
  cashReserve: number;
  loansGiven: number;
  creditOutstanding: number;
}

export const intentColor: Record<Intent, string> = {
  CREATE_EXPENSE: "text-rose-300 bg-rose-400/10 border-rose-400/30",
  CREATE_INCOME: "text-emerald-300 bg-emerald-400/10 border-emerald-400/30",
  CREATE_LOAN: "text-purple-300 bg-purple-400/10 border-purple-400/30",
  CREATE_EMI: "text-amber-300 bg-amber-400/10 border-amber-400/30",
  CREATE_ACCOUNT: "text-indigo-300 bg-indigo-400/10 border-indigo-400/30",
  UPDATE_TRANSACTION: "text-cyan-300 bg-cyan-400/10 border-cyan-400/30",
  UNKNOWN: "text-slate-400 bg-slate-400/10 border-slate-400/30",
};

export const formatINR = (n: number) =>
  `₹${Math.abs(n).toLocaleString("en-IN", { maximumFractionDigits: 0 })}${
    n < 0 ? "" : ""
  }`;

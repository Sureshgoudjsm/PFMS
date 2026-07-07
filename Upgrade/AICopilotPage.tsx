import React, { useMemo, useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, RefreshCw, SendHorizonal } from "lucide-react";
import { AICoreOrb } from "./AICoreOrb";
import { StatCard } from "./StatCard";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { SuggestedActions } from "./SuggestedActions";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { EmptyState } from "./EmptyState";
import type { ChatMessage, FinancialStats } from "./types";

const initialStats: FinancialStats = {
  netWorth: 86400,
  cashReserve: -7604,
  loansGiven: 15804,
  creditOutstanding: 0,
};

const initialNarrative =
  "You're in a healthy financial position overall, with a positive net worth of ₹86,400 and strong bank liquidity. Credit card outstanding is at zero, but cash reserve is running negative — keep an eye on your upcoming ₹8,500 gold loan EMI due on the 10th.";

const suggestedActions = [
  "Split Expense",
  "Add GST",
  "Mark Business Expense",
  "Create EMI",
  "Monthly Report",
];

let recordCounter = 42;

function buildAssistantReply(userText: string): ChatMessage {
  const lower = userText.toLowerCase();
  const amountMatch = userText.match(/(\d+(\.\d+)?)/);
  const amount = amountMatch ? parseFloat(amountMatch[1]) : 450;

  if (lower.includes("lent") || lower.includes("loan")) {
    recordCounter += 1;
    return {
      id: crypto.randomUUID(),
      role: "assistant",
      text: `Got it — I've registered a loan of ₹${amount.toLocaleString(
        "en-IN"
      )}.`,
      timestamp: timeNow(),
      intent: "CREATE_LOAN",
      confidence: 0.94,
      record: {
        status: "LOAN REGISTERED",
        executed: true,
        recordId: `LOAN-${String(recordCounter).padStart(4, "0")}`,
        fields: [
          { label: "Amount", value: `₹${amount.toLocaleString("en-IN")}` },
          { label: "Person", value: "Sunny" },
          { label: "Type", value: "Lent" },
          { label: "Date", value: "22 Jun 2026" },
        ],
      },
      impact: {
        cashBefore: 78000,
        cashAfter: 78000 - amount,
        budgetSpent: 4200,
        budgetTotal: 8000,
        netWorthDelta: 0,
      },
    };
  }

  if (lower.includes("emi")) {
    recordCounter += 1;
    return {
      id: crypto.randomUUID(),
      role: "assistant",
      text: "I've scheduled a new EMI for you.",
      timestamp: timeNow(),
      intent: "CREATE_EMI",
      confidence: 0.91,
      record: {
        status: "EMI SCHEDULED",
        executed: true,
        recordId: `EMI-${String(recordCounter).padStart(4, "0")}`,
        fields: [
          { label: "Amount", value: `₹${amount.toLocaleString("en-IN")}` },
          { label: "Frequency", value: "Monthly" },
          { label: "Next Due", value: "10 Jul 2026" },
          { label: "Category", value: "Gold Loan" },
        ],
      },
    };
  }

  recordCounter += 1;
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    text: `I've recorded an expense of ₹${amount.toLocaleString(
      "en-IN"
    )} for Food & Dining.`,
    timestamp: timeNow(),
    intent: "CREATE_EXPENSE",
    confidence: 0.95,
    record: {
      status: "EXPENSE SAVED",
      executed: true,
      recordId: `EXP-${String(recordCounter).padStart(4, "0")}`,
      fields: [
        { label: "Amount", value: `₹${amount.toLocaleString("en-IN")}` },
        { label: "Category", value: "Food & Dining" },
        { label: "Person", value: "Self" },
        { label: "Date", value: "22 Jun 2026" },
      ],
    },
    impact: {
      cashBefore: 78000,
      cashAfter: 78000 - amount,
      budgetSpent: 4200 + amount,
      budgetTotal: 8000,
      netWorthDelta: -amount,
    },
  };
}

function timeNow() {
  return new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const AICopilotPage: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [stats] = useState(initialStats);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, thinking]);

  const orbState = useMemo(() => (thinking ? "processing" : "idle"), [thinking]);

  const send = (text: string) => {
    if (!text.trim()) return;
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text,
      timestamp: timeNow(),
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setThinking(true);

    setTimeout(() => {
      setThinking(false);
      setMessages((m) => [...m, buildAssistantReply(text)]);
    }, 900);
  };

  return (
    <div className="grid h-[calc(100vh-72px)] grid-cols-1 gap-4 bg-[#020617] p-4 text-slate-100 md:grid-cols-[minmax(280px,30%)_1fr]">
      {/* LEFT PANEL */}
      <div className="flex min-h-0 flex-col gap-4 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-indigo-400" />
            <h2 className="text-sm font-semibold text-slate-100">
              AI Financial Narrative
            </h2>
          </div>
          <button className="rounded-md p-1 text-slate-500 transition-colors hover:text-indigo-400">
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        <div className="flex justify-center py-2">
          <AICoreOrb state={orbState} size={84} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard
            label="Net Worth"
            value={`₹${stats.netWorth.toLocaleString("en-IN")}`}
            tone="success"
          />
          <StatCard
            label="Cash Reserve"
            value={`${stats.cashReserve < 0 ? "-" : ""}₹${Math.abs(
              stats.cashReserve
            ).toLocaleString("en-IN")}`}
            tone={stats.cashReserve < 0 ? "error" : "default"}
          />
          <StatCard
            label="Loans Given"
            value={`₹${stats.loansGiven.toLocaleString("en-IN")}`}
            trend="up"
          />
          <StatCard
            label="Credit Outstanding"
            value={`₹${stats.creditOutstanding.toLocaleString("en-IN")}`}
            tone="success"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/50 p-4 text-[13.5px] leading-relaxed text-slate-300">
          {initialNarrative}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex min-h-0 flex-col rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-md">
        <div
          ref={scrollRef}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5"
        >
          {messages.length === 0 ? (
            <EmptyState onQuickAction={send} />
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <ChatMessageBubble key={m.id} message={m} index={i} />
              ))}
            </AnimatePresence>
          )}
          {thinking && <ThinkingIndicator />}
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-800 p-4">
          <SuggestedActions actions={suggestedActions} onSelect={send} />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-800/60 px-3 py-2 backdrop-blur-md focus-within:border-indigo-500/60"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="E.g., I spent 600 on lunch at Starbucks today..."
              className="flex-1 bg-transparent text-[14px] text-slate-100 placeholder-slate-500 outline-none"
            />
            <motion.button
              type="submit"
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-white shadow-[0_0_14px_rgba(99,102,241,0.5)] disabled:opacity-40"
              disabled={!input.trim()}
            >
              <SendHorizonal className="h-4 w-4" />
            </motion.button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AICopilotPage;

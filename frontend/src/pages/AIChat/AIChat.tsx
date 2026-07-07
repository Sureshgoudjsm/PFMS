import React, { useMemo, useRef, useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, RefreshCw, SendHorizonal } from "lucide-react";
import { AICoreOrb } from "./AICoreOrb";
import { StatCard } from "./StatCard";
import { ChatMessageBubble } from "./ChatMessageBubble";
import { SuggestedActions } from "./SuggestedActions";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { EmptyState } from "./EmptyState";
import type { ChatMessage, FinancialStats, RecordStatus, ExecutionRecord, ImpactAnalysis } from "./types";
import { api } from "../../api/client";

// Transaction chips (execute writes via /ai/chat)
const transactionActions = [
  "I spent 500 on groceries today",
  "Lent Sunny 5000",
  "Sunny paid back 1500",
  "Summarize my finances",
];

// Query chips (read-only lookups via /api/query)
const queryChips = [
  "What did I spend on Food this month?",
  "What's my net position with Ravi?",
  "When is my next EMI due?",
  "How much did I earn vs spend this month?",
  "What's my average monthly spend on Transport?",
  "Show me my last 5 transactions with Sunny",
];

const suggestedActions = [...transactionActions, ...queryChips];

// Detect query-style chip questions (sent via /api/query)
function isQueryChip(text: string): boolean {
  return queryChips.includes(text);
}

// Detect read-only finance questions by phrase patterns
function looksLikeDataQuery(text: string): boolean {
  const lower = text.toLowerCase().trim();
  const queryPatterns = [
    /^what did i spend/,
    /^how much did i/,
    /^what.?s my (net position|average|avg)/,
    /^when is my next emi/,
    /^show me my (last|recent)/,
    /^what.?s my.*(spend|budget|average)/,
    /^upcoming emis/,
    /^what.?s my position with/,
    /does .+ owe me/,
  ];
  return queryPatterns.some((re) => re.test(lower));
}

function timeNow() {
  return new Date().toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getRecordStatus(intent: string): RecordStatus {
  if (intent === "CREATE_EXPENSE") return "EXPENSE SAVED";
  if (intent === "CREATE_INCOME") return "INCOME SAVED";
  if (intent === "CREATE_LOAN") return "LOAN REGISTERED";
  if (intent === "CREATE_EMI") return "EMI SCHEDULED";
  if (intent === "CREATE_CREDIT_CARD" || intent === "CREATE_GOLD_LOAN") return "ACCOUNT CREATED";
  return "TRANSACTION UPDATED";
}

function buildRecordFields(created: any): { label: string; value: string }[] {
  const fields: { label: string; value: string }[] = [];
  if (created.amount !== undefined) {
    fields.push({ label: "Amount", value: `₹${created.amount.toLocaleString("en-IN")}` });
  }
  if (created.category) {
    fields.push({ label: "Category", value: created.category });
  }
  if (created.person) {
    fields.push({ label: "Person", value: created.person });
  }
  if (created.name) {
    fields.push({ label: "Name", value: created.name });
  }
  if (created.limit !== undefined) {
    fields.push({ label: "Limit", value: `₹${created.limit.toLocaleString("en-IN")}` });
  }
  if (created.outstanding !== undefined) {
    fields.push({ label: "Outstanding", value: `₹${created.outstanding.toLocaleString("en-IN")}` });
  }
  if (created.due_day !== undefined) {
    fields.push({ label: "Due Day", value: `Day ${created.due_day}` });
  }
  if (created.date) {
    fields.push({ label: "Date", value: created.date });
  }
  return fields;
}

function buildImpactAnalysis(intent: string, created: any, executed: boolean, currentStats: FinancialStats): ImpactAnalysis | undefined {
  if (!executed || !created) return undefined;
  
  const amount = created.amount || 0;
  const cashBefore = currentStats.cashReserve;
  let cashAfter = cashBefore;
  let netWorthDelta = 0;
  
  if (intent === "CREATE_EXPENSE") {
    cashAfter = cashBefore - amount;
    netWorthDelta = -amount;
  } else if (intent === "CREATE_INCOME") {
    cashAfter = cashBefore + amount;
    netWorthDelta = amount;
  } else if (intent === "CREATE_LOAN" && created.type === "Loan Given") {
    cashAfter = cashBefore - amount;
  } else if (intent === "CREATE_PAYMENT" && created.type === "Loan Repayment Received") {
    cashAfter = cashBefore + amount;
  } else if (intent === "CREATE_PAYMENT" && created.type === "Loan Repayment Paid") {
    cashAfter = cashBefore - amount;
  }
  
  return {
    cashBefore,
    cashAfter,
    budgetSpent: 4200 + (intent === "CREATE_EXPENSE" ? amount : 0),
    budgetTotal: 15000,
    netWorthDelta
  };
}

export const AIChat: React.FC = () => {
  const location = useLocation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [stats, setStats] = useState<FinancialStats>({
    netWorth: 0,
    cashReserve: 0,
    loansGiven: 0,
    creditOutstanding: 0,
  });
  const [narrative, setNarrative] = useState("Click the refresh icon in the top right to generate your AI financial narrative summary.");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [orbState, setOrbState] = useState<"idle" | "processing" | "error">("idle");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Undo Toast State
  const [undoToast, setUndoToast] = useState<{
    visible: boolean;
    transactionId: number;
    secondsLeft: number;
    messageId: string;
  } | null>(null);

  // Load summary and statistics from backend
  const fetchSummary = async (generateNarrative = false) => {
    if (generateNarrative) {
      setSummaryLoading(true);
    }
    try {
      const res = await api.aiSummary(generateNarrative);
      setStats({
        netWorth: res.stats.net_worth,
        cashReserve: res.stats.cash_balance,
        loansGiven: res.stats.money_lent,
        creditOutstanding: res.stats.credit_outstanding,
      });
      if (generateNarrative && res.summary) {
        setNarrative(res.summary);
      }
    } catch (err) {
      console.error("Error loading summary:", err);
      if (generateNarrative) {
        setNarrative("Summary unavailable (Gemini key not configured or backend unreachable).");
      }
    } finally {
      if (generateNarrative) {
        setSummaryLoading(false);
      }
    }
  };

  useEffect(() => {
    fetchSummary(false);
    if (location.state?.query) {
      send(location.state.query);
    }
  }, []);

  // Undo countdown timer
  useEffect(() => {
    if (!undoToast || !undoToast.visible) return;
    if (undoToast.secondsLeft <= 0) {
      setUndoToast(null);
      return;
    }
    const timer = setTimeout(() => {
      setUndoToast((prev) =>
        prev ? { ...prev, secondsLeft: prev.secondsLeft - 1 } : null
      );
    }, 1000);
    return () => clearTimeout(timer);
  }, [undoToast]);

  const handleUndoTrigger = async () => {
    if (!undoToast) return;
    const { transactionId, messageId } = undoToast;
    setUndoToast(null);
    try {
      const res = await api.aiUndo(transactionId);
      if (res.success) {
        setMessages((prev) => {
          const index = prev.findIndex((m) => m.id === messageId);
          if (index === -1) return prev;
          return prev.map((m, idx) => {
            if (m.id === messageId || idx === index - 1) {
              return { ...m, undone: true };
            }
            return m;
          });
        });
        fetchSummary(false);
      } else {
        alert(res.reason || "Undo window has expired.");
      }
    } catch (err: any) {
      console.error("Failed to undo transaction:", err);
      alert(`This transaction can no longer be undone automatically: ${err.message}`);
    }
  };

  const handleConfirm = async (messageId: string, previewId: string, intent: string, finalData: any) => {
    try {
      const res = await api.aiConfirm(previewId, intent, finalData, true);
      if (res.status === "success" && res.transaction_id !== undefined) {
        const record: ExecutionRecord | undefined = {
          status: getRecordStatus(intent),
          executed: true,
          recordId: `${intent.substring(7, 10).toUpperCase()}-${String(res.transaction_id).padStart(4, "0")}`,
          fields: buildRecordFields(finalData)
        };

        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  preview: m.preview ? { ...m.preview, status: "confirmed" as const } : undefined,
                  text: `Recorded ${intent.replace("CREATE_", "").toLowerCase().replace("_", " ")}: ₹${finalData.amount}`,
                  record,
                  impact: buildImpactAnalysis(intent, finalData, true, stats)
                }
              : m
          )
        );

        setUndoToast({
          visible: true,
          transactionId: res.transaction_id!,
          secondsLeft: 10,
          messageId,
        });
        fetchSummary(false);
      }
    } catch (err: any) {
      console.error("Confirmation error:", err);
      throw err;
    }
  };

  const handleCancel = async (messageId: string, previewId: string, intent: string) => {
    try {
      await api.aiConfirm(previewId, intent, {}, false);
    } catch (e) {
      console.error(e);
    }
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              preview: m.preview ? { ...m.preview, status: "cancelled" as const } : undefined,
              text: "Draft cancelled.",
            }
          : m
      )
    );
  };

  const handleRetry = (text: string) => {
    setInput(text);
    setTimeout(() => {
      const inputEl = document.querySelector("input[placeholder*='Starbucks']") as HTMLInputElement;
      if (inputEl) {
        inputEl.focus();
      }
    }, 50);
  };

  const isGreetingOrSummary = (text: string): boolean => {
    const clean = text.toLowerCase().trim();
    const hasNumber = /\d/.test(clean);
    const transactionVerbs = ["spent", "paid", "lent", "borrowed", "create", "add", "record", "buy", "bought", "spend"];
    const hasTxnVerb = transactionVerbs.some((verb) => clean.includes(verb));

    const greetings = ["hi", "hello", "hey", "help", "who are you", "what can you do", "hola", "greetings", "good morning", "good afternoon", "good evening"];
    const summaries = ["summarize", "summary", "report", "narrative", "portfolio", "overview", "finances", "status"];

    const matchesGreeting = greetings.some((g) => clean === g || clean.startsWith(g + " "));
    const matchesSummary = summaries.some((s) => clean.includes(s)) && !hasNumber && !hasTxnVerb;

    return matchesGreeting || matchesSummary;
  };

  const send = async (text: string) => {
    if (!text.trim() || thinking) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text,
      timestamp: timeNow(),
    };

    setMessages((m) => [...m, userMsg]);
    setInput("");
    setThinking(true);
    setOrbState("processing");

    // ── Route to /api/query for read-only data lookups ─────────────────
    if (isQueryChip(text) || looksLikeDataQuery(text)) {
      try {
        const res = await api.sendQuery(text);
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: res.answer,
          timestamp: timeNow(),
          intent: "QUERY" as any,
          confidence: 1.0,
          isQueryAnswer: true,
        };
        setMessages((m) => [...m, assistantMsg]);
        setOrbState("idle");
      } catch (err: any) {
        setOrbState("error");
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "assistant" as const,
            text: `Sorry, I couldn't look that up: ${err.message || "Unknown error"}`,
            timestamp: timeNow(),
          },
        ]);
      } finally {
        setThinking(false);
      }
      return;
    }

    if (isGreetingOrSummary(text)) {
      try {
        const res = await api.aiChat(text);
        const record: ExecutionRecord | undefined = res.created
          ? {
              status: getRecordStatus(res.intent),
              executed: res.executed,
              recordId: `${res.intent.substring(7, 10).toUpperCase()}-${String(
                res.created.id
              ).padStart(4, "0")}`,
              fields: buildRecordFields(res.created),
            }
          : undefined;

        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: res.reply,
          timestamp: timeNow(),
          intent: res.intent as any,
          confidence: res.confidence,
          record,
          impact: buildImpactAnalysis(res.intent, res.created, res.executed, stats),
        };

        setMessages((m) => [...m, assistantMsg]);
        setOrbState("idle");
        if (res.executed) {
          fetchSummary(false);
        }
      } catch (err: any) {
        setOrbState("error");
        const errorMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          text: `Sorry, I encountered an error: ${err.message || "Unknown error"}`,
          timestamp: timeNow(),
        };
        setMessages((m) => [...m, errorMsg]);
      } finally {
        setThinking(false);
      }
      return;
    }

    try {
      const res = await api.aiPreview(text);
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: "Drafting transaction...",
        timestamp: timeNow(),
        preview: {
          previewId: res.preview_id,
          intent: res.intent,
          intentData: res.intent_data,
          originalText: res.original_text,
          status: "pending",
        },
      };

      setMessages((m) => [...m, assistantMsg]);
      setOrbState("idle");
    } catch (err: any) {
      setOrbState("error");
      const errorMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        text: `⚠️ I couldn't understand that transaction description: "${
          err.message || "Unknown error"
        }". Please try phrasing it differently or specify the amount and category.`,
        timestamp: timeNow(),
        retryText: text,
      };
      setMessages((m) => [...m, errorMsg]);
    } finally {
      setThinking(false);
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, thinking]);

  const orbStateMemo = useMemo(() => (thinking ? "processing" : orbState), [thinking, orbState]);

  const handleQuickAction = (prompt: string) => {
    // Query chips and summary requests send immediately; transaction chips fill the input
    if (isQueryChip(prompt) || looksLikeDataQuery(prompt) || prompt === "Summarize my finances" || prompt.toLowerCase().includes("report")) {
      send(prompt);
    } else {
      setInput(prompt);
      setTimeout(() => {
        const inputEl = document.querySelector("input[placeholder*='Starbucks']") as HTMLInputElement;
        if (inputEl) {
          inputEl.focus();
        }
      }, 50);
    }
  };

  return (
    <div className="grid h-[calc(100vh-120px)] grid-cols-1 gap-4 glass-card p-4 text-slate-100 md:grid-cols-[minmax(280px,30%)_1fr] overflow-hidden rounded-2xl border border-slate-800 shadow-2xl dark">
      {/* LEFT PANEL */}
      <div className="flex min-h-0 flex-col gap-2.5 overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/20 p-4 h-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-indigo-400" />
            <h2 className="text-sm font-semibold text-slate-100">
              AI Financial Narrative
            </h2>
          </div>
          <button
            onClick={() => fetchSummary(true)}
            disabled={summaryLoading}
            className="rounded-md p-1 text-slate-500 transition-colors hover:text-indigo-400 disabled:opacity-40"
          >
            <RefreshCw className={`h-4 w-4 ${summaryLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="flex justify-center py-0.5">
          <AICoreOrb state={orbStateMemo} size={64} />
        </div>

        <div className="grid grid-cols-2 gap-2">
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

        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/30 p-4 text-[13.5px] leading-relaxed text-slate-300 scrollbar-thin scrollbar-thumb-slate-800">
          {summaryLoading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
               <RefreshCw className="animate-spin text-indigo-400" size={24} />
              <span className="text-xs text-slate-400">Gemini is narrating your finances...</span>
            </div>
          ) : (
            narrative
          )}
        </div>
      </div>

      {/* RIGHT PANEL */}
      <div className="flex min-h-0 flex-col rounded-2xl border border-slate-800/80 bg-slate-950/10 h-full overflow-hidden">
        <div
          ref={scrollRef}
          role="log"
          aria-label="Chat messages history"
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5 scrollbar-thin scrollbar-thumb-slate-800"
        >
          {messages.length === 0 ? (
            <EmptyState onQuickAction={handleQuickAction} />
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <ChatMessageBubble
                  key={m.id}
                  message={m}
                  index={i}
                  onConfirm={handleConfirm}
                  onCancel={handleCancel}
                  onRetry={handleRetry}
                />
              ))}
            </AnimatePresence>
          )}
          {thinking && <ThinkingIndicator />}
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-800 p-4 flex-shrink-0">
          <SuggestedActions actions={suggestedActions} onSelect={handleQuickAction} />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-center gap-2 rounded-xl border border-slate-700/60 bg-slate-800/60 px-3 py-2 backdrop-blur-md focus-within:border-indigo-500/60 flex-shrink-0"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="E.g., I spent 600 on lunch at Starbucks today..."
              aria-label="Message to AI Copilot"
              className="flex-1 bg-transparent text-[14px] text-slate-100 placeholder-slate-500 outline-none"
            />
            <motion.button
              type="submit"
              whileHover={{ scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              aria-label="Send message"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500 text-white shadow-[0_0_14px_rgba(99,102,241,0.5)] disabled:opacity-40"
              disabled={!input.trim()}
            >
              <SendHorizonal className="h-4 w-4" />
            </motion.button>
          </form>
        </div>
      </div>

      {/* UNDO TOAST NOTIFICATION */}
      <AnimatePresence>
        {undoToast && undoToast.visible && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-4 rounded-xl border border-slate-700/80 bg-slate-900/90 px-4 py-3 shadow-2xl backdrop-blur-md text-[13px] text-slate-100"
          >
            <div className="flex flex-col">
              <span className="font-semibold text-indigo-400">Transaction Recorded</span>
              <span className="text-[11px] text-slate-400">You can undo this action within {undoToast.secondsLeft}s</span>
            </div>
            <button
              onClick={handleUndoTrigger}
              className="rounded bg-indigo-500 hover:bg-indigo-600 px-3 py-1 font-semibold text-white transition-colors"
            >
              Undo
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AIChat;

import React from "react";
import { motion, type Variants } from "framer-motion";
import type { ChatMessage } from "./types";
import { DatabaseExecutionCard } from "./DatabaseExecutionCard";
import { IntentConfidenceCard } from "./IntentConfidenceCard";
import { ImpactAnalysisCard } from "./ImpactAnalysisCard";
import { ConfirmationCard } from "./ConfirmationCard";

export interface ChatMessageBubbleProps {
  message: ChatMessage;
  index?: number;
  onConfirm?: (messageId: string, previewId: string, intent: string, finalData: any) => Promise<void>;
  onCancel?: (messageId: string, previewId: string, intent: string) => void;
  onRetry?: (text: string) => void;
}

const STAGGER_MS = 70;

const bubbleVariants: Variants = {
  hidden: (custom: { role: "user" | "assistant" }) => ({
    opacity: 0,
    y: 20,
    scale: 0.9,
    x: custom.role === "user" ? 24 : -24,
  }),
  visible: (custom: { delay: number }) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    x: 0,
    transition: {
      type: "spring",
      stiffness: 260,
      damping: 22,
      mass: 0.8,
      delay: custom.delay,
    },
  }),
};

export const ChatMessageBubble: React.FC<ChatMessageBubbleProps> = ({
  message,
  index = 0,
  onConfirm,
  onCancel,
  onRetry,
}) => {
  const isUser = message.role === "user";
  const delay = (index * STAGGER_MS) / 1000;

  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <motion.div
        custom={isUser ? { role: message.role, delay } : { delay }}
        initial="hidden"
        animate="visible"
        variants={bubbleVariants}
        className={`flex max-w-[520px] flex-col gap-1.5 ${
          isUser ? "items-end" : "items-start"
        }`}
      >
        <div
          role={message.isQueryAnswer ? "region" : "article"}
          aria-label={
            message.isQueryAnswer
              ? "Query answer"
              : isUser
              ? `Your message: ${message.text}`
              : `AI response: ${message.preview ? "Transaction confirmation needed" : message.text}`
          }
          className={[
            "px-4 py-3 text-[15px] leading-relaxed shadow-lg",
            isUser
              ? "rounded-2xl rounded-tr-md bg-indigo-500 text-white shadow-indigo-500/25"
              : message.isQueryAnswer
              ? "w-full rounded-2xl rounded-tl-md border border-teal-700/40 bg-teal-900/20 text-slate-100 shadow-black/30 backdrop-blur-md"
              : "w-full rounded-2xl rounded-tl-md border border-slate-800 bg-slate-900/90 text-slate-100 shadow-black/30 backdrop-blur-md",
          ].join(" ")}
        >
          {message.preview && message.preview.status === "pending" ? (
            <ConfirmationCard
              previewId={message.preview.previewId}
              intent={message.preview.intent}
              initialData={message.preview.intentData}
              originalText={message.preview.originalText}
              onConfirm={(finalData) =>
                onConfirm
                  ? onConfirm(message.id, message.preview!.previewId, message.preview!.intent, finalData)
                  : Promise.resolve()
              }
              onCancel={() =>
                onCancel && onCancel(message.id, message.preview!.previewId, message.preview!.intent)
              }
            />
          ) : (
            <>
              <p className="whitespace-pre-wrap">{message.text}</p>

              {message.undone && (
                <span className="mt-1 inline-flex items-center gap-1 rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-rose-400">
                  ↩ undone
                </span>
              )}

              {message.retryText && onRetry && (
                <button
                  onClick={() => onRetry(message.retryText!)}
                  className="mt-2.5 flex items-center justify-center rounded bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 text-[11px] font-semibold text-indigo-400 hover:bg-indigo-500/20 active:scale-95 transition-all"
                >
                  Try again
                </button>
              )}

              {!isUser && message.intent && message.intent !== ("QUERY" as any) && message.confidence !== undefined && (
                <IntentConfidenceCard intent={message.intent} confidence={message.confidence} />
              )}

              {!isUser && message.record && (
                <DatabaseExecutionCard record={message.record} />
              )}

              {!isUser && message.impact && (
                <ImpactAnalysisCard impact={message.impact} />
              )}
            </>
          )}
        </div>

        <span className="px-1 text-[11px] text-slate-400">
          {message.timestamp}
        </span>
      </motion.div>
    </div>
  );
};

export default ChatMessageBubble;


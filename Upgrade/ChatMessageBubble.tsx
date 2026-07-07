import React from "react";
import { motion, type Variants } from "framer-motion";
import type { ChatMessage } from "./types";
import { DatabaseExecutionCard } from "./DatabaseExecutionCard";
import { IntentConfidenceCard } from "./IntentConfidenceCard";
import { ImpactAnalysisCard } from "./ImpactAnalysisCard";

export interface ChatMessageBubbleProps {
  message: ChatMessage;
  index?: number;
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
          className={[
            "px-4 py-3 text-[15px] leading-relaxed shadow-lg",
            isUser
              ? "rounded-2xl rounded-tr-md bg-indigo-500 text-white shadow-indigo-500/25"
              : "w-full rounded-2xl rounded-tl-md border border-slate-800 bg-slate-900/90 text-slate-100 shadow-black/30 backdrop-blur-md",
          ].join(" ")}
        >
          <p className="whitespace-pre-wrap">{message.text}</p>

          {!isUser && message.intent && message.confidence !== undefined && (
            <IntentConfidenceCard
              intent={message.intent}
              confidence={message.confidence}
            />
          )}

          {!isUser && message.record && (
            <DatabaseExecutionCard record={message.record} />
          )}

          {!isUser && message.impact && (
            <ImpactAnalysisCard impact={message.impact} />
          )}
        </div>

        <span className="px-1 text-[11px] text-slate-500">
          {message.timestamp}
        </span>
      </motion.div>
    </div>
  );
};

export default ChatMessageBubble;

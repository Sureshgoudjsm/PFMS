import React from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface AICoreOrbProps {
  state?: "idle" | "processing" | "error";
  size?: number;
}

/**
 * AICoreOrb — the signature element of the AI Copilot.
 * A glass sphere that breathes gently at rest, spins up with light
 * particles while a request is in flight, and flashes rose on error.
 */
export const AICoreOrb: React.FC<AICoreOrbProps> = ({
  state = "idle",
  size = 96,
}) => {
  const particles = Array.from({ length: 8 });

  return (
    <div
      className="relative flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {/* outer ambient glow */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: size * 1.8,
          height: size * 1.8,
          background:
            state === "error"
              ? "radial-gradient(circle, rgba(244,63,94,0.35), transparent 70%)"
              : "radial-gradient(circle, rgba(99,102,241,0.35), rgba(168,85,247,0.15), transparent 70%)",
        }}
        animate={
          state === "error"
            ? { opacity: [0.3, 0.9, 0.3] }
            : { opacity: [0.4, 0.7, 0.4] }
        }
        transition={{
          duration: state === "error" ? 0.75 : 4,
          repeat: state === "error" ? 2 : Infinity,
          ease: "easeInOut",
        }}
      />

      {/* particle emission, processing only */}
      <AnimatePresence>
        {state === "processing" &&
          particles.map((_, i) => {
            const angle = (i / particles.length) * Math.PI * 2;
            return (
              <motion.span
                key={i}
                className="absolute h-1.5 w-1.5 rounded-full bg-purple-300"
                style={{ boxShadow: "0 0 6px rgba(216,180,254,0.9)" }}
                initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
                animate={{
                  x: Math.cos(angle) * size * 0.9,
                  y: Math.sin(angle) * size * 0.9,
                  opacity: [0, 1, 0],
                  scale: [0.4, 1, 0.4],
                }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 1.4,
                  repeat: Infinity,
                  delay: i * 0.12,
                  ease: "easeOut",
                }}
              />
            );
          })}
      </AnimatePresence>

      {/* glass sphere */}
      <motion.div
        className="relative rounded-full border border-white/10 backdrop-blur-md"
        style={{
          width: size,
          height: size,
          background:
            state === "error"
              ? "linear-gradient(135deg, rgba(244,63,94,0.5), rgba(15,23,42,0.6))"
              : "linear-gradient(135deg, rgba(99,102,241,0.55), rgba(168,85,247,0.45))",
          boxShadow:
            state === "error"
              ? "0 0 30px rgba(244,63,94,0.5), inset 0 0 20px rgba(255,255,255,0.08)"
              : "0 0 30px rgba(99,102,241,0.45), inset 0 0 20px rgba(255,255,255,0.08)",
        }}
        animate={
          state === "processing"
            ? { scale: [1, 1.1, 1], rotate: 360 }
            : state === "error"
            ? { scale: [1, 1.15, 1] }
            : { scale: [1, 1.08, 1] }
        }
        transition={
          state === "processing"
            ? {
                scale: { duration: 1.1, repeat: Infinity, ease: "easeInOut" },
                rotate: { duration: 2.2, repeat: Infinity, ease: "linear" },
              }
            : {
                duration: state === "error" ? 1.5 : 4,
                repeat: state === "error" ? 1 : Infinity,
                ease: "easeInOut",
              }
        }
      >
        {/* glass highlight */}
        <div className="absolute inset-1 rounded-full bg-gradient-to-br from-white/20 via-transparent to-transparent" />
      </motion.div>
    </div>
  );
};

export default AICoreOrb;

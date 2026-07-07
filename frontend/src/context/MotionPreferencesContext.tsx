import { createContext, useContext } from 'react';
import { useReducedMotion, MotionConfig } from 'framer-motion';

interface MotionPreferences {
  shouldReduceMotion: boolean;
}

const MotionPreferencesContext = createContext<MotionPreferences>({
  shouldReduceMotion: false,
});

export function MotionPreferencesProvider({ children }: { children: React.ReactNode }) {
  const systemReducedMotion = useReducedMotion();
  const shouldReduceMotion = !!systemReducedMotion;

  return (
    <MotionPreferencesContext.Provider value={{ shouldReduceMotion }}>
      <MotionConfig transition={shouldReduceMotion ? { duration: 0 } : undefined}>
        {children}
      </MotionConfig>
    </MotionPreferencesContext.Provider>
  );
}

export function useMotionPreferences() {
  return useContext(MotionPreferencesContext);
}

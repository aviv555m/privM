import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type ThemeMode = 'light' | 'dark';

const ThemeContext = createContext<{ mode: ThemeMode; toggle: () => void }>({
  mode: 'light',
  toggle: () => undefined
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('light');
  const value = useMemo(
    () => ({
      mode,
      toggle: () => setMode((prev) => (prev === 'light' ? 'dark' : 'light'))
    }),
    [mode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useThemeMode() {
  return useContext(ThemeContext);
}

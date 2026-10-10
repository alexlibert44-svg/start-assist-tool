import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ThemeStore {
  isDark: boolean;
  toggleTheme: () => void;
  setDark: (val: boolean) => void;
}

export const useTheme = create<ThemeStore>()(
  persist(
    (set) => ({
      isDark: true,
      toggleTheme: () =>
        set((state) => {
          const next = !state.isDark;
          applyTheme(next);
          return { isDark: next };
        }),
      setDark: (val: boolean) => {
        applyTheme(val);
        set({ isDark: val });
      },
    }),
    { name: "larry-theme" }
  )
);

export function applyTheme(isDark: boolean) {
  const root = document.documentElement;
  if (isDark) {
    root.classList.remove("light");
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
    root.classList.add("light");
  }
}

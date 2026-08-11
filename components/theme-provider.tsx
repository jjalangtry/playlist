"use client";

import { createContext, useContext, useEffect, useState } from "react";
import NextLink from "next/link";
import { Theme as AstryxTheme } from "@astryxdesign/core/theme";
import { LinkProvider } from "@astryxdesign/core/Link";
import { InternationalizationProvider } from "@astryxdesign/core/i18n";
import { LayerProvider } from "@astryxdesign/core/Layer";
import { ToastViewport, useToast } from "@astryxdesign/core/Toast";
import { matchaTheme } from "@astryxdesign/theme-matcha/built";
import { MUSIC_TOAST_EVENT, type MusicToastDetail } from "@/lib/toast";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "system";

  try {
    const stored = window.localStorage.getItem("theme");
    return stored === "light" || stored === "dark" || stored === "system"
      ? stored
      : "system";
  } catch {
    return "system";
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = window.document.documentElement;
    
    // Write the resolved mode to data-theme on <html>. The Tailwind `dark:`
    // variant and the Astryx reset both read this attribute. The Astryx Theme
    // component removes the attribute in system mode, so this parent effect
    // must set it after the child effect runs.
    const applyTheme = (isDark: boolean) => {
      root.dataset.theme = isDark ? "dark" : "light";
      setResolvedTheme(isDark ? "dark" : "light");
    };

    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      applyTheme(mediaQuery.matches);
      
      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches);
      mediaQuery.addEventListener("change", handler);
      return () => mediaQuery.removeEventListener("change", handler);
    } else {
      applyTheme(theme === "dark");
    }
  }, [theme]);

  const handleSetTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    try {
      localStorage.setItem("theme", newTheme);
    } catch {
      // Keep the selected theme for this session when storage is unavailable.
    }
  };

  return (
    <AstryxTheme theme={matchaTheme} mode={theme}>
      <InternationalizationProvider locale="en-US">
        <LinkProvider component={NextLink}>
          <LayerProvider toast={{ position: "bottomEnd", maxVisible: 4 }}>
            <ThemeContext.Provider value={{ theme, setTheme: handleSetTheme, resolvedTheme }}>
              <AstryxToastBridge />
              <ToastViewport position="bottomEnd" maxVisible={4}>
                {children}
              </ToastViewport>
            </ThemeContext.Provider>
          </LayerProvider>
        </LinkProvider>
      </InternationalizationProvider>
    </AstryxTheme>
  );
}

function AstryxToastBridge() {
  const showToast = useToast();

  useEffect(() => {
    const handleToast = (event: Event) => {
      const detail = (event as CustomEvent<MusicToastDetail>).detail;
      showToast({
        body: detail.message,
        type: detail.kind === "error" ? "error" : "info",
        uniqueID: detail.id,
      });
    };

    window.addEventListener(MUSIC_TOAST_EVENT, handleToast);
    return () => window.removeEventListener(MUSIC_TOAST_EVENT, handleToast);
  }, [showToast]);

  return null;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

"use client";
import { ThemeProvider } from "next-themes";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"     // adds/removes "dark" on <html>
      defaultTheme="dark"   // SSR default = dark
      enableSystem={false}  // no OS auto; user toggle only
      storageKey="theme"    // localStorage key
    >
      {children}
    </ThemeProvider>
  );
}
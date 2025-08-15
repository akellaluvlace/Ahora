import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Script from "next/script";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ahora",
  description: "Meaningful Anonymous Chats, matched by vibe & interest.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Set theme before hydration to avoid flicker/mismatch */}
        <Script id="theme-init" strategy="beforeInteractive">{`
          try {
            var t = localStorage.getItem('theme');
            var root = document.documentElement;
            if (t === 'light') root.classList.remove('dark');
            else root.classList.add('dark'); // default to dark
          } catch {}
        `}</Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased
                    bg-white text-neutral-900 dark:bg-neutral-950 dark:text-neutral-50`}
      >
        {children}
      </body>
    </html>
  );
}
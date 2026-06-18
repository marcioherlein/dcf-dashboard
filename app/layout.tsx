import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import AppShell from "@/components/layout/AppShell";
import CookieNotice from "@/components/layout/CookieNotice";
import { DM_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip"

const dmMono = DM_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  weight: ['400', '500'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: "insic — Invest with a process, not a story",
  description: "Fair value estimates, market-implied expectations, and transparent assumptions — so you can understand what has to be true before you invest. Free.",
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'insic' },
  openGraph: {
    title: "insic — Invest with a process, not a story",
    description: "Fair value estimates and transparent assumptions for any stock. Free.",
    siteName: "insic",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "insic — Invest with a process, not a story",
    description: "Fair value estimates and transparent assumptions for any stock. Free.",
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("font-sans", dmMono.variable)}>
      <head>
        {/* Theme color matches --color-bg warm off-white */}
        <meta name="theme-color" content="#FAF9F6" />
        <meta name="one-verification" content="6ad52dfc" />
      </head>
      <body className="antialiased bg-background">
        <Providers>
          <TooltipProvider>
            <AppShell>{children}</AppShell>
            <CookieNotice />
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}

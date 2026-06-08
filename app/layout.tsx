import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";
import AppShell from "@/components/layout/AppShell";
import { Inter, DM_Mono } from "next/font/google";
import { cn } from "@/lib/utils";
import { TooltipProvider } from "@/components/ui/tooltip"

// Inter is the primary UI font for all app and dashboard surfaces.
// Space Grotesk is intentionally removed — Inter provides the editorial
// clarity needed without the "SaaS template" associations.
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  preload: true,
});
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
    <html lang="en" className={cn("font-sans", inter.variable, dmMono.variable)}>
      <head>
        {/* Theme color matches --color-bg warm off-white */}
        <meta name="theme-color" content="#FAF9F6" />
      </head>
      <body className="antialiased bg-background">
        <Providers>
          <TooltipProvider>
            <AppShell>{children}</AppShell>
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}

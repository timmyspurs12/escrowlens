import type { Metadata } from "next";
import Providers from "@/components/Providers";
import AppShell from "@/components/AppShell";
import "./globals.css";

export const metadata: Metadata = {
  title: "EscrowLens — Evidence-grade escrow",
  description:
    "Peer-to-peer escrow where funds move only on dual-party approval, evidence is hashed on-chain, and an independent AI arbiter signs recommendations it cannot execute.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-canvas text-ink">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}

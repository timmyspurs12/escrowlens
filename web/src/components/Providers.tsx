"use client";

import dynamic from "next/dynamic";
import SafeBoundary from "./SafeBoundary";

/**
 * Privy wrapper — passkey-based embedded wallets, no seed phrases.
 *
 * Hard requirement: the Privy app id comes ONLY from the environment
 * (NEXT_PUBLIC_PRIVY_APP_ID). Nothing is hardcoded. When it is missing,
 * we render a setup panel instead of mounting Privy, so the app never
 * crashes and never ships placeholder credentials.
 *
 * The Privy provider itself lives in PrivyBridge, loaded via next/dynamic
 * with ssr:false: the login flow is client-only by nature, and isolating it
 * keeps the initial compile graph small (the Privy bundle is very large).
 */
const PrivyBridge = dynamic(() => import("./PrivyBridge"), { ssr: false });

export default function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    // Privy not configured at build time: still render the app, but shield
    // it from wallet-hook crashes and show the setup panel.
    return (
      <SafeBoundary>
        {children}
        <SetupRequired />
      </SafeBoundary>
    );
  }

  return <PrivyBridge>{children}</PrivyBridge>;
}

function SetupRequired() {
  return (
    <div className="fixed inset-x-0 bottom-0 border-t border-warn/30 bg-warn/10 px-6 py-3 text-sm text-warn">
      <strong className="font-semibold">Privy not configured.</strong>{" "}
      Set <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs">NEXT_PUBLIC_PRIVY_APP_ID</code>{" "}
      in <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs">web/.env.local</code>{" "}
      (create an app at dashboard.privy.io) and reload.
    </div>
  );
}

"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { monadTestnet } from "@/lib/monad";

/**
 * Privy wrapper — passkey-based embedded wallets, no seed phrases.
 *
 * Hard requirement: the Privy app id comes ONLY from the environment
 * (NEXT_PUBLIC_PRIVY_APP_ID). Nothing is hardcoded. When it is missing,
 * we render a setup panel instead of mounting Privy, so the app never
 * crashes and never ships placeholder credentials.
 */
export default function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

  if (!appId) {
    return (
      <SetupRequired>
        {children}
      </SetupRequired>
    );
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: { theme: "dark", accentColor: "#3b82f6" },
        defaultChain: monadTestnet,
        supportedChains: [monadTestnet],
        embeddedWallets: {
          ethereum: { createOnLogin: "users-without-wallets" },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}

function SetupRequired({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <div className="fixed inset-x-0 bottom-0 border-t border-amber-500/30 bg-amber-500/10 px-6 py-3 text-sm text-amber-200">
        <strong className="font-semibold">Privy not configured.</strong>{" "}
        Set <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs">NEXT_PUBLIC_PRIVY_APP_ID</code>{" "}
        in <code className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-xs">web/.env.local</code>{" "}
        (create an app at dashboard.privy.io, enable Monad Testnet 10143) and reload.
      </div>
    </>
  );
}

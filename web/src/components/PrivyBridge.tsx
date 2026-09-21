"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import { monadTestnet } from "@/lib/monad";

/**
 * The actual Privy provider. Imported ONLY dynamically (ssr:false) from
 * Providers.tsx so the heavy Privy module graph compiles as its own lazy
 * chunk — keeps initial page compiles light on memory-constrained hosts.
 */
export default function PrivyBridge({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID as string;

  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: { theme: "dark", accentColor: "#5b9bff" },
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

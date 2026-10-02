"use client";

import { usePrivy, useLogin } from "@privy-io/react-auth";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CONTRACT, CHAIN_ID } from "@/lib/env";
import { shortenAddress } from "@/lib/format";

const NAV = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/explorer", label: "Explorer" },
  { href: "/arbiter", label: "Arbiter" },
  { href: "/agent", label: "Agent" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user, logout, login } = usePrivy();
  const pathname = usePathname();
  const addr = user?.wallet?.address ?? null;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="hairline-b sticky top-0 z-40 bg-canvas/85 backdrop-blur-sm">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-6">
          <Link href="/" className="focus-ring flex items-center gap-2.5 rounded" aria-label="EscrowLens home">
            <LensMark />
            <span className="text-[15px] font-semibold tracking-tight">EscrowLens</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {NAV.map((n) => {
              const active = pathname.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`focus-ring rounded-md px-3 py-1.5 text-[13px] transition ${
                    active ? "bg-surface-2 text-ink" : "text-ink-3 hover:text-ink"
                  }`}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {!CONTRACT && (
              <span className="label-mono !text-warn">CONTRACT UNSET</span>
            )}
            {authenticated && addr ? (
              <div className="flex items-center gap-2">
                <span className="data-mono hidden sm:inline">{shortenAddress(addr)}</span>
                <button
                  onClick={logout}
                  className="focus-ring rounded-lg border border-line-strong px-3 py-1.5 text-[12.5px] text-ink-2 transition hover:text-ink"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <button
                onClick={() => login()}
                disabled={!ready}
                className="focus-ring rounded-lg bg-ink px-3.5 py-1.5 text-[12.5px] font-medium text-canvas transition hover:bg-white disabled:opacity-40"
              >
                Continue securely
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 pb-24 pt-8">{children}</main>

      <footer className="hairline-t">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-5 gap-y-1 px-6 py-4">
          <span className="label-mono">ESCROWLENS</span>
          <span className="data-mono !text-ink-4">CHAIN {CHAIN_ID}</span>
          {CONTRACT && <span className="data-mono !text-ink-4">{shortenAddress(CONTRACT, 10, 6)}</span>}
          <span className="label-mono ml-auto !text-ink-4">FUNDS MOVE ONLY ON DUAL PARTY APPROVAL</span>
        </div>
      </footer>
    </div>
  );
}

/**
 * EscrowLens mark — a six-blade optical aperture inside a hairline
 * instrument ring: funds sealed in an evidence-grade lens. Blades use the
 * verified-green semantic (#3ecf8e); the ring stays hairline-neutral.
 */
export function LensMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="none" aria-hidden>
      <circle cx="128" cy="128" r="120" stroke="rgba(233,237,243,0.16)" strokeWidth="2.5" />
      <circle cx="128" cy="128" r="111" stroke="#3ecf8e" strokeOpacity="0.5" strokeWidth="1.75" />
      <g fill="#3ecf8e" stroke="#101318" strokeWidth="3" strokeLinejoin="miter">
        {Array.from({ length: 6 }, (_, i) => (
          <path key={i} d="M128 36 L222 82 L165 111 Z" transform={`rotate(${i * 60} 128 128)`} />
        ))}
      </g>
    </svg>
  );
}

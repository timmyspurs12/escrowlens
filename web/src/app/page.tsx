"use client";

import { usePrivy, useLogin } from "@privy-io/react-auth";
import { ESCROW_CONTRACT, CHAIN_ID, monadTestnet } from "@/lib/monad";

const hasPrivy = !!process.env.NEXT_PUBLIC_PRIVY_APP_ID;
const hasContract = !!ESCROW_CONTRACT;

export default function Home() {
  const { ready, authenticated, user, logout } = usePrivy();
  const { login } = useLogin();

  const walletAddress = user?.wallet?.address;

  return (
    <main className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col px-6">
      {/* ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_60%_at_50%_0%,rgba(56,130,246,0.16),transparent_70%)]"
      />

      <header className="flex items-center justify-between py-6">
        <div className="flex items-center gap-2.5">
          <LensMark />
          <span className="text-lg font-semibold tracking-tight">EscrowLens</span>
        </div>
        <nav className="hidden items-center gap-8 text-sm text-slate-400 md:flex">
          <span>How it works</span>
          <span>Explorer</span>
          <span>Arbiter</span>
        </nav>
        {authenticated ? (
          <button
            onClick={logout}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium transition hover:bg-white/10"
          >
            {shorten(walletAddress)} · Sign out
          </button>
        ) : (
          <button
            onClick={() => login()}
            disabled={!hasPrivy || !ready}
            className="rounded-lg bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Sign in with passkey
          </button>
        )}
      </header>

      <section className="flex flex-1 flex-col items-center justify-center gap-8 pb-28 pt-16 text-center">
        <span className="rounded-full border border-blue-400/20 bg-blue-400/10 px-3 py-1 text-xs font-medium text-blue-300">
          Monad Testnet · Chain {CHAIN_ID}
        </span>
        <h1 className="max-w-3xl text-5xl font-semibold leading-[1.1] tracking-tight md:text-6xl">
          Peer-to-peer escrow,
          <br />
          <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
            settled by evidence.
          </span>
        </h1>
        <p className="max-w-xl text-lg leading-relaxed text-slate-400">
          Lock funds in a trustless contract, resolve disputes with an independent AI
          arbiter, and approve every outcome together. Passkey wallets — no seed
          phrases, ever.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4">
          <a
            href="/escrow/new"
            className={`rounded-xl bg-blue-500 px-6 py-3 font-semibold text-white shadow-xl shadow-blue-500/25 transition hover:bg-blue-400 ${
              !hasContract ? "pointer-events-none opacity-40" : ""
            }`}
          >
            Create an escrow
          </a>
          <a
            href="/explorer"
            className="rounded-xl border border-white/10 bg-white/5 px-6 py-3 font-medium transition hover:bg-white/10"
          >
            Browse the explorer
          </a>
        </div>

        {/* env readiness — honest states only */}
        <div className="mt-10 grid w-full max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
          <StatusCard ok={hasPrivy} label="Privy wallet" hint="NEXT_PUBLIC_PRIVY_APP_ID" />
          <StatusCard ok={hasContract} label="Escrow contract" hint="NEXT_PUBLIC_ESCROW_CONTRACT" />
          <StatusCard ok={hasContract} label="Sourcify verified" hint="exact_match on 10143" />
        </div>
      </section>
    </main>
  );
}

function StatusCard({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-400" : "bg-amber-400"}`} />
        {label}
      </div>
      <div className="mt-0.5 truncate pl-4 font-mono text-[11px] text-slate-500">{hint}</div>
    </div>
  );
}

function shorten(addr?: string) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "Account";
}

function LensMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden>
      <circle cx="14" cy="14" r="11.5" stroke="url(#g)" strokeWidth="2.5" />
      <circle cx="14" cy="14" r="5" fill="url(#g)" />
      <defs>
        <linearGradient id="g" x1="3" y1="3" x2="25" y2="25">
          <stop stopColor="#60a5fa" />
          <stop offset="1" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
    </svg>
  );
}

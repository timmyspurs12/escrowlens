"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePrivy, useLogin } from "@privy-io/react-auth";
import { readEscrowCountLite, readArbiterLite } from "@/lib/rpc";
import { CONTRACT, CHAIN_ID } from "@/lib/env";
import { shortenAddress } from "@/lib/format";

export default function Home() {
  const { ready, authenticated, user } = usePrivy();
  const { login } = useLogin();
  const [count, setCount] = useState<number | null>(null);
  const [arbiter, setArbiter] = useState<string>("");

  useEffect(() => {
    readEscrowCountLite().then(setCount);
    readArbiterLite().then(setArbiter);
  }, []);

  return (
    <div className="flex flex-col">
      {/* ── Hero: the mechanism, precisely stated ── */}
      <section className="flex flex-col items-start gap-7 pb-16 pt-14">
        <span className="label-mono">EVIDENCE-GRADE P2P ESCROW · MONAD TESTNET {CHAIN_ID}</span>
        <h1 className="max-w-3xl text-[42px] font-medium leading-[1.08] tracking-[-0.025em] md:text-[54px]">
          Funds stay locked until
          <br />
          both sides agree —
          <br />
          <span className="text-ink-3">or the evidence decides.</span>
        </h1>
        <p className="max-w-xl text-[15.5px] leading-relaxed text-ink-2">
          EscrowLens locks a payment in a minimal contract. The buyer and seller can always settle by
          mutual approval. If they disagree, each side commits evidence hashes and an independent AI
          arbiter signs a recommendation — which still requires both parties to execute.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={authenticated ? "/escrow/new" : "/dashboard"}
            className="focus-ring inline-flex h-11 items-center rounded-[10px] bg-ink px-6 text-[14px] font-medium text-canvas transition hover:bg-white"
          >
            {authenticated ? "Create an escrow" : "Open your account"}
          </Link>
          <Link
            href="/explorer"
            className="focus-ring inline-flex h-11 items-center rounded-[10px] border border-line-strong px-6 text-[14px] text-ink-2 transition hover:bg-surface-2 hover:text-ink"
          >
            Inspect the trust record
          </Link>
          {!authenticated && (
            <span className="label-mono hidden md:inline">
              {ready ? "PASSKEY SIGN-IN · NO SEED PHRASE" : "LOADING SECURE SESSION…"}
            </span>
          )}
        </div>
      </section>

      {/* ── Live record strip: real chain data only ── */}
      <section className="grid grid-cols-1 gap-px overflow-hidden rounded-[14px] border border-line bg-line sm:grid-cols-3">
        <div className="bg-surface-1 px-5 py-4">
          <div className="label-mono">Escrows created</div>
          <div className="mt-1.5 font-mono text-[22px] tracking-tight">
            {count === null ? <span className="text-ink-4">··</span> : count}
          </div>
        </div>
        <div className="bg-surface-1 px-5 py-4">
          <div className="label-mono">Escrow contract</div>
          <div className="data-mono mt-2 !text-[13px]">{CONTRACT ? shortenAddress(CONTRACT, 12, 8) : "NOT CONFIGURED"}</div>
        </div>
        <div className="bg-surface-1 px-5 py-4">
          <div className="label-mono">Independent arbiter</div>
          <div className="data-mono mt-2 !text-[13px]">{arbiter ? shortenAddress(arbiter, 12, 8) : "··"}</div>
        </div>
      </section>

      {/* ── How the instrument works ── */}
      <section className="mt-16 flex flex-col gap-8">
        <span className="label-mono">HOW THE INSTRUMENT WORKS</span>
        <div className="grid gap-px overflow-hidden rounded-[14px] border border-line bg-line md:grid-cols-3">
          <Step n="01" title="Lock the terms">
            The buyer funds the contract in one transaction. Amount, delivery deadline and dispute
            window become immutable on-chain terms — no admin key exists to change them.
          </Step>
          <Step n="02" title="Commit evidence">
            Delivery happens off-chain. Proof is hashed client-side and committed on-chain, so the
            dispute record is verifiable without exposing the underlying documents.
          </Step>
          <Step n="03" title="Settle by approval">
            Either party can release or refund. In a dispute, the arbiter signs an EIP-712
            recommendation — but funds move only when both parties approve the outcome.
          </Step>
        </div>
      </section>

      {/* ── Safety net ── */}
      <section className="mt-10 rounded-[14px] border border-line bg-surface-1 px-6 py-5">
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <span className="label-mono !text-ok">NO LOST FUNDS PATHS</span>
          <span className="text-[13px] leading-relaxed text-ink-2">
            Delivery deadline passes silently → seller is paid. Dispute unanswered → buyer refunded.
            Ruling unapproved in time → buyer refunded. All timeouts are permissionless: anyone can
            trigger them, no one can prevent them.
          </span>
        </div>
      </section>
    </div>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 bg-surface-1 px-5 py-5">
      <span className="label-mono !text-signal">{n}</span>
      <span className="title-lg !text-[16.5px]">{title}</span>
      <p className="text-[13.5px] leading-relaxed text-ink-2">{children}</p>
    </div>
  );
}

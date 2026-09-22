"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { readEscrowAll, type EscrowState } from "@/lib/escrow";
import { fmtMon, STATUS_META, timeLeft } from "@/lib/format";
import { StatusPill, EmptyState, SectionLabel, ActionButton } from "@/components/ui";

type Row = { state: EscrowState };

export default function Dashboard() {
  const { authenticated, user, ready } = usePrivy();
  const addr = user?.wallet?.address ?? null;
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let live = true;
    readEscrowAll().then((states) => {
      if (live) setRows(states.map((state) => ({ state })).sort((a, b) => Number(b.state.id) - Number(a.state.id)));
    });
    return () => {
      live = false;
    };
  }, []);

  const mine = useMemo(() => {
    if (!rows || !addr) return [];
    return rows.filter(
      ({ state }) =>
        state.status !== 4 &&
        (state.buyer.toLowerCase() === addr.toLowerCase() || state.seller.toLowerCase() === addr.toLowerCase())
    );
  }, [rows, addr]);

  const others = useMemo(() => {
    if (!rows || !addr) return [];
    return rows.filter(
      ({ state }) =>
        state.buyer.toLowerCase() !== addr.toLowerCase() && state.seller.toLowerCase() !== addr.toLowerCase()
    );
  }, [rows, addr]);

  if (!ready) return null;

  if (!authenticated) {
    return (
      <EmptyState title="NO SESSION">
        Sign in with your passkey to see the escrows where your action is required.
      </EmptyState>
    );
  }

  const needsAction = mine.filter(({ state }) => nextAction(state, addr) !== null);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="label-mono">YOUR OBLIGATIONS</span>
          <h1 className="title-xl mt-1.5">Dashboard</h1>
        </div>
        <Link href="/escrow/new">
          <ActionButton>New escrow</ActionButton>
        </Link>
      </header>

      {/* Needs your action */}
      <section className="flex flex-col gap-3">
        <SectionLabel>Needs your action</SectionLabel>
        {rows === null ? (
          <LoadingLines />
        ) : needsAction.length === 0 ? (
          <div className="panel px-5 py-4 text-sm text-ink-3">
            Nothing is waiting on you{mine.length > 0 ? " right now." : ". Your protected transactions will appear here."}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {needsAction.map(({ state }) => {
              const action = nextAction(state, addr)!;
              return (
                <li key={state.id.toString()} className="rise-in">
                  <Link
                    href={`/escrow/${state.id}`}
                    className="focus-ring panel group flex items-center gap-4 px-5 py-4 transition hover:border-line-strong"
                  >
                    <span className="pulse-dot h-2 w-2 shrink-0 rounded-full bg-warn" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-medium text-ink">{action.text}</div>
                      <div className="label-mono mt-1 truncate">
                        ESCROW #{state.id.toString()} · {state.description}
                      </div>
                    </div>
                    <span className="data-mono hidden sm:inline">{fmtMon(state.amount)} MON</span>
                    <Arrow />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Active escrows */}
      <section className="flex flex-col gap-3">
        <SectionLabel>Active escrows where you are a party</SectionLabel>
        {rows === null ? (
          <LoadingLines />
        ) : mine.length === 0 ? (
          <EmptyState
            title="NO ACTIVE ESCROWS"
            action={
              <Link href="/escrow/new" className="focus-ring mt-1 rounded-[10px] border border-line-strong px-4 py-2 text-[13px] text-ink transition hover:bg-surface-2">
                Create your first escrow
              </Link>
            }
          >
            Your next protected transaction will appear here — every state change, evidence hash and
            settlement stays inspectable.
          </EmptyState>
        ) : (
          <div className="overflow-hidden rounded-[14px] border border-line">
            {mine.map(({ state }) => (
              <Link
                key={state.id.toString()}
                href={`/escrow/${state.id}`}
                className="focus-ring group grid grid-cols-[70px_1fr_auto] items-center gap-4 bg-surface-1 px-5 py-4 transition hover:bg-surface-2/50 sm:grid-cols-[70px_1fr_110px_130px_auto]"
              >
                <span className="data-mono !text-ink-3">#{state.id.toString()}</span>
                <div className="min-w-0">
                  <div className="truncate text-[14px] text-ink">{state.description}</div>
                  <div className="label-mono mt-0.5">
                    {addr && state.buyer.toLowerCase() === addr.toLowerCase() ? "YOU ARE BUYER" : "YOU ARE SELLER"}
                    {state.status !== 4 && state.deliveryDeadline > 0n && <> · DEADLINE {timeLeft(state.deliveryDeadline)}</>}
                  </div>
                </div>
                <span className="data-mono hidden text-right sm:block">{fmtMon(state.amount)} MON</span>
                <span className="hidden justify-end sm:flex">
                  <StatusPill status={state.status} small />
                </span>
                <Arrow />
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Network record — real escrows only, no invented activity */}
      {others.length > 0 && (
        <section className="flex flex-col gap-3">
          <SectionLabel>Other escrows on record</SectionLabel>
          <div className="overflow-hidden rounded-[14px] border border-line">
            {others.slice(0, 6).map(({ state }) => (
              <Link
                key={state.id.toString()}
                href={`/escrow/${state.id}`}
                className="focus-ring grid grid-cols-[70px_1fr_auto_auto] items-center gap-4 bg-surface-1 px-5 py-3.5 transition hover:bg-surface-2/50"
              >
                <span className="data-mono !text-ink-4">#{state.id.toString()}</span>
                <div className="truncate text-[13.5px] text-ink-2">{state.description}</div>
                <span className="data-mono hidden sm:inline">{fmtMon(state.amount)} MON</span>
                <StatusPill status={state.status} small />
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** Computes the single next obligation for the viewing party, from chain state alone. */
function nextAction(state: EscrowState, addr: string | null): { text: string } | null {
  if (!addr) return null;
  const isBuyer = state.buyer.toLowerCase() === addr.toLowerCase();
  const isSeller = state.seller.toLowerCase() === addr.toLowerCase();
  const myEvidence =
    (isBuyer && state.buyerEvidenceHash !== ZERO32) || (isSeller && state.sellerEvidenceHash !== ZERO32);
  switch (state.status) {
    case 0:
      if (isSeller) return { text: "Deliver the work, then mark it delivered" };
      return null;
    case 1:
      if (isBuyer) return { text: "Review the delivery — release payment or open a dispute" };
      if (!myEvidence) return { text: "Commit delivery evidence while things are calm" };
      return null;
    case 2:
      if (!myEvidence) return { text: "Commit your evidence — the arbiter reviews what is on-chain" };
      return { text: "Evidence committed — request the arbiter's review" };
    case 3:
      return { text: "Approve the arbiter's ruling — the window is open" };
    default:
      return null;
  }
}

const ZERO32 = "0x" + "0".repeat(64);

function LoadingLines() {
  return (
    <div className="panel flex flex-col gap-3 px-5 py-5">
      <div className="h-3 w-2/5 animate-pulse rounded bg-surface-3" />
      <div className="h-3 w-1/4 animate-pulse rounded bg-surface-3" />
      <span className="label-mono !text-ink-4">READING ESCROW STATE FROM CHAIN {`…`}</span>
    </div>
  );
}

function Arrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-ink-4 transition group-hover:text-ink">
      <path d="M5 2.5 9.5 7 5 11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

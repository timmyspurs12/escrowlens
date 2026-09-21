"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePrivy } from "@privy-io/react-auth";
import { scanEvents, buildIndex, readEscrow, type EscrowRecord, type EscrowState } from "@/lib/escrow";
import { fmtMon, STATUS_META, timeLeft } from "@/lib/format";
import { StatusPill, EmptyState, SectionLabel, ActionButton } from "@/components/ui";

type Row = { rec: EscrowRecord; state: EscrowState | null };

export default function Dashboard() {
  const { authenticated, user, ready } = usePrivy();
  const addr = user?.wallet?.address ?? null;
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let live = true;
    (async () => {
      const events = await scanEvents();
      const idx = buildIndex(events);
      const detailed = await Promise.all(
        [...idx.values()].map(async (rec) => ({ rec, state: await readEscrow(BigInt(rec.id)) }))
      );
      if (live) setRows(detailed);
    })();
    return () => {
      live = false;
    };
  }, []);

  const mine = useMemo(() => {
    if (!rows || !addr) return [];
    return rows
      .filter(
        ({ rec, state }) =>
          state?.status !== 4 &&
          (rec.buyer?.toLowerCase() === addr.toLowerCase() || rec.seller?.toLowerCase() === addr.toLowerCase())
      )
      .sort((a, b) => b.rec.id - a.rec.id);
  }, [rows, addr]);

  const others = useMemo(() => {
    if (!rows || !addr) return [];
    return rows
      .filter(
        ({ rec }) =>
          rec.buyer?.toLowerCase() !== addr.toLowerCase() && rec.seller?.toLowerCase() !== addr.toLowerCase()
      )
      .sort((a, b) => b.rec.id - a.rec.id);
  }, [rows, addr]);

  if (!ready) return null;

  if (!authenticated) {
    return (
      <EmptyState title="NO SESSION">
        Sign in with your passkey to see the escrows where your action is required.
      </EmptyState>
    );
  }

  const needsAction = mine.filter(({ rec, state }) => nextAction(rec, state, addr) !== null);

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
            {needsAction.map(({ rec, state }) => {
              const action = nextAction(rec, state, addr)!;
              return (
                <li key={rec.id} className="rise-in">
                  <Link
                    href={`/escrow/${rec.id}`}
                    className="focus-ring panel group flex items-center gap-4 px-5 py-4 transition hover:border-line-strong"
                  >
                    <span className="pulse-dot h-2 w-2 shrink-0 rounded-full bg-warn" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] font-medium text-ink">{action.text}</div>
                      <div className="label-mono mt-1 truncate">
                        ESCROW #{rec.id} · {rec.description}
                      </div>
                    </div>
                    <span className="data-mono hidden sm:inline">{fmtMon(rec.amount)} MON</span>
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
            {mine.map(({ rec, state }, i) => (
              <Link
                key={rec.id}
                href={`/escrow/${rec.id}`}
                className="focus-ring group grid grid-cols-[70px_1fr_auto] items-center gap-4 bg-surface-1 px-5 py-4 transition hover:bg-surface-2/50 sm:grid-cols-[70px_1fr_110px_130px_auto]"
              >
                <span className="data-mono !text-ink-3">#{rec.id}</span>
                <div className="min-w-0">
                  <div className="truncate text-[14px] text-ink">{rec.description}</div>
                  <div className="label-mono mt-0.5">
                    {addr && rec.buyer?.toLowerCase() === addr.toLowerCase() ? "YOU ARE BUYER" : "YOU ARE SELLER"}
                    {state && state.status !== 4 && state.deliveryDeadline > 0n && (
                      <> · DEADLINE {timeLeft(state.deliveryDeadline)}</>
                    )}
                  </div>
                </div>
                <span className="data-mono hidden text-right sm:block">{fmtMon(rec.amount)} MON</span>
                <span className="hidden justify-end sm:flex">
                  {state && <StatusPill status={state.status} small />}
                </span>
                <Arrow />
                {i === mine.length - 1 && null}
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
            {others.slice(0, 6).map(({ rec, state }) => (
              <Link
                key={rec.id}
                href={`/escrow/${rec.id}`}
                className="focus-ring grid grid-cols-[70px_1fr_auto_auto] items-center gap-4 bg-surface-1 px-5 py-3.5 transition hover:bg-surface-2/50"
              >
                <span className="data-mono !text-ink-4">#{rec.id}</span>
                <div className="truncate text-[13.5px] text-ink-2">{rec.description}</div>
                <span className="data-mono hidden sm:inline">{fmtMon(rec.amount)} MON</span>
                {state && <StatusPill status={state.status} small />}
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/** Computes the single next obligation for the viewing party, if any. */
function nextAction(rec: EscrowRecord, state: EscrowState | null, addr: string | null): { text: string } | null {
  if (!state || !addr) return null;
  const isBuyer = rec.buyer?.toLowerCase() === addr.toLowerCase();
  const isSeller = rec.seller?.toLowerCase() === addr.toLowerCase();
  const myEvidence = rec.evidence.find((e) => e.party.toLowerCase() === addr.toLowerCase());
  switch (state.status) {
    case 0: // Funded
      if (isSeller && !rec.txs.some((t) => t.label === "Marked delivered"))
        return { text: "Deliver the work, then mark it delivered" };
      if (isBuyer && !myEvidence) return { text: "Hold or release — you control the funds until delivery" };
      return null;
    case 1: // Delivered
      if (isBuyer) return { text: "Review the delivery — release payment or open a dispute" };
      if (isSeller && !myEvidence) return { text: "Commit delivery evidence while things are calm" };
      return null;
    case 2: // Disputed
      if (!myEvidence) return { text: "Commit your evidence — the arbiter reviews what is on-chain" };
      return { text: "Evidence committed — request the arbiter's review" };
    case 3: {
      const approvedMine = rec.approvals.some((a) => a.party.toLowerCase() === addr.toLowerCase());
      if (!approvedMine) return { text: "Approve or reject the arbiter's ruling — approval window is open" };
      return { text: "Waiting for the counterparty to approve the ruling" };
    }
    default:
      return null;
  }
}

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

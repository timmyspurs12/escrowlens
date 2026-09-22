"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { readEscrowAll, scanEvents, buildIndex, type EscrowState } from "@/lib/escrow";
import { fmtMon, fmtDateUTC, shortenAddress } from "@/lib/format";
import { StatusPill, EmptyState, SectionLabel } from "@/components/ui";

type Row = { state: EscrowState };

/**
 * Trust-record explorer: escrows first, chain data second.
 * Every row is derived from real contract events since the deploy block.
 */
export default function Explorer() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let live = true;
    readEscrowAll().then((states) => {
      if (live) setRows(states.map((state) => ({ state })).sort((a, b) => Number(b.state.id) - Number(a.state.id)));
    });
    return () => {
      live = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      ({ state }) =>
        state.id.toString() === needle.replace(/^#/, "") ||
        state.description?.toLowerCase().includes(needle) ||
        state.buyer.toLowerCase().includes(needle) ||
        state.seller.toLowerCase().includes(needle) ||
        state.buyerEvidenceHash.toLowerCase().includes(needle) ||
        state.sellerEvidenceHash.toLowerCase().includes(needle)
    );
  }, [rows, q]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <span className="label-mono">TRUST RECORD EXPLORER</span>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="title-xl">Every escrow, fully inspectable</h1>
          {rows && <span className="label-mono">{rows.length} ON RECORD · LIVE FROM CONTRACT STATE</span>}
        </div>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by escrow id, party address, description, or any hash…"
          spellCheck={false}
          className="focus-ring data-mono w-full rounded-[10px] border border-line bg-canvas px-4 py-3 text-[13.5px] text-ink placeholder:text-ink-4"
        />
      </header>

      {filtered === null ? (
        <div className="panel px-5 py-6">
          <span className="label-mono !text-ink-4">READING EVENTS SINCE DEPLOY BLOCK…</span>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title={q ? "NOTHING MATCHES THAT SEARCH" : "NO ESCROWS ON RECORD YET"}>
          {q
            ? "Try a shorter fragment — search covers ids, addresses, descriptions and hashes."
            : "The first protected transaction will appear here the moment it is funded."}
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          <SectionLabel>Escrows</SectionLabel>
          <div className="overflow-hidden rounded-[14px] border border-line">
            {filtered.map(({ state }) => (
              <Link
                key={state.id.toString()}
                href={`/escrow/${state.id}`}
                className="focus-ring group grid grid-cols-[64px_1fr_auto] items-center gap-4 bg-surface-1 px-5 py-4 transition hover:bg-surface-2/50 sm:grid-cols-[64px_1fr_120px_150px_auto]"
              >
                <span className="data-mono !text-ink-3">#{state.id.toString()}</span>
                <div className="min-w-0">
                  <div className="truncate text-[14px] text-ink">{state.description}</div>
                  <div className="label-mono mt-0.5 truncate">
                    {shortenAddress(state.buyer)} → {shortenAddress(state.seller)}
                    {state.status === 3 && <> · RULING AWAITING APPROVAL</>}
                    {state.status === 4 && <> · SETTLED</>}
                  </div>
                </div>
                <span className="data-mono hidden text-right sm:block">{fmtMon(state.amount)} MON</span>
                <span className="label-mono hidden lg:inline">
                  {state.deliveryDeadline > 0n ? `DEADLINE ${new Date(Number(state.deliveryDeadline) * 1000).toISOString().slice(0, 10)}` : ""}
                </span>
                <StatusPill status={state.status} small />
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-ink-4 transition group-hover:text-ink">
                  <path d="M5 2.5 9.5 7 5 11.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            ))}
          </div>
          <span className="label-mono !text-ink-4">
            DERIVED ENTIRELY FROM CONTRACT EVENTS · NO OFF-CHAIN INDEX, NOTHING TO TRUST BUT THE CHAIN
          </span>
        </div>
      )}
    </div>
  );
}

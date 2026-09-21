"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { scanEvents, buildIndex, readEscrow, type EscrowRecord, type EscrowState } from "@/lib/escrow";
import { fmtMon, fmtDateUTC, shortenAddress } from "@/lib/format";
import { StatusPill, EmptyState, SectionLabel } from "@/components/ui";

type Row = { rec: EscrowRecord; state: EscrowState | null };

/**
 * Trust-record explorer: escrows first, chain data second.
 * Every row is derived from real contract events since the deploy block.
 */
export default function Explorer() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let live = true;
    (async () => {
      const events = await scanEvents();
      const idx = buildIndex(events);
      const detailed = await Promise.all(
        [...idx.values()].sort((a, b) => b.id - a.id).map(async (rec) => ({ rec, state: await readEscrow(BigInt(rec.id)) }))
      );
      if (live) setRows(detailed);
    })();
    return () => {
      live = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const needle = q.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter(
      ({ rec, state }) =>
        String(rec.id) === needle.replace(/^#/, "") ||
        rec.description?.toLowerCase().includes(needle) ||
        rec.buyer?.toLowerCase().includes(needle) ||
        rec.seller?.toLowerCase().includes(needle) ||
        rec.evidence.some((e) => e.hash.toLowerCase().includes(needle)) ||
        rec.ruling?.rulingHash.toLowerCase().includes(needle) ||
        rec.txs.some((t) => t.txHash.toLowerCase().includes(needle)) ||
        state?.buyer.toLowerCase() === needle ||
        state?.seller.toLowerCase() === needle
    );
  }, [rows, q]);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-4">
        <span className="label-mono">TRUST RECORD EXPLORER</span>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h1 className="title-xl">Every escrow, fully inspectable</h1>
          {rows && <span className="label-mono">{rows.length} ON RECORD</span>}
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
            {filtered.map(({ rec, state }) => (
              <Link
                key={rec.id}
                href={`/escrow/${rec.id}`}
                className="focus-ring group grid grid-cols-[64px_1fr_auto] items-center gap-4 bg-surface-1 px-5 py-4 transition hover:bg-surface-2/50 sm:grid-cols-[64px_1fr_120px_150px_auto]"
              >
                <span className="data-mono !text-ink-3">#{rec.id}</span>
                <div className="min-w-0">
                  <div className="truncate text-[14px] text-ink">{rec.description}</div>
                  <div className="label-mono mt-0.5 truncate">
                    {shortenAddress(rec.buyer ?? "")} → {shortenAddress(rec.seller ?? "")}
                    {rec.ruling && <> · RULING RECORDED</>}
                    {rec.settlement && <> · {rec.settlement.outcome}</>}
                  </div>
                </div>
                <span className="data-mono hidden text-right sm:block">{fmtMon(rec.amount)} MON</span>
                <span className="label-mono hidden lg:inline">
                  {rec.createdAt ? `BLOCK ${rec.createdAt}` : ""}
                </span>
                {state ? <StatusPill status={state.status} small /> : <span />}
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

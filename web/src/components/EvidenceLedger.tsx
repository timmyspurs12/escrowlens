"use client";

import type { EscrowRecord } from "@/lib/escrow";
import { HashChip, TxRef, TrustSignal } from "./ui";
import { isZeroHash } from "@/lib/format";

/**
 * EvidenceLedger — a financial audit trail, not file cards.
 * Each row: who, when, what hash, where it is recorded.
 */
export function EvidenceLedger({
  record,
  buyer,
  seller,
}: {
  record: EscrowRecord | null;
  buyer?: string;
  seller?: string;
}) {
  const items = record?.evidence ?? [];
  const partyOf = (addr: string) => {
    if (buyer && addr.toLowerCase() === buyer.toLowerCase()) return "BUYER";
    if (seller && addr.toLowerCase() === seller.toLowerCase()) return "SELLER";
    return "PARTY";
  };

  return (
    <div className="overflow-hidden rounded-[10px] border border-line">
      <div className="grid grid-cols-[52px_1fr_1fr] gap-x-4 hairline-b bg-surface-2/60 px-4 py-2.5">
        <span className="label-mono">#</span>
        <span className="label-mono">Party · Submitted</span>
        <span className="label-mono">Evidence hash · Record</span>
      </div>
      {items.length === 0 && (
        <div className="px-4 py-6 text-sm text-ink-3">
          No evidence has been committed yet. Hashes submitted by either party will appear here.
        </div>
      )}
      {items.map((it, i) => (
        <div
          key={`${it.txHash}-${i}`}
          className="rise-in grid grid-cols-[52px_1fr_1fr] items-center gap-x-4 hairline-b px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-2/40"
        >
          <span className="data-mono !text-ink-4">{String(i + 1).padStart(2, "0")}</span>
          <div className="flex flex-col gap-0.5">
            <TrustSignal tone={partyOf(it.party) === "BUYER" ? "signal" : "ok"}>{partyOf(it.party)}</TrustSignal>
            <span className="label-mono !text-ink-4">BLOCK {it.blockNumber}</span>
          </div>
          <div className="flex flex-col items-start gap-0.5">
            <HashChip hash={it.hash} />
            <TxRef txHash={it.txHash} label="RECORD" />
          </div>
        </div>
      ))}
      {items.length > 0 && (
        <div className="flex items-center justify-between bg-surface-2/40 px-4 py-2">
          <span className="label-mono !text-ink-4">
            COMBINED EVIDENCE HASH BINDS BOTH PARTIES INTO THE SIGNED RULING
          </span>
          {record && <TrustSignal tone="ok">ON-CHAIN</TrustSignal>}
        </div>
      )}
      {items.length === 0 && buyer && (
        <div className="px-4 py-2">
          {isZeroHash(record?.dispute?.evidenceHash) && (
            <span className="label-mono !text-ink-4">AWAITING FIRST COMMITMENT</span>
          )}
        </div>
      )}
    </div>
  );
}

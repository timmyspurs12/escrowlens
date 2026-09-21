"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { scanEvents, buildIndex, readEscrow, readArbiter, type EscrowRecord, type EscrowState } from "@/lib/escrow";
import type { SignedAnalysis } from "@/lib/arbiter-server";
import { fmtMon } from "@/lib/format";
import { ArbitrationPanel } from "@/components/ArbitrationPanel";
import { AddressChip, ActionButton, Callout, EmptyState, SectionLabel } from "@/components/ui";

/**
 * Arbiter console — the arbitration instrument's operator view.
 * Anyone can request a review; only party transactions can publish.
 */
export default function ArbiterConsole() {
  const [disputed, setDisputed] = useState<{ rec: EscrowRecord; state: EscrowState }[] | null>(null);
  const [arbiter, setArbiter] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<SignedAnalysis | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    readArbiter().then(setArbiter);
    (async () => {
      const events = await scanEvents();
      const idx = buildIndex(events);
      const rows: { rec: EscrowRecord; state: EscrowState }[] = [];
      for (const rec of [...idx.values()].sort((a, b) => b.id - a.id)) {
        const st = await readEscrow(BigInt(rec.id));
        if (st?.status === 2) rows.push({ rec, state: st });
      }
      setDisputed(rows);
    })();
  }, []);

  async function run(id: number) {
    setBusy(true);
    setError(null);
    setAnalysis(null);
    setSelected(id);
    try {
      const res = await fetch("/api/arbiter/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escrowId: id }),
      });
      const data = await res.json();
      if (!res.ok) setError(data.error ?? "The arbitration review failed.");
      else setAnalysis(data as SignedAnalysis);
    } catch {
      setError("The arbitration service could not be reached.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <header>
        <span className="label-mono">ARBITRATION REVIEW CONSOLE</span>
        <h1 className="title-xl mt-1.5">Arbiter</h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink-2">
          The arbiter is an instrument, not a participant: it reads the immutable escrow terms, weighs
          each party&apos;s statement, and signs an EIP-712 recommendation. It holds no keys to the
          funds and cannot execute anything — a party must record the ruling, and both parties must
          approve before the contract settles.
        </p>
        {arbiter && (
          <div className="mt-3 flex items-center gap-3">
            <AddressChip address={arbiter} label="SIGNING KEY" />
          </div>
        )}
      </header>

      <section className="flex flex-col gap-3">
        <SectionLabel>Escrows in dispute</SectionLabel>
        {disputed === null ? (
          <div className="panel px-5 py-5">
            <span className="label-mono !text-ink-4">SCANNING DISPUTE EVENTS…</span>
          </div>
        ) : disputed.length === 0 ? (
          <EmptyState title="NO DISPUTES ON RECORD">
            When either party opens a dispute, the escrow appears here for arbitration review.
          </EmptyState>
        ) : (
          <ul className="flex flex-col gap-2">
            {disputed.map(({ rec, state }) => (
              <li key={rec.id} className="panel flex flex-wrap items-center gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <div className="label-mono">ESCROW #{rec.id} · {fmtMon(rec.amount)} MON</div>
                  <div className="mt-0.5 truncate text-[14px] text-ink">{rec.description}</div>
                </div>
                <div className="label-mono !text-ink-4">
                  {rec.evidence.length} EVIDENCE {rec.evidence.length === 1 ? "ITEM" : "ITEMS"}
                </div>
                <ActionButton tone="quiet" onClick={() => run(rec.id)} busy={busy && selected === rec.id}>
                  {selected === rec.id && busy ? "Reviewing…" : "Run review"}
                </ActionButton>
                <Link href={`/escrow/${rec.id}`} className="focus-ring label-mono rounded !text-signal hover:!text-ink">
                  OPEN →
                </Link>
                {state.status !== 2 && <span className="label-mono !text-ink-4">STATE CHANGED</span>}
              </li>
            ))}
          </ul>
        )}
      </section>

      {error && (
        <Callout tone="warn" title="REVIEW NOT COMPLETED">
          {error}
          <div className="mt-1.5 text-[12.5px] text-ink-3">
            Parties&apos; statements live in their browsers and are attached when a party requests the
            review from the escrow page — this console review runs on on-chain terms alone.
          </div>
        </Callout>
      )}

      {analysis && (
        <section className="flex flex-col gap-4">
          <SectionLabel right={<span className="label-mono !text-ink-4">ESCROW #{analysis.ruling.escrowId}</span>}>
            Signed recommendation
          </SectionLabel>
          <ArbitrationPanel analysis={analysis} arbiterAddress={arbiter} />
          <div className="panel px-5 py-4 text-[13px] leading-relaxed text-ink-2">
            Next step happens on the escrow page: a party publishes this ruling (their signature counts
            as approval), then the counterparty approves. Publication and execution are party
            transactions only.{" "}
            <Link href={`/escrow/${analysis.ruling.escrowId}`} className="label-mono !text-signal">
              GO TO ESCROW #{analysis.ruling.escrowId} →
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

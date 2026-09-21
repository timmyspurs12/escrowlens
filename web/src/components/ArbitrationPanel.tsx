"use client";

import type { SignedAnalysis } from "@/lib/arbiter-server";
import { RULING_LABEL_STR, bpsToPct } from "@/lib/format";
import { HashChip, SectionLabel, TrustSignal, TxRef } from "./ui";

const FINDING_ICON = {
  satisfied: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6.2 4.8 9 10 3.2" stroke="#3ecf8e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ),
  partial: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6h7" stroke="#e5b567" strokeWidth="1.6" strokeLinecap="round"/></svg>
  ),
  unmet: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.6 2.6 9.4 9.4M9.4 2.6 2.6 9.4" stroke="#e5584f" strokeWidth="1.5" strokeLinecap="round"/></svg>
  ),
  unknown: (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.4" stroke="#667081" strokeWidth="1.3"/><path d="M4.6 4.9c0-.9.7-1.4 1.4-1.4s1.4.4 1.4 1.2c0 1.1-1.4 1.1-1.4 2.1" stroke="#667081" strokeWidth="1.1" strokeLinecap="round"/><circle cx="6" cy="8.5" r="0.6" fill="#667081"/></svg>
  ),
} as const;

/**
 * ArbitrationPanel — the AI presented as an arbitration instrument:
 * recommendation, findings, audit trail, cryptographic proof. Not a chat.
 */
export function ArbitrationPanel({
  analysis,
  rulingTx,
  arbiterAddress,
}: {
  analysis: SignedAnalysis | null;
  rulingTx?: string | null;
  arbiterAddress?: string | null;
}) {
  if (!analysis) return null;
  const v = analysis.verdict;

  return (
    <div className="rise-in flex flex-col gap-5 rounded-[14px] border border-line bg-surface-1 p-5">
      {/* recommendation header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <SectionLabel>Arbitration review</SectionLabel>
          <div className="mt-2 font-mono text-[24px] font-medium tracking-tight text-ink">
            {RULING_LABEL_STR[v.rulingType]}
            {v.rulingType === "SPLIT" && <span className="text-ink-3"> · {bpsToPct(v.splitBps)} to seller</span>}
          </div>
        </div>
        <div className="text-right">
          <SectionLabel>
            <span className="text-right">Confidence</span>
          </SectionLabel>
          <div className="mt-2 font-mono text-[24px] font-medium tracking-tight text-ink">{v.confidence}%</div>
        </div>
      </div>

      <div className="hairline-t" />

      {/* findings */}
      <div className="flex flex-col gap-3">
        <SectionLabel>Findings</SectionLabel>
        {v.findings.map((f, i) => (
          <div key={i} className="grid grid-cols-[24px_1fr] items-start gap-3">
            <span className="mt-0.5 flex h-5 w-5 items-center justify-center">{FINDING_ICON[f.status]}</span>
            <div>
              <div className="flex flex-wrap items-baseline gap-x-2.5">
                <span className="label-mono">FINDING {String(i + 1).padStart(2, "0")}</span>
                <span className="text-[13.5px] font-medium text-ink">{f.title}</span>
                <span className="label-mono !text-ink-4">{f.status.toUpperCase()}</span>
              </div>
              <p className="mt-0.5 text-[13px] leading-relaxed text-ink-2">{f.detail}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="hairline-t" />

      {/* reasoning */}
      <div className="flex flex-col gap-2">
        <SectionLabel>Arbiter reasoning</SectionLabel>
        <p className="text-[13.5px] leading-relaxed text-ink-2">{v.reasoning}</p>
      </div>

      <div className="hairline-t" />

      {/* cryptographic status */}
      <div className="grid gap-2.5 sm:grid-cols-2">
        <div className="inset flex flex-col gap-1.5 px-3.5 py-3">
          <TrustSignal tone="ok">EIP-712 SIGNATURE VERIFIED</TrustSignal>
          <span className="label-mono !text-ink-4">SIG {analysis.signature.slice(0, 20)}…</span>
        </div>
        <div className="inset flex flex-col gap-1.5 px-3.5 py-3">
          <TrustSignal tone="signal">ARBITER {arbiterAddress ? arbiterAddress.slice(0, 10) + "…" : ""}</TrustSignal>
          <span className="label-mono !text-ink-4">MODEL {analysis.model.toUpperCase()} · {analysis.provider.toUpperCase()}</span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="label-mono !text-ink-4">
          THE ARBITER SIGNS A RECOMMENDATION. IT CANNOT MOVE ESCROWED FUNDS.
        </span>
        {rulingTx && <TxRef txHash={rulingTx} label="RECORDED" />}
      </div>
    </div>
  );
}

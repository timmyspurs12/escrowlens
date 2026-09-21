"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { verifyTypedData } from "viem";
import { fetchTrustRecord, readArbiter, EIP712_DOMAIN, EIP712_TYPES, CONTRACT, type EscrowState, type EscrowRecord } from "@/lib/escrow";
import { loadStatements } from "@/lib/statements";
import { useEscrowWrites } from "@/lib/wallet";
import type { SignedAnalysis } from "@/lib/arbiter-server";
import { fmtMon, fmtDateUTC, timeLeft, bpsToPct, RULING_LABEL, isZeroHash } from "@/lib/format";
import { StateRail } from "@/components/StateRail";
import { EvidenceLedger } from "@/components/EvidenceLedger";
import { ArbitrationPanel } from "@/components/ArbitrationPanel";
import { StatusPill, AddressChip, ActionButton, Callout, SectionLabel, TechnicalDetails, TxRef, TrustSignal, EmptyState } from "@/components/ui";

export default function EscrowDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const { user, authenticated } = usePrivy();
  const w = useEscrowWrites();
  const addr = user?.wallet?.address ?? null;

  const [state, setState] = useState<EscrowState | null>(null);
  const [record, setRecord] = useState<EscrowRecord | null>(null);
  const [approvals, setApprovals] = useState<[boolean, boolean]>([false, false]);
  const [arbiter, setArbiter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [analysis, setAnalysis] = useState<SignedAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [sigVerified, setSigVerified] = useState<boolean | null>(null);

  const refresh = useCallback(async () => {
    const t = await fetchTrustRecord(id);
    if (t) {
      setState(t.state);
      setRecord(t.record);
      setApprovals(t.approvals);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    refresh();
    readArbiter().then(setArbiter);
  }, [refresh]);

  // Watch the in-flight tx; refresh when it lands.
  useEffect(() => {
    if (w.txState === "done") {
      const t = setTimeout(refresh, 1500);
      return () => clearTimeout(t);
    }
  }, [w.txState, refresh]);

  const isBuyer = !!state && !!addr && state.buyer.toLowerCase() === addr.toLowerCase();
  const isSeller = !!state && !!addr && state.seller.toLowerCase() === addr.toLowerCase();
  const nowSec = Math.floor(Date.now() / 1000);

  const myEvidence = record?.evidence.find((e) => addr && e.party.toLowerCase() === addr.toLowerCase());

  async function requestAnalysis() {
    setAnalyzing(true);
    setAnalysisError(null);
    try {
      const res = await fetch("/api/arbiter/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ escrowId: id, ...loadStatements(id) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAnalysisError(data.error ?? "The arbitration review could not be completed.");
      } else {
        setAnalysis(data as SignedAnalysis);
        // Independent client-side verification of the arbiter signature.
        const r = (data as SignedAnalysis).ruling;
        const ok = await verifyTypedData({
          address: arbiter as `0x${string}`,
          domain: EIP712_DOMAIN,
          types: EIP712_TYPES,
          primaryType: "Ruling",
          message: {
            escrowId: BigInt(r.escrowId),
            buyer: r.buyer as `0x${string}`,
            seller: r.seller as `0x${string}`,
            amount: BigInt(r.amount),
            evidenceHash: r.evidenceHash as `0x${string}`,
            rulingType: r.rulingType,
            splitBps: r.splitBps,
            arbiterNonce: BigInt(r.arbiterNonce),
            expiry: BigInt(r.expiry),
          },
          signature: (data as SignedAnalysis).signature as `0x${string}`,
        });
        setSigVerified(ok);
      }
    } catch {
      setAnalysisError("The arbitration service could not be reached.");
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-5 w-40 animate-pulse rounded bg-surface-3" />
        <div className="h-24 animate-pulse rounded-[14px] bg-surface-1" />
        <div className="h-40 animate-pulse rounded-[14px] bg-surface-1" />
        <span className="label-mono !text-ink-4">READING ESCROW #{id} FROM THE CHAIN…</span>
      </div>
    );
  }

  if (!state) {
    return <EmptyState title={`ESCROW #${id} NOT FOUND`}>No escrow exists at this id on chain 10143, or the contract address is not configured.</EmptyState>;
  }

  const settledByRelease = record?.settlement?.outcome === "RELEASED_BY_BUYER";
  const approvalStates = [
    { party: state.buyer, role: "Buyer", approved: approvals[0] || (record?.approvals.some((a) => a.party.toLowerCase() === state.buyer.toLowerCase()) ?? false) },
    { party: state.seller, role: "Seller", approved: approvals[1] || (record?.approvals.some((a) => a.party.toLowerCase() === state.seller.toLowerCase()) ?? false) },
  ];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      {/* ── Header ── */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="label-mono">ESCROW #{state.id.toString()}</span>
            <StatusPill status={state.status} small />
          </div>
          <h1 className="title-xl mt-2 max-w-2xl">{state.description || "Untitled escrow"}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
            <AddressChip address={state.buyer} label="BUYER" />
            <AddressChip address={state.seller} label="SELLER" />
          </div>
        </div>
        <Link href="/dashboard" className="focus-ring label-mono rounded !text-ink-4 hover:!text-ink-2">← DASHBOARD</Link>
      </header>

      {/* ── Amount secured ── */}
      <section className="panel flex flex-wrap items-center justify-between gap-4 px-6 py-5">
        <div>
          <SectionLabel>Secured in escrow</SectionLabel>
          <div className="amount-hero mt-1.5">{fmtMon(state.amount)} <span className="text-[0.55em] text-ink-3">MON</span></div>
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="label-mono">DELIVERY DEADLINE</div>
          <div className="data-mono">{fmtDateUTC(state.deliveryDeadline)}</div>
          {state.status === 0 && (
            <TrustSignal tone={Number(state.deliveryDeadline) > nowSec ? "signal" : "warn"}>
              {Number(state.deliveryDeadline) > nowSec ? timeLeft(state.deliveryDeadline, nowSec).toUpperCase() : "DEADLINE PASSED — RELEASE TO SELLER CAN BE TRIGGERED"}
            </TrustSignal>
          )}
        </div>
      </section>

      {/* ── Lifecycle ── */}
      <section className="flex flex-col gap-4">
        <SectionLabel>Transaction state</SectionLabel>
        <div className="panel px-6 py-6">
          <StateRail status={state.status} released={settledByRelease} />
        </div>
      </section>

      {/* ── Evidence ledger ── */}
      <section className="flex flex-col gap-4">
        <SectionLabel right={<TrustSignal tone="signal">SHA-256 · CLIENT-SIDE HASHED</TrustSignal>}>Evidence ledger</SectionLabel>
        <EvidenceLedger record={record} buyer={state.buyer} seller={state.seller} />
      </section>

      {/* ── Dispute / arbitration ── */}
      {(state.status >= 2 || record?.dispute) && record?.dispute && (
        <section className="flex flex-col gap-4">
          <SectionLabel>Dispute record</SectionLabel>
          <div className="panel flex flex-wrap items-center justify-between gap-4 px-5 py-4">
            <div className="flex flex-col gap-1">
              <span className="label-mono !text-risk">DISPUTE OPENED BY {record.dispute.party.toLowerCase() === state.buyer.toLowerCase() ? "BUYER" : "SELLER"}</span>
              <span className="data-mono">AT {fmtDateUTC(record.dispute.openedAt)}</span>
            </div>
            <TxRef txHash={record.dispute.txHash} label="DISPUTE TX" />
          </div>
        </section>
      )}

      {state.status === 2 && (
        <section className="flex flex-col gap-4">
          <SectionLabel right={analysis && sigVerified !== null ? <TrustSignal tone={sigVerified ? "ok" : "risk"}>{sigVerified ? "SIGNATURE CHECKS OUT CLIENT-SIDE" : "SIGNATURE INVALID"}</TrustSignal> : undefined}>
            Arbitration review
          </SectionLabel>
          {!analysis && (
            <div className="panel flex flex-col items-start gap-4 px-5 py-5">
              <p className="max-w-xl text-[13.5px] leading-relaxed text-ink-2">
                An independent AI arbiter will read the on-chain terms and each party&apos;s statements,
                then sign a recommendation under EIP-712. The signature is verified here in your browser
                before anything is submitted. The arbiter cannot move funds — recording its ruling still
                requires a party transaction and both approvals.
              </p>
              <ActionButton onClick={requestAnalysis} busy={analyzing} disabled={analyzing}>
                {analyzing ? "Reviewing evidence…" : "Request arbitration review"}
              </ActionButton>
              {analyzing && (
                <div className="flex flex-col gap-1.5">
                  <span className="label-mono !text-ink-4">READING ESCROW STATE</span>
                  <span className="label-mono !text-ink-4">WEIGHING PARTY STATEMENTS</span>
                  <span className="label-mono !text-ink-4">PREPARING THE VERDICT</span>
                </div>
              )}
              {analysisError && (
                <Callout tone="warn" title="ARBITER UNAVAILABLE">
                  {analysisError}
                </Callout>
              )}
            </div>
          )}
          {analysis && (
            <div className="flex flex-col gap-4">
              <ArbitrationPanel analysis={analysis} arbiterAddress={arbiter} />
              {(isBuyer || isSeller) && (
                <div className="panel flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                  <div className="max-w-md text-[13px] leading-relaxed text-ink-2">
                    You are a party to this escrow. Publishing the ruling counts as{" "}
                    <span className="text-ink">your approval</span> of it. The counterparty must then
                    approve too — only then does the contract execute.
                  </div>
                  <ActionButton
                    onClick={async () => {
                      const r = analysis.ruling;
                      await w.submitRuling(
                        {
                          escrowId: BigInt(r.escrowId),
                          buyer: r.buyer,
                          seller: r.seller,
                          amount: BigInt(r.amount),
                          evidenceHash: r.evidenceHash,
                          rulingType: r.rulingType,
                          splitBps: r.splitBps,
                          arbiterNonce: BigInt(r.arbiterNonce),
                          expiry: BigInt(r.expiry),
                        },
                        analysis.signature
                      );
                    }}
                    busy={w.txState === "signing" || w.txState === "confirming"}
                  >
                    Publish ruling to contract
                  </ActionButton>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* ── Ruling pending: approval panel ── */}
      {state.status === 3 && (
        <section className="flex flex-col gap-4">
          <SectionLabel right={<TrustSignal tone="warn">WINDOW CLOSES {timeLeft(state.rulingDeadline, nowSec).toUpperCase()}</TrustSignal>}>
            Ruling awaiting dual approval
          </SectionLabel>
          <div className="panel flex flex-col gap-4 px-5 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-mono text-[20px] tracking-tight text-ink">
                  {RULING_LABEL[state.pendingRulingType]}
                  {state.pendingRulingType === 2 && <span className="text-ink-3"> · {bpsToPct(state.pendingSplitBps)} to seller</span>}
                </div>
                <div className="label-mono mt-1">
                  ON EXPIRY WITHOUT DUAL APPROVAL, THE FALLBACK REFUNDS THE BUYER
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {approvalStates.map((a) => (
                  <div key={a.party} className="flex items-center gap-2.5">
                    <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${a.approved ? "border-ok/60 bg-ok/15" : "border-line-strong"}`}>
                      {a.approved && (
                        <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M1.5 5.2 4 7.6 8.5 2.6" stroke="#3ecf8e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                      )}
                    </span>
                    <AddressChip address={a.party} label={a.role.toUpperCase()} />
                    <span className="label-mono !text-ink-4">{a.approved ? "APPROVED" : "AWAITING"}</span>
                  </div>
                ))}
              </div>
            </div>
            {(isBuyer || isSeller) && (
              <div className="flex flex-wrap items-center justify-between gap-3">
                {w.error && <span className="text-[13px] text-risk">{w.error}</span>}
                <ActionButton
                  onClick={() => w.approveRuling(state.id)}
                  busy={w.txState === "signing" || w.txState === "confirming"}
                  disabled={(() => {
                    const mine = addr?.toLowerCase() === state.buyer.toLowerCase() ? approvalStates[0].approved : approvalStates[1].approved;
                    return mine || !isBuyer && !isSeller;
                  })()}
                >
                  Approve ruling
                </ActionButton>
              </div>
            )}
            {isBuyer === false && isSeller === false && (
              <span className="label-mono !text-ink-4">ONLY THE TWO PARTIES CAN APPROVE — OBSERVERS CANNOT INTERVENE</span>
            )}
          </div>
        </section>
      )}

      {/* ── Actions by state ── */}
      {(isBuyer || isSeller) && state.status <= 1 && (
        <section className="flex flex-col gap-4">
          <SectionLabel>Your actions</SectionLabel>
          <div className="panel flex flex-wrap items-center gap-3 px-5 py-4">
            {isSeller && state.status === 0 && !record?.txs.some((t) => t.label === "Marked delivered") && (
              <ActionButton tone="quiet" onClick={() => w.markDelivered(state.id)} busy={w.txState === "signing" || w.txState === "confirming"}>
                Mark delivered
              </ActionButton>
            )}
            {isBuyer && state.status <= 1 && (
              <>
                <ActionButton onClick={() => w.releaseToSeller(state.id)} busy={w.txState === "signing" || w.txState === "confirming"}>
                  Release payment to seller
                </ActionButton>
                <Link href={`/escrow/${id}/dispute`}>
                  <ActionButton tone="quiet">Open a dispute</ActionButton>
                </Link>
              </>
            )}
            {isSeller && state.status >= 1 && !myEvidence && (
              <Link href={`/escrow/${id}/dispute`}>
                <ActionButton tone="quiet">Commit evidence</ActionButton>
              </Link>
            )}
            {!myEvidence && state.status <= 2 && (
              <span className="label-mono !text-ink-4">EVIDENCE CAN BE COMMITTED AT ANY POINT BEFORE OR DURING A DISPUTE</span>
            )}
          </div>
        </section>
      )}

      {/* ── Settlement receipt ── */}
      {state.status === 4 && record?.settlement && (
        <section className="flex flex-col gap-4">
          <SectionLabel>Settlement receipt</SectionLabel>
          <div className="panel rise-in flex flex-col gap-4 border-ok/25 px-6 py-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <TrustSignal tone="ok">ESCROW {record.settlement.outcome}</TrustSignal>
              <TxRef txHash={record.settlement.txHash} label="SETTLEMENT TX" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="inset px-4 py-3">
                <div className="label-mono">TO BUYER</div>
                <div className="data-mono mt-1 !text-[15px] !text-ink">{fmtMon(record.settlement.toBuyer)} MON</div>
              </div>
              <div className="inset px-4 py-3">
                <div className="label-mono">TO SELLER</div>
                <div className="data-mono mt-1 !text-[15px] !text-ink">{fmtMon(record.settlement.toSeller)} MON</div>
              </div>
            </div>
            {record.settlement.rulingType !== undefined && (
              <span className="label-mono !text-ink-4">
                EXECUTED RULING: {RULING_LABEL[record.settlement.rulingType]}
                {record.settlement.rulingType === 2 ? ` · ${bpsToPct(record.settlement.splitBps ?? 0)} TO SELLER` : ""}
              </span>
            )}
          </div>
        </section>
      )}

      {/* ── Timeout safety ── */}
      {state.status !== 4 && (
        <section className="flex flex-col gap-2">
          <TechnicalDetails>
            <div className="flex flex-col gap-1.5">
              <span>Delivery deadline passed with no dispute → anyone may call <span className="data-mono">expire()</span>; seller receives the full amount.</span>
              <span>Dispute unanswered for two dispute windows → anyone may call <span className="data-mono">fallbackResolveDispute()</span>; buyer is refunded.</span>
              <span>Ruling unapproved past its window → anyone may call <span className="data-mono">fallbackResolveRuling()</span>; buyer is refunded.</span>
              <span className="pt-1 text-ink-2">Contract {CONTRACT ? `${CONTRACT.slice(0, 14)}…` : "—"} · chain 10143</span>
            </div>
          </TechnicalDetails>
        </section>
      )}

      {/* ── Audit timeline ── */}
      {record && record.txs.length > 0 && (
        <section className="flex flex-col gap-4">
          <SectionLabel>Audit timeline</SectionLabel>
          <ol className="panel flex flex-col px-5 py-2">
            {record.txs.map((t, i) => (
              <li key={i} className="flex items-center justify-between gap-4 hairline-b py-3 last:border-b-0">
                <span className="flex items-center gap-3">
                  <span className="h-1 w-1 rounded-full bg-ink-4" />
                  <span className="text-[13.5px] text-ink-2">{t.label}</span>
                </span>
                <TxRef txHash={t.txHash} label="TX" />
              </li>
            ))}
          </ol>
        </section>
      )}

      {w.error && w.txState === "error" && (
        <Callout tone="risk" title="TRANSACTION NOT COMPLETED">
          {w.error}
        </Callout>
      )}
      {!authenticated && (
        <span className="label-mono !text-ink-4">SIGN IN TO ACT ON ESCROWS WHERE YOU ARE A PARTY</span>
      )}
    </div>
  );
}

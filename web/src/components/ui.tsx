"use client";

import { useState } from "react";
import { STATUS_META, EXPLORER_TX, EXPLORER_ADDR, shortenAddress, shortenHash } from "@/lib/format";

/* StatusPill — semantic color = state. */
export function StatusPill({ status, small }: { status: number; small?: boolean }) {
  const meta = STATUS_META[status] ?? { label: "UNKNOWN", tone: "neutral" as const };
  const tone: Record<string, string> = {
    neutral: "text-ink-3 border-line-strong",
    signal: "text-signal border-signal/35 bg-signal/8",
    warn: "text-warn border-warn/35 bg-warn/8",
    risk: "text-risk border-risk/35 bg-risk/8",
    ok: "text-ok border-ok/35 bg-ok/8",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-mono uppercase tracking-[0.12em] ${
        small ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]"
      } ${tone[meta.tone]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full bg-current ${status !== 4 ? "pulse-dot" : ""}`} />
      {meta.label}
    </span>
  );
}

/* AddressChip — identity is human-labeled, chain data is secondary. */
export function AddressChip({ address, label, full }: { address?: string | null; label?: string; full?: boolean }) {
  const [copied, setCopied] = useState(false);
  if (!address) return <span className="data-mono text-ink-4">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      {label && <span className="label-mono !tracking-[0.1em]">{label}</span>}
      <span className="data-mono">{full ? address : shortenAddress(address)}</span>
      <button
        aria-label="Copy address"
        className="focus-ring rounded p-0.5 text-ink-4 transition hover:text-ink-2"
        onClick={() => {
          navigator.clipboard.writeText(address);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
      >
        {copied ? (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6.5 4.8 9.2 10 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><rect x="3.5" y="3.5" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.1"/><path d="M8.5 3.5v-1a1 1 0 0 0-1-1h-5a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h1" stroke="currentColor" strokeWidth="1.1"/></svg>
        )}
      </button>
      <a
        href={EXPLORER_ADDR(address)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="View on explorer"
        className="focus-ring rounded p-0.5 text-ink-4 transition hover:text-signal"
      >
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M5 1.5H2.2A1.2 1.2 0 0 0 1 2.7v7.1A1.2 1.2 0 0 0 2.2 11h7.1a1.2 1.2 0 0 0 1.2-1.2V7M7.2 1h3.8v3.8M11 1 5.8 6.2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </a>
    </span>
  );
}

/* HashChip — evidence integrity, quietly verified. */
export function HashChip({ hash, label }: { hash?: string | null; label?: string }) {
  const [copied, setCopied] = useState(false);
  if (!hash) return <span className="data-mono text-ink-4">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      {label && <span className="label-mono !tracking-[0.1em]">{label}</span>}
      <span className="data-mono">{shortenHash(hash)}</span>
      <button
        aria-label="Copy hash"
        className="focus-ring rounded p-0.5 text-ink-4 transition hover:text-ink-2"
        onClick={() => {
          navigator.clipboard.writeText(hash);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
      >
        {copied ? (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6.5 4.8 9.2 10 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
        ) : (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><rect x="3.5" y="3.5" width="7" height="7" rx="1.2" stroke="currentColor" strokeWidth="1.1"/><path d="M8.5 3.5v-1a1 1 0 0 0-1-1h-5a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h1" stroke="currentColor" strokeWidth="1.1"/></svg>
        )}
      </button>
    </span>
  );
}

/* TxRef — a consequential action, permanently recorded. */
export function TxRef({ txHash, label }: { txHash?: string | null; label?: string }) {
  if (!txHash) return null;
  return (
    <a
      href={EXPLORER_TX(txHash)}
      target="_blank"
      rel="noopener noreferrer"
      className="focus-ring inline-flex items-center gap-1.5 rounded text-signal transition hover:text-ink"
    >
      <span className="label-mono !text-signal">{label ?? "TX"}</span>
      <span className="data-mono !text-signal">{shortenHash(txHash)}</span>
    </a>
  );
}

/* SectionLabel — structure without decoration. */
export function SectionLabel({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="label-mono">{children}</span>
      {right}
    </div>
  );
}

/* Callout — calm system voice for outcomes. */
export function Callout({
  tone = "neutral",
  title,
  children,
}: {
  tone?: "neutral" | "ok" | "warn" | "risk" | "signal";
  title: string;
  children?: React.ReactNode;
}) {
  const toneMap = {
    neutral: "border-line-strong text-ink-2",
    ok: "border-ok/30 text-ok",
    warn: "border-warn/30 text-warn",
    risk: "border-risk/30 text-risk",
    signal: "border-signal/30 text-signal",
  } as const;
  return (
    <div className={`rise-in rounded-[10px] border bg-surface-1 px-4 py-3.5 ${toneMap[tone]}`}>
      <div className="label-mono !tracking-[0.12em]">{title}</div>
      {children && <div className="mt-1.5 text-sm leading-relaxed text-ink-2">{children}</div>}
    </div>
  );
}

/* Technical details — advanced info one click away, never in the way. */
export function TechnicalDetails({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="inset overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="focus-ring flex w-full items-center justify-between px-4 py-2.5 text-left transition hover:bg-surface-2"
      >
        <span className="label-mono">Technical details</span>
        <span className={`text-ink-4 transition-transform ${open ? "rotate-180" : ""}`}>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M1.5 3.5 5 7l3.5-3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
        </span>
      </button>
      {open && <div className="border-t border-line px-4 py-3 text-[12.5px] leading-relaxed text-ink-3">{children}</div>}
    </div>
  );
}

/* TrustSignal — small verified/attn marks with meaning. */
export function TrustSignal({ tone, children }: { tone: "ok" | "warn" | "risk" | "signal"; children: React.ReactNode }) {
  const map = { ok: "text-ok", warn: "text-warn", risk: "text-risk", signal: "text-signal" } as const;
  const icon = {
    ok: <path d="M1.5 6 4 8.5 9 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />,
    warn: <path d="M5.5 1.8v4.4M5.5 8.4v.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />,
    risk: <path d="M2.2 2.2 8.8 8.8M8.8 2.2 2.2 8.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />,
    signal: <path d="M5.5 1 2 6h3l-.5 4L8.5 5h-3L5.5 1Z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" />,
  };
  return (
    <span className={`inline-flex items-center gap-1.5 ${map[tone]}`}>
      <svg width="11" height="11" viewBox="0 0 11 11" fill="none">{icon[tone]}</svg>
      <span className="label-mono !tracking-[0.1em]">{children}</span>
    </span>
  );
}

/*ActionButton — the primary instrument of consequence. */
export function ActionButton({
  tone = "primary",
  busy,
  disabled,
  onClick,
  children,
}: {
  tone?: "primary" | "quiet" | "danger";
  busy?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  const styles = {
    primary: "bg-ink text-canvas hover:bg-white disabled:bg-ink/30",
    quiet: "border border-line-strong bg-transparent text-ink hover:bg-surface-2",
    danger: "border border-risk/40 bg-risk/10 text-risk hover:bg-risk/20",
  } as const;
  return (
    <button
      onClick={onClick}
      disabled={disabled || busy}
      className={`focus-ring inline-flex h-10 items-center justify-center gap-2 rounded-[10px] px-5 text-[13.5px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${styles[tone]}`}
    >
      {busy && (
        <svg className="animate-spin" width="13" height="13" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
          <path d="M12.5 7A5.5 5.5 0 0 0 7 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </button>
  );
}

/* EmptyState — informative, never generic. */
export function EmptyState({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="panel flex flex-col items-center gap-3 px-8 py-14 text-center">
      <svg width="30" height="30" viewBox="0 0 30 30" fill="none" className="text-ink-4">
        <circle cx="15" cy="15" r="12" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="15" cy="15" r="5.5" stroke="currentColor" strokeWidth="1.4" strokeDasharray="2.4 2.4" />
      </svg>
      <div className="label-mono">{title}</div>
      {children && <p className="max-w-sm text-sm leading-relaxed text-ink-3">{children}</p>}
      {action}
    </div>
  );
}

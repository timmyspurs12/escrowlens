"use client";

import { Status } from "@/lib/escrow";

const STAGES = [
  { id: 0, label: "Funded", hint: "Buyer deposited" },
  { id: 1, label: "Delivered", hint: "Seller marked delivery" },
  { id: 2, label: "Disputed", hint: "Evidence collection" },
  { id: 3, label: "Arbitration", hint: "Ruling awaiting approval" },
  { id: 4, label: "Settled", hint: "Funds distributed" },
] as const;

/**
 * StateRail — the escrow lifecycle as a chain of record.
 * Past stages go quiet, current stage is unmistakable, future stages wait.
 */
export function StateRail({ status, released }: { status: number; released?: boolean }) {
  return (
    <ol className="flex flex-col gap-0 md:flex-row md:items-start" aria-label="Escrow lifecycle">
      {STAGES.map((s, i) => {
        const past = s.id < status;
        const current = s.id === status;
        const settledSpecial = released && s.id === Status.Settled;
        return (
          <li key={s.id} className="flex flex-row items-center gap-3 md:flex-1 md:flex-col md:gap-2 md:text-center">
            <div className="flex items-center md:w-full md:flex-col">
              {/* marker */}
              <span
                aria-current={current ? "step" : undefined}
                className={`relative z-10 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition ${
                  current
                    ? "border-ink bg-ink"
                    : past || settledSpecial
                      ? "border-ok/60 bg-ok/15"
                      : "border-line-strong bg-surface-1"
                }`}
              >
                {current ? (
                  <span className="pulse-dot h-1.5 w-1.5 rounded-full bg-canvas" />
                ) : past || settledSpecial ? (
                  <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M1.5 5.2 4 7.6 8.5 2.6" stroke="#3ecf8e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
                ) : null}
              </span>
              {/* connector */}
              {i < STAGES.length - 1 && (
                <span
                  className={`h-px w-8 shrink-0 md:hidden ${
                    past ? "bg-ok/40" : "bg-line-strong"
                  }`}
                />
              )}
              {i < STAGES.length - 1 && (
                <span className={`hidden h-px w-full md:block ${past ? "bg-ok/40" : "bg-line-strong"}`} />
              )}
            </div>
            <div className="pb-3 md:pb-0">
              <div
                className={`text-[13px] font-medium ${
                  current ? "text-ink" : past || settledSpecial ? "text-ink-2" : "text-ink-4"
                }`}
              >
                {s.label}
              </div>
              <div className={`label-mono hidden md:block ${current ? "!text-ink-3" : "!text-ink-4"}`}>{s.hint}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

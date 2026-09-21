"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { parseEther, formatEther } from "viem";
import { useEscrowWrites } from "@/lib/wallet";
import { usePrivy } from "@privy-io/react-auth";
import { AddressChip, ActionButton, Callout, SectionLabel, TechnicalDetails, TxRef } from "@/components/ui";
import { fmtDateUTC } from "@/lib/format";

const HOUR = 3600n;
const DAY = 24n * HOUR;

export default function CreateEscrow() {
  const router = useRouter();
  const { authenticated } = usePrivy();
  const w = useEscrowWrites();

  const [step, setStep] = useState(1);
  const [seller, setSeller] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [deadlineHrs, setDeadlineHrs] = useState("72");
  const [windowHrs, setWindowHrs] = useState("48");

  const valid = useMemo(() => {
    const problems: string[] = [];
    if (!/^0x[0-9a-fA-F]{40}$/.test(seller)) problems.push("Seller must be a valid 0x address.");
    if (seller && (await0(seller) === "self")) problems.push("Seller cannot be your own address — use a counterparty.");
    if (description.trim().length < 8) problems.push("Describe the deal in at least 8 characters.");
    if (description.length > 280) problems.push("Description must be 280 characters or fewer (on-chain limit).");
    const amt = Number(amount);
    if (!(amt > 0)) problems.push("Amount must be greater than 0 MON.");
    if (!(Number(deadlineHrs) >= 1)) problems.push("Delivery deadline must be at least 1 hour.");
    if (!(Number(windowHrs) >= 1)) problems.push("Dispute window must be at least 1 hour.");
    return problems;
  }, [seller, description, amount, deadlineHrs, windowHrs]);

  const amountWei = useMemo(() => {
    try {
      return parseEther(amount || "0");
    } catch {
      return 0n;
    }
  }, [amount]);

  async function fund() {
    const hash = await w.createEscrow(
      seller,
      description.trim(),
      BigInt(Math.floor(Date.now() / 1000)) + BigInt(deadlineHrs) * HOUR,
      BigInt(windowHrs) * DAY / 24n * 1n === 0n ? 0n : BigInt(windowHrs) * HOUR,
      amountWei
    );
    if (hash) {
      // Find the new escrow id from the next count after confirmation
      setTimeout(() => router.push("/dashboard"), 1200);
    }
  }

  const addr = w.address;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <header>
        <span className="label-mono">NEW PROTECTED TRANSACTION</span>
        <h1 className="title-xl mt-1.5">Construct the escrow</h1>
      </header>

      {/* step rail */}
      <ol className="flex items-center gap-2" aria-label="Progress">
        {["Parties", "Deal", "Terms", "Review"].map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span className={`label-mono ${step > i + 1 ? "!text-ok" : step === i + 1 ? "!text-ink" : "!text-ink-4"}`}>
              {String(i + 1).padStart(2, "0")} {s.toUpperCase()}
            </span>
            {i < 3 && <span className="h-px w-6 bg-line-strong" />}
          </li>
        ))}
      </ol>

      {!authenticated ? (
        <Callout tone="neutral" title="SESSION REQUIRED">
          Sign in with your passkey first — your wallet becomes the buyer of this escrow.
        </Callout>
      ) : step === 1 && (
        <Section n={1} title="Who is trading?">
          <Field label="YOUR ROLE">
            <div className="inset px-4 py-3 text-[13.5px] text-ink-2">
              You are the <span className="text-ink">buyer</span> — you fund the escrow and release
              payment when satisfied. The seller delivers the work.
              {addr && <div className="mt-2"><AddressChip address={addr} label="FROM" /></div>}
            </div>
          </Field>
          <Field label="SELLER ADDRESS">
            <input
              value={seller}
              onChange={(e) => setSeller(e.target.value.trim())}
              placeholder="0x…"
              spellCheck={false}
              className="focus-ring data-mono w-full rounded-[10px] border border-line bg-canvas px-4 py-3 text-ink placeholder:text-ink-4"
            />
          </Field>
          <Nav onNext={() => setStep(2)} nextEnabled={/^0x[0-9a-fA-F]{40}$/.test(seller) && seller.toLowerCase() !== addr?.toLowerCase()} />
        </Section>
      )}

      {step === 2 && (
        <Section n={2} title="What is the deal?">
          <Field label="DESCRIPTION — BECOMES PART OF THE ON-CHAIN RECORD (280 CHARS MAX)">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={280}
              placeholder="e.g. Brand refresh: logo, palette and typography — final files by Friday"
              className="focus-ring w-full resize-none rounded-[10px] border border-line bg-canvas px-4 py-3 text-[13.5px] leading-relaxed text-ink placeholder:text-ink-4"
            />
            <div className="label-mono mt-1 text-right">{description.length}/280</div>
          </Field>
          <Nav onBack={() => setStep(1)} onNext={() => setStep(3)} nextEnabled={description.trim().length >= 8} />
        </Section>
      )}

      {step === 3 && (
        <Section n={3} title="What are the terms?">
          <Field label="AMOUNT — HELD IN CONTRACT, NOT SENT TO THE SELLER">
            <div className="relative">
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                placeholder="0.0"
                className="focus-ring data-mono w-full rounded-[10px] border border-line bg-canvas px-4 py-3 pr-14 text-[18px] text-ink placeholder:text-ink-4"
              />
              <span className="label-mono absolute right-4 top-1/2 -translate-y-1/2">MON</span>
            </div>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="DELIVERY DEADLINE (HOURS FROM NOW)">
              <input
                value={deadlineHrs}
                onChange={(e) => setDeadlineHrs(e.target.value.replace(/[^0-9]/g, ""))}
                inputMode="numeric"
                className="focus-ring data-mono w-full rounded-[10px] border border-line bg-canvas px-4 py-3 text-ink"
              />
              <div className="label-mono mt-1 !text-ink-4">
                PASSES SILENTLY → ANYONE CAN TRIGGER RELEASE TO SELLER
              </div>
            </Field>
            <Field label="DISPUTE WINDOW (HOURS)">
              <input
                value={windowHrs}
                onChange={(e) => setWindowHrs(e.target.value.replace(/[^0-9]/g, ""))}
                inputMode="numeric"
                className="focus-ring data-mono w-full rounded-[10px] border border-line bg-canvas px-4 py-3 text-ink"
              />
              <div className="label-mono mt-1 !text-ink-4">
                GOVERN RULING APPROVAL + TIMEOUT REFUNDS
              </div>
            </Field>
          </div>
          <Nav onBack={() => setStep(2)} onNext={() => setStep(4)} nextEnabled={Number(amount) > 0 && valid.length === 0} />
        </Section>
      )}

      {step === 4 && (
        <Section n={4} title="Review before funding">
          <div className="overflow-hidden rounded-[14px] border border-line">
            <ReviewRow k="Buyer (you)" v={<AddressChip address={addr} />} />
            <ReviewRow k="Seller" v={<AddressChip address={seller} />} />
            <ReviewRow k="Deal" v={description} />
            <ReviewRow k="Amount secured" v={<span className="data-mono !text-[15px] !text-ink">{formatEther(amountWei)} MON</span>} />
            <ReviewRow k="Delivery deadline" v={<span className="data-mono">{fmtDateUTC(BigInt(Math.floor(Date.now() / 1000)) + BigInt(deadlineHrs) * HOUR)}</span>} />
            <ReviewRow k="Dispute window" v={<span className="data-mono">{windowHrs} hours after any dispute or ruling</span>} />
          </div>

          <div className="flex flex-col gap-3">
            <Callout tone="signal" title="WHAT HAPPENS ON SIGNATURE">
              One transaction locks {formatEther(amountWei)} MON into the escrow contract. You can
              release it when satisfied; the seller can mark delivery; both parties can settle or
              dispute. No other party — including the arbiter — can move these funds.
            </Callout>
            {w.error && (
              <Callout tone="risk" title="TRANSACTION NOT COMPLETED">
                {w.error}
                <div className="mt-2"><TechnicalDetails><span className="data-mono">{w.error}</span></TechnicalDetails></div>
              </Callout>
            )}
            {w.txHash && (
              <Callout tone="ok" title="FUNDED — AWAITING CONFIRMATION">
                <TxRef txHash={w.txHash} label="FUND TX" /> — taking you to your dashboard…
              </Callout>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <ActionButton tone="quiet" onClick={() => setStep(3)} disabled={w.txState === "signing" || w.txState === "confirming"}>
              Back
            </ActionButton>
            <ActionButton
              onClick={fund}
              busy={w.txState === "signing" || w.txState === "confirming"}
              disabled={valid.length > 0 || w.txState === "done"}
            >
              {w.txState === "signing"
                ? "Approve in passkey…"
                : w.txState === "confirming"
                  ? "Confirming on Monad…"
                  : `Fund escrow · ${formatEther(amountWei)} MON`}
            </ActionButton>
          </div>
          {valid.length > 0 && (
            <div className="flex flex-col gap-1">
              {valid.map((p) => (
                <span key={p} className="label-mono !text-risk">{p.toUpperCase()}</span>
              ))}
            </div>
          )}
          <div className="mt-2 text-center">
            <Link href="/dashboard" className="focus-ring label-mono rounded !text-ink-4 hover:!text-ink-2">
              CANCEL — NOTHING IS SENT UNTIL YOU SIGN
            </Link>
          </div>
        </Section>
      )}
    </div>
  );
}

function await0(s: string) {
  return s.toLowerCase() === "self" ? "self" : "";
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="rise-in flex flex-col gap-5">
      <SectionLabel>
        {`STEP ${String(n).padStart(2, "0")}`} · <span className="!text-ink">{title.toUpperCase()}</span>
      </SectionLabel>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-2">
      <span className="label-mono">{label}</span>
      {children}
    </label>
  );
}

function ReviewRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="hairline-b grid grid-cols-[140px_1fr] items-center gap-4 bg-surface-1 px-5 py-3.5 last:border-b-0">
      <span className="label-mono">{k.toUpperCase()}</span>
      <span className="text-[13.5px] text-ink-2">{v}</span>
    </div>
  );
}

function Nav({ onBack, onNext, nextEnabled }: { onBack?: () => void; onNext?: () => void; nextEnabled: boolean }) {
  return (
    <div className="flex items-center justify-between">
      {onBack ? (
        <ActionButton tone="quiet" onClick={onBack}>Back</ActionButton>
      ) : (
        <span className="label-mono !text-ink-4">NO FUNDS MOVE IN THESE STEPS</span>
      )}
      {onNext && (
        <ActionButton onClick={onNext} disabled={!nextEnabled}>Continue</ActionButton>
      )}
    </div>
  );
}

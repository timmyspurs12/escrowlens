"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { fetchTrustRecord, type EscrowState } from "@/lib/escrow";
import { useEscrowWrites } from "@/lib/wallet";
import { saveStatement, sha256Hex } from "@/lib/statements";
import { AddressChip, ActionButton, Callout, SectionLabel, TechnicalDetails, TrustSignal } from "@/components/ui";
import { shortenHash } from "@/lib/format";

export default function DisputeFlow() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = Number(params.id);
  const w = useEscrowWrites();
  const { user } = usePrivy();
  const addr = user?.wallet?.address ?? null;

  const [state, setState] = useState<EscrowState | null>(null);
  const [claim, setClaim] = useState("");
  const [hash, setHash] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [hashing, setHashing] = useState(false);

  useEffect(() => {
    fetchTrustRecord(id).then((t) => t && setState(t.state));
  }, [id]);

  const isBuyer = state && addr && state.buyer.toLowerCase() === addr.toLowerCase();
  const isSeller = state && addr && state.seller.toLowerCase() === addr.toLowerCase();
  const party: "buyer" | "seller" | null = isBuyer ? "buyer" : isSeller ? "seller" : null;
  const inDispute = state?.status === 2;

  async function onFile(f: File | undefined) {
    if (!f) return;
    setHashing(true);
    try {
      const h = await sha256Hex(f);
      setHash(h);
      setFileName(f.name);
    } finally {
      setHashing(false);
    }
  }

  async function submit() {
    const evHash = hash ?? ("0x" + "0".repeat(64));
    saveStatement(id, party ?? "buyer", claim);
    if (inDispute) {
      if (await w.submitEvidence(BigInt(id), evHash as `0x${string}`)) router.push(`/escrow/${id}`);
    } else {
      if (await w.openDispute(BigInt(id), evHash as `0x${string}`)) router.push(`/escrow/${id}`);
    }
  }

  if (!state) {
    return <span className="label-mono !text-ink-4">READING ESCROW #{id}…</span>;
  }
  if (!party) {
    return (
      <Callout tone="neutral" title="PARTY ACTION ONLY">
        Only the buyer or seller of escrow #{id} can {inDispute ? "submit evidence" : "open a dispute"}.
        <div className="mt-2"><Link href={`/escrow/${id}`} className="label-mono !text-signal">← BACK TO ESCROW</Link></div>
      </Callout>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <header>
        <span className="label-mono !text-risk">ESCROW #{id} · ESCALATION</span>
        <h1 className="title-xl mt-2">{inDispute ? "Submit your evidence" : "Open a dispute"}</h1>
      </header>

      <Callout tone="neutral" title={inDispute ? "THIS ESCROW IS IN ARBITRATION" : "BEFORE YOU CONTINUE"}>
        {inDispute
          ? "The arbiter reviews what is committed on-chain. Add the evidence hash that supports your position, and a precise statement of what it shows."
          : "This escrow will enter arbitration. Commit the evidence that should be considered — once the arbiter signs a recommendation, both parties must approve before any funds move."}
      </Callout>

      {/* Claim */}
      <section className="flex flex-col gap-3">
        <SectionLabel>Your claim — what happened</SectionLabel>
        <textarea
          value={claim}
          onChange={(e) => setClaim(e.target.value)}
          rows={5}
          maxLength={4000}
          placeholder="Be specific and checkable: what was agreed, what was delivered, what is wrong. Concrete statements carry weight; adjectives do not."
          className="focus-ring w-full resize-none rounded-[10px] border border-line bg-canvas px-4 py-3 text-[13.5px] leading-relaxed text-ink placeholder:text-ink-4"
        />
        <span className="label-mono !text-ink-4">
          STORED ONLY IN THIS BROWSER · NEVER WRITTEN ON-CHAIN · SHARED WITH THE ARBITER AT REVIEW TIME
        </span>
      </section>

      {/* Evidence */}
      <section className="flex flex-col gap-3">
        <SectionLabel>Evidence — hashed before it enters the record</SectionLabel>
        <label className="inset focus-ring flex cursor-pointer flex-col items-center gap-2 px-5 py-6 text-center transition hover:border-line-strong">
          <input type="file" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} disabled={hashing} />
          <span className="label-mono">{hashing ? "COMPUTING SHA-256…" : "SELECT A FILE — ITS SHA-256 IS COMPUTED LOCALLY"}</span>
          {hash && (
            <span className="data-mono !text-ok">
              {shortenHash(hash, 14, 10)} {fileName ? `· ${fileName}` : ""}
            </span>
          )}
        </label>
        {hash && <TrustSignal tone="ok">HASH READY TO COMMIT — THE FILE ITSELF NEVER LEAVES YOUR DEVICE</TrustSignal>}
      </section>

      {/* Terms in question */}
      <section className="flex flex-col gap-3">
        <SectionLabel>Terms in question</SectionLabel>
        <div className="flex flex-col gap-2 rounded-[10px] border border-line bg-surface-1 px-4 py-3.5 text-[13px] text-ink-2">
          <span className="flex items-center gap-2"><Dot tone="ok" /> Delivery deadline · on-chain, immutable</span>
          <span className="flex items-center gap-2"><Dot tone="ok" /> Evidence binding · combined hash enters the signed ruling</span>
          <span className="flex items-center gap-2"><Dot tone="ok" /> Payment condition · moves only on dual approval</span>
        </div>
      </section>

      {w.error && (
        <Callout tone="risk" title="TRANSACTION NOT COMPLETED">{w.error}</Callout>
      )}

      <div className="flex items-center justify-between">
        <Link href={`/escrow/${id}`} className="focus-ring label-mono rounded !text-ink-4 hover:!text-ink-2">
          CANCEL
        </Link>
        <ActionButton
          tone={inDispute ? "primary" : "danger"}
          busy={w.txState === "signing" || w.txState === "confirming"}
          disabled={hashing || (!hash && !inDispute)}
          onClick={submit}
        >
          {inDispute ? "Submit evidence" : "Submit dispute"}
        </ActionButton>
      </div>

      {!inDispute && (
        <TechnicalDetails>
          Opening the dispute records your evidence hash and starts the dispute clock
          (openedAt + 2× dispute window). If the dispute is unresolved after that window,
          the fallback refunds the buyer — permissionlessly.
        </TechnicalDetails>
      )}
    </div>
  );
}

function Dot({ tone }: { tone: "ok" | "warn" }) {
  return <span className={`h-1.5 w-1.5 rounded-full ${tone === "ok" ? "bg-ok" : "bg-warn"}`} />;
}

"use client";

import { useEffect, useState } from "react";
import { readArbiter } from "@/lib/escrow";
import { EXPLORER_ADDR } from "@/lib/format";
import { AddressChip, Callout, SectionLabel, TrustSignal } from "@/components/ui";

/**
 * Agent identity — the arbiter's ERC-8004 page.
 * Facts only: registry addresses are the public good contracts; the agent
 * registration transaction is listed as pending until it is really mined.
 */
export default function Agent() {
  const [arbiter, setArbiter] = useState("");
  useEffect(() => {
    readArbiter().then(setArbiter);
  }, []);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      <header>
        <span className="label-mono">AGENT IDENTITY · ERC-8004</span>
        <h1 className="title-xl mt-1.5">The arbiter as a verifiable agent</h1>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-ink-2">
          EscrowLens&apos;s arbiter is designed to be discoverable and accountable through the
          ERC-8004 trustless-agent registries — a shared public good, so reputation attaches to the
          agent identity, not to this app.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <SectionLabel>Signing identity</SectionLabel>
        <div className="panel flex flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="flex flex-col gap-2">
            <AddressChip address={arbiter || undefined} label="ARBITER KEY" />
            <span className="label-mono !text-ink-4">SIGNS EIP-712 RECOMMENDATIONS · HOLDS NO FUNDS</span>
          </div>
          <TrustSignal tone="signal">ON-CHAIN IMMUTABLE IN CONSTRUCTOR</TrustSignal>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionLabel right={<TrustSignal tone="ok">VERIFIED LIVE ON CHAIN 10143</TrustSignal>}>
          Registries (shared public goods — not deployed by this app)
        </SectionLabel>
        <div className="overflow-hidden rounded-[14px] border border-line">
          <RegRow
            name="Identity Registry"
            addr="0x8004A818BFB912233c491871b3d84c89A494BD9e"
            role="Agent discovery: who exists, metadata, URIs"
          />
          <RegRow
            name="Reputation Registry"
            addr="0x8004B663056A597Dffe9eCcC1965A193B7388713"
            role="Feedback: signed client attestations with responses"
          />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionLabel>Registration status</SectionLabel>
        <Callout tone="warn" title="AGENT REGISTRATION — PENDING">
          The arbiter has not yet been registered on the registries above. Until the registration
          transaction is mined, this page deliberately claims no agent id or reputation. No metrics
          are displayed because none exist yet.
        </Callout>
      </section>

      <section className="flex flex-col gap-3">
        <SectionLabel>How accountability works here</SectionLabel>
        <div className="flex flex-col gap-2 text-[13.5px] leading-relaxed text-ink-2">
          <p>
            Every recommendation the arbiter signs is bound to one escrow: parties, amount, combined
            evidence hash and a per-escrow nonce — replay is impossible and every signature is
            attributable. The contract rejects any signature that is not from the immutable arbiter
            key above.
          </p>
          <p>
            Because rulings cannot move funds, a wrong or malicious arbiter can be ignored by the
            parties — the escrow still resolves through mutual approval or the permissionless
            timeouts. Reputation then records what happened through ERC-8004 feedback.
          </p>
        </div>
      </section>
    </div>
  );
}

function RegRow({ name, addr, role }: { name: string; addr: string; role: string }) {
  return (
    <div className="hairline-b flex flex-wrap items-center justify-between gap-3 bg-surface-1 px-5 py-4 last:border-b-0">
      <div>
        <div className="text-[14px] font-medium text-ink">{name}</div>
        <div className="label-mono mt-0.5">{role.toUpperCase()}</div>
      </div>
      <a
        href={EXPLORER_ADDR(addr)}
        target="_blank"
        rel="noopener noreferrer"
        className="focus-ring data-mono rounded !text-signal hover:text-ink"
      >
        {addr.slice(0, 12)}…{addr.slice(-6)}
      </a>
    </div>
  );
}

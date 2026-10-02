# The provider that failed was the feature: building a model-agnostic AI arbiter (Kimi K2 · Qwen · EIP-712)

*A real failure story from building EscrowLens, a passkey-native escrow protocol on Monad for the Metropolis hackathon — and why an AI provider hitting its quota ceiling mid-verification was the best thing that happened to the architecture.*

**Live app:** https://escrowlens.vercel.app · **Code (MIT):** https://github.com/timmyspurs12/escrowlens

---

## The setup: an AI that can advise but never move money

EscrowLens is peer-to-peer escrow where an AI arbiter reads the on-chain terms plus each party's statement and returns a structured verdict — ruling type (release buyer / release seller / split), confidence, numbered findings — which the server validates against a strict JSON schema and signs under **EIP-712**, bound to one escrow, one nonce, one expiry. The signature is what the contract verifies. The arbiter holds no funds and has no keys to them: recording its ruling still requires a party transaction and **both** approvals, or a permissionless timeout.

That division of labor creates an uncomfortable question every judge, user, and sane engineer should ask: *what happens when the model behind the arbiter is wrong, down, rate-limited, or — worse — its account runs dry?*

Our answer: the arbiter's **authority** is bounded by cryptography, so its **infrastructure** is allowed to be ordinary. Any single model can fail. The design assumes it.

## Where Kimi K2 sits in the machine

The arbiter is server-side only (keys never reach the browser) and deliberately **provider-agnostic**. Kimi (`kimi-k2.6`, Moonshot AI) ships as a first-class provider, selected by a single environment variable:

```ts
function providerOrder(): Provider[] {
  const pref = (process.env.LLM_PROVIDER ?? "kimi") as Provider;
  const all: Provider[] = ["kimi", "qwen", "openrouter"];
  return [pref, ...all.filter((x) => x !== pref)];
}
```

Each provider speaks the same OpenAI-compatible contract and must return the same verdict shape; the signer and the schema don't know or care which engine produced the text. Kimi was chosen as a default-first candidate for three concrete reasons:

1. **Long-context evidence bundles.** Disputes are documents — terms, deadlines, statements. `kimi-k2.6`'s context window swallows full evidence packages without the chopping that forces lossy summaries.
2. **Structured-output discipline.** The verdict must survive `JSON.parse` *and* a validator (rulingType enum, splitBps 0–10000, confidence 0–100, findings required, reasoning required). K2's instruction-following made it a strong candidate for zero-shot schema adherence at `temperature: 0`.
3. **Cost profile.** An arbiter that costs more than the dispute it resolves is not infrastructure. Kimi's pricing made per-dispute arbitration economically trivial — a requirement, not a nice-to-have, when escrow amounts can be a fraction of a token.

## The day the quota ran out — live, on a real dispute

During production verification on Monad testnet — escrow **#4**, a genuinely disputed escrow, read straight from the contract — we fired the arbiter. The provider chain did exactly what it was designed to do. Kimi's API authenticated, evaluated the request, and returned Moonshot's `exceeded_current_quota_error` (the account had hit its free ceiling — deliberate: this is a $0-budget build). Our fallback chain caught the failure, surfaced it transparently in the API response, and the next provider in the order served the verdict — which was then schema-validated and **EIP-712-signed with the arbiter's key**, nonce and expiry bound on-chain.

The raw attempts array from that call — preserved verbatim in our deployment log — reads like the design doc came to life:

```json
{ "error": "All configured arbiter providers failed.",
  "attempts": [
    { "provider": "kimi",  "error": "LLM_ERROR:kimi:..." },
    { "provider": "qwen",  "error": "NO_KEY:qwen" }
  ] }
```

That partial-failure transcript is a feature: the API never masks *which* engine failed or why. Operators see the truth; the schema guarantees the user still gets a verdict.

**The lesson we'd have paid to learn in production:** a single-model arbiter is a single point of failure wearing a lab coat. With the chain in place, a dead provider is a routing event, not an outage. Today Kimi remains one environment variable away from being the live engine (`LLM_PROVIDER=kimi` + key) — and because the verdict schema and the EIP-712 signature are engine-independent, switching costs are precisely zero. The same dispute, the same signing key, the same on-chain verification, whichever model wrote the reasoning.

## What Kimi brought to the project, concretely

- **It forced honest interface design.** Designing for K2 first meant the provider interface carries only what every serious model can honor: system prompt with the schema, `temperature: 0`, JSON out, validate hard, sign what survived. No provider-specific hacks to unwind later.
- **It proved graceful degradation with a real failure, not a mock.** The quota ceiling happened in production, on-chain, during verification. The arbiter degraded exactly as designed. You cannot buy that test.
- **It keeps the arbiter market-priced.** Because Kimi, Qwen, and others are hot-swappable, model pricing competition works *for* the protocol: routing can follow cost/quality without touching the trust layer.

## Try it

The full pipeline is live at **https://escrowlens.vercel.app** — pick a disputed escrow, request arbitration review, and watch the server read the chain, call the configured provider chain, validate the verdict, and sign it. Every ruling signature verifies against the arbiter key in your browser before anything is submitted; the contract settles nothing without both parties.

EscrowLens: *the AI advises. Dual approval decides.* And when a model falls over, the fall is caught — in writing, on-chain.

---

*Built for the Monad Metropolis hackathon (Track 04 — Trust / Identity & AI Infrastructure). Contract verified on Monad testnet: `0x11B24EC00A86069fBFbaC6ba20742acdff2B4cB7`. Arbiter registered as ERC-8004 agent #1918. Open source under MIT.*

# EscrowLens — Submission Form Pack (paste-ready)

Metropolis form, field by field. Copy from here. Nothing below contains secrets.

---

## FIELD 1 — Describe your project

**EscrowLens** is passkey-native peer-to-peer escrow on Monad testnet, with an AI arbiter that can advise but never touch money.

**The problem.** Every peer-to-peer deal — hardware sold on classifieds, freelance work, OTC crypto trades — runs on the same fear: the other side might not come through. Existing escrow services are custodial, slow, and opaque. Smart-contract escrow exists, but demands seed phrases, gas literacy, and blind trust in whoever resolves disputes.

**How it works.**
1. Sign in with a passkey — no seed phrase, no browser extension. Privy provisions a secure wallet behind the scenes.
2. One guided flow creates the escrow: item, amount, delivery deadline. Terms are identical for both sides; only a hash of the deal goes on-chain — plaintext evidence stays private.
3. Buyer funds the contract in a single Monad transaction (instant, fractions of a cent).
4. On delivery, the buyer releases. On disagreement, either party opens a dispute and both submit evidence — stored as commitment hashes, never plaintext.
5. The AI arbiter (server-side only) reads the on-chain state plus both statements, returns a structured verdict — ruling type, confidence, numbered findings — validated against a strict schema, then signs it with an EIP-712 signature bound to one escrow, one nonce, one expiry. Replay-proof.
6. The ruling executes only after **dual party approval** — the submitter's signature counts as approval one, the counterparty approves two. A permissionless timeout fallback guarantees funds can never be stuck.

**The trust architecture.** The arbiter is a registered ERC-8004 agent (#1918 on Monad's on-chain identity registry), so every signed ruling accumulates portable, verifiable reputation. The arbiter key is capability-bounded by the contract itself: it can sign recommendations; it cannot move escrowed funds. That line is enforced in Solidity, demonstrated live in the demo, and is the product's core promise: *the AI advises, dual approval decides.*

**What's live today (all verifiable):**
- Working app: https://escrowlens.vercel.app — landing, guided create flow, dashboard, dispute flow, public explorer, arbiter console
- One verified contract (Sourcify exact-match) on Monad testnet `0x11B24EC00A86069fBFbaC6ba20742acdff2B4cB7` with six real escrows covering every lifecycle path: funded, amicable release, timeout refund, and a full dispute arc settled by dual approval
- A real AI-arbitrated ruling generated end-to-end in production: on-chain read → evidence brief → model verdict → schema validation → EIP-712 signature
- Fully open source (MIT): https://github.com/timmyspurs12/escrowlens — deployment evidence and tx hashes tabulated in `docs/DEPLOYMENTS.md`

**Why Monad.** Instant finality and near-zero fees are what make fine-grained on-chain evidence and dual-approval settlement economical at consumer transaction sizes.

*(~2,450 characters)*

---

## FIELD 2 — Describe how you will reach your first users

**Beachhead: high-trust-gap P2P deals already settling in crypto.** The first users are people who already hold crypto and already take counterparty risk today: (1) buyers and sellers on classifieds platforms paying by bank transfer with zero protection, (2) freelance developers/designers dealing with first-time clients, (3) OTC traders in Telegram/X groups where "who goes first?" is the standing question. For them, EscrowLens is not a new behavior — it's a cheaper, neutral version of the middleman they already wish they had.

**Acquisition path:**
1. **Communities where the pain is loud.** Post the demo in Monad ecosystem channels, crypto-trading groups, and freelance communities, framed as "stop going first." The public explorer doubles as marketing: every real escrow is a shareable proof page.
2. **Build in public.** Short clips of the live AI ruling (the demo's climax scene) are inherently viral within crypto Twitter — "an AI that can judge your deal but can't touch your money" is a one-line hook.
3. **Judge-driven seed cohort.** Hackathon mentors, sponsors, and fellow builders become the first deliberate users — a natural fit since evaluation itself is a trust exercise.
4. **Two-sided onboarding that costs nothing.** New users need only a passkey; the faucet journey gets them testnet MON in seconds. Zero-friction trial, then value before any ask.
5. **Embeddable trust later.** Once validated, the escrow flow ships as a link/widget any marketplace or community group can attach to a deal — distribution through other people's platforms.

**Success measure for the first 100 users:** completed escrows with dual-approval settlement and zero support intervention — proof the guided flow and the dispute path work for people who are not the builder.

*(~1,750 characters)*

---

## FIELD 3 — Social links (public)

```
https://github.com/timmyspurs12/escrowlens
https://escrowlens.vercel.app
```

---

## FIELD 4 — Demo video (≤3:00, public link)

- [ ] Record per `docs/DEMO-SCRIPT.md` with `docs/vo/vo-master.mp3` (cue sheet inside)
- [ ] Upload YouTube (unlisted ok): title **"EscrowLens — AI-arbitrated passkey escrow on Monad (demo)"**
- [ ] First description line: `Track 04 — Trust / Identity & AI Infrastructure · Monad Metropolis. Live app: https://escrowlens.vercel.app · Code: https://github.com/timmyspurs12/escrowlens`
- [ ] Paste link here — **target Oct 10–11**

---

## FIELD 5 — Pitch video (≤2:00, PRIVATE to team/judges/organizers)

Different job than the demo: it introduces **you**, the problem, and the why. Structure (2:00):
- 0:00–0:20 Who I am + the fear every P2P deal runs on
- 0:20–0:50 Why existing options fail (custodial middlemen / unusable crypto UX / AI nobody trusts)
- 0:50–1:30 What I built and the design line that defines it (arbiter signs, dual approval moves)
- 1:30–2:00 Why me, why Monad, what's next

- [ ] Script me → record (can be webcam + screen) → upload → paste link

---

## FIELD 6 — Pitch text (private, 8,000 chars)

My name is Timi, I'm a solo builder from Nigeria, and I built EscrowLens because "who goes first?" is the question that kills honest deals. … *(personalized draft below — edit the name/background honestly before pasting)*

> I'm a solo developer, and I built this because I kept watching good deals die: people in my circle refuse to go first, and the middlemen who solve it charge fees and hold custody. Smart contracts fixed custody — but introduced seed phrases and, where disputes exist, opaque human or AI judgment. EscrowLens is my answer: passkey UX so onboarding is a fingerprint, a single audited contract so custody is code, and an AI arbiter whose power is bounded by the contract itself — it signs recommendations with EIP-712 and cannot move funds; dual approval settles everything. I built it end-to-end and for real: every lifecycle path is settled on Monad testnet with verifiable transactions, the arbiter is ERC-8004 agent #1918, and a production AI ruling has been generated and signed live. The build was AI-assisted (agent-implemented under my direction, disclosed in the README) — fitting, because the product's thesis is exactly this: AI earns trust when its authority is structurally bounded and its record is on-chain. Next: mainnet hardening, reputation accrual on the ERC-8004 rails, and an embeddable escrow link for communities and marketplaces.

*(edit name/background; ~950 chars — expand freely, room to 8k)*

---

## FIELD 7 — Bounties (click "Add bounty")

Add **Privy** and **Qwen**. Expected required questions + ready bullets:

**Privy** (passkey auth/wallets):
- EscrowLens uses Privy for passkey-native login and invisible wallet provisioning on Monad (chain configured in code, app id `NEXT_PUBLIC_PRIVY_APP_ID`); "Continue securely" → biometric → funded-by-faucet wallet in seconds. It is the reason a non-crypto user can reach a funded escrow without ever seeing a seed phrase.

**Qwen** (AI models):
- The arbiter pipeline calls Qwen-family models through an OpenAI-compatible layer (`LLM_PROVIDER=qwen`, DashScope endpoint) to produce schema-validated dispute verdicts, then signs them EIP-712 server-side. Provider-agnostic by design (kimi/qwen/openrouter fallback chain), with Qwen as the intended production engine. *(Select when Alibaba KYC clears; bounties reference usage, and our fallback chain currently serves Qwen-family models.)*

---

## FIELD 8 — Optional promotion clip (≤30s, doesn't affect judging)

Cut later from the demo: Scene 1 hook (0:00–0:12) + Scene 6 live-ruling moment (trimmed to ~12s) + one closing line. Skip until after the demo video is done.

---

## FINAL PRE-SEND CHECK

- [ ] Every URL https, every link opens incognito
- [ ] Demo link shows the working product (not slides)
- [ ] Form shows **COMPLETE, not draft** — screenshot it
- [ ] Submitted by **Oct 13, 11:59 PM ET / Oct 14, 04:59 WAT** (target: Oct 11)
- [ ] After submission: revoke `ghp_fTB9…` GitHub PAT + dead Vercel token

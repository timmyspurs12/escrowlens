# EscrowLens — Demo Video Production Script

**Target: 2:50 (10s under the 3:00 hard cap — Rules §4.1). Delivery: Loom or OBS→YouTube (unlisted acceptable, public safest). 1920×1080. Everything shown is REAL — no staging, no mocks, no fake data.**

---

## 0 · WHY THIS SCRIPT WINS

| Rules requirement | How this script satisfies it |
|---|---|
| Show the product actually operating | Every scene is live clicks on the production URL |
| Show real Monad blockchain interactions | Passkey wallet creation, fund tx signing, tx-hash click-through to Monad explorer, live contract reads, EIP-712 signature |
| ≤3:00 hard cap | 2:50 timed to the second, with cut list |
| Not slides/mockups | Zero slides. The only "graphics" are the app itself |
| Track 04 (Trust/Identity/AI) narrative | Passkeys → evidence privacy → bounded AI arbiter → ERC-8004 reputation |

**The one story to tell:** *"An AI can recommend — but only dual approval moves money. Watch me prove it live."*

---

## 1 · PRE-FLIGHT CHECKLIST (do once, ~30 min before recording)

### Technical
- [ ] **Warm the site**: open every URL below once and let data load (RPC caches make the recorded run fast):
  - `https://escrowlens.vercel.app/` (landing, counters loaded)
  - `/explorer` (6+ escrows visible)
  - `/escrow/6` (settled dispute arc)
  - `/escrow/4` (disputed — for the live AI shot)
  - `/agent` (ERC-8004 REGISTERED · 1918)
- [ ] **Pre-fire the AI call once** on `/escrow/4` — confirm a verdict returns. Free-tier models rotate; if all three fail with 502, wait 60s and retry. If it keeps failing, keep the last successful JSON in a pinned tab as emergency B-roll (Scene 6 fallback).
- [ ] **Passkey ready**: Windows Hello PIN/fingerprint enrolled so the Privy prompt is one clean touch.
- [ ] **Funded signer**: deployer wallet has MON for the on-camera fund tx (~0.26 MON needed max).
- [ ] **Tabs, in order, one window**: ① landing ② /escrow/new ③ /explorer ④ /escrow/6 ⑤ /escrow/4 ⑥ /agent ⑦ testnet.monadexplorer.com (address `0x11B2…4cB7` pasted in search, ready) ⑧ GitHub repo.
- [ ] **Browser**: F11 fullscreen; zoom 100%; hide bookmarks bar (Ctrl+Shift+B); DevTools NOT open (keep it clean).
- [ ] **Hide the "Activate Windows" watermark**: in OBS add Crop/Pad filter (Bottom 48px) on the display source, or crop in edit. In Loom: record a custom region excluding the bottom edge.
- [ ] **Notifications OFF**: Windows Focus Assist on; phone out of frame; Slack/email closed.
- [ ] **Recorder**: OBS 1080p30 + mic, or Loom screen+cam. Do one 30s test clip; check mic level and that text is crisp.

### You
- [ ] Read all narration ALOUD twice before recording (muscle memory beats reading on camera).
- [ ] Record each scene as a separate clip (OBS: pause between; Loom: separate bubbles). Editing joins them.
- [ ] Speak at ~140 wpm, slightly slower than feels natural. Smile on the first sentence only.

---

## 2 · THE SHOT LIST — 8 scenes, timed to the second

> **NARRATION = read verbatim. ACTION = what the mouse does. CUT = editor note.**

---

### SCENE 1 — THE HOOK · 0:00–0:12 (12s)

- **SCREEN:** Landing page, fully loaded. Counters visible. Mouse idle, then slow scroll half a viewport.
- **NARRATION (28 words):**
  > "Every peer-to-peer deal runs on the same fear — what if the other side doesn't come through? EscrowLens answers it with code, cryptography, and an AI arbiter that can't touch your money."
- **CUT:** Start on the hero line *"Funds stay locked until both sides agree"* — hold 3s before scrolling.

---

### SCENE 2 — PASSKEY LOGIN (TRUST PILLAR #1) · 0:12–0:32 (20s)

- **SCREEN:** Landing → click **"Continue securely"** → Privy passkey prompt → Windows Hello touch → dashboard/signed-in state.
- **ACTION:** Click login BEFORE narration starts, so the Hello prompt lands mid-sentence.
- **NARRATION (44 words):**
  > "This is EscrowLens, live on Monad testnet. There's no seed phrase to write down and no browser extension to install. I sign in with a passkey — biometrics I already trust — and a secure wallet is provisioned for me behind the scenes."
- **CUT:** If the Hello prompt takes >4s, cut/speed up to the signed-in moment.

---

### SCENE 3 — CREATE + FUND AN ESCROW (MONAD TX #1) · 0:32–0:56 (24s)

- **SCREEN:** `/escrow/new` guided flow. Fill: title ("Canon EOS R6 body"), amount (0.05 MON), counterparty address, delivery deadline (+2 days). Confirm → wallet tx popup → sign → "Funded" state.
- **NARRATION (54 words):**
  > "Creating an escrow is one guided flow: what's traded, how much, and a delivery deadline. Both sides see identical terms — the hash goes on-chain, the details stay private. I confirm with my passkey wallet, and the funds lock in a single transaction on Monad — instant, and costing fractions of a cent."
- **CUT:** Speed up the tx wait 2–4×. Land the cut exactly when the status flips to **FUNDED**.

---

### SCENE 4 — THE EXPLORER (NOTHING TO HIDE) · 0:56–1:12 (16s)

- **SCREEN:** `/explorer`. Slow scroll: every escrow row with its state chip — Funded, Delivered, Disputed, Settled. Hover one row.
- **NARRATION (36 words):**
  > "Everything lands in a public explorer — every escrow, every state, every commitment hash, read straight from the blockchain. Funded. Delivered. Disputed. Settled. Nothing here is a mockup; these are live contract reads."
- **CUT:** None. This is a breathing scene — let the viewer read the state chips.

---

### SCENE 5 — ESCROW #6: THE FULL DISPUTE ARC (MONAD TX PROOF) · 1:12–1:44 (32s)

- **SCREEN:** `/escrow/6`. Scroll the page top→bottom in this order: ① state rail (SETTLED) ② amount "SECURED IN ESCROW" ③ evidence ledger entries (buyer dispute, seller evidence) ④ arbiter instrument card — RECOMMENDATION, confidence, FINDING 01..N ⑤ **EXECUTED RULING** badge ⑥ click the settlement **tx hash** → Monad explorer tab (2s) → back.
- **NARRATION (72 words):**
  > "Escrow six ran the complete dispute arc for real. The buyer disputed, the seller submitted evidence, and the AI arbiter issued a signed recommendation. Then the rule that defines this product: both parties had to approve before anything moved. Buyer approved, seller approved — and only then did the contract execute the ruling. Every step is a transaction you can verify yourself on the Monad explorer — this hash, right here."
- **CUT:** The explorer click-through is your blockchain proof — never cut it short; hold the tab 2 full seconds.
- **TALKING POINT (if the card shows low confidence):** that's the point — *"notice the arbiter flags what it doesn't know instead of performing certainty."*

---

### SCENE 6 — THE LIVE AI RULING (THE CLIMAX) · 1:44–2:20 (36s)

- **SCREEN:** `/escrow/4` (genuinely in dispute). Click the **AI analysis** control → loading state → the **ArbitrationPanel** renders: RECOMMENDATION, CONFIDENCE, FINDING 01..N, and the **EIP-712 signature** — plus the panel line *"THE ARBITER SIGNS A RECOMMENDATION. IT CANNOT MOVE ESCROWED FUNDS."* End with the mouse pointing at that sentence.
- **NARRATION (82 words):**
  > "Now watch a brand-new AI ruling happen — live, right now. Escrow four is in genuine dispute. I request analysis: the server reads the contract state, builds an evidence brief, calls the model, validates the verdict against a strict schema, and signs it with the arbiter's key. That signature binds the arbiter to exactly one ruling, one escrow, one nonce — replay-proof. And here is the design line that matters: the arbiter signs a recommendation. It cannot move escrowed funds. Dual approval, or a permissionless timeout, settles — the AI only ever advises."
- **CUT:** Model latency can be 10–30s: speed up the wait 4–8× with a subtle zoom on the loading state. If ALL models fail on camera (502): use the emergency B-roll JSON tab and say "…and here's the signed verdict from the same endpoint moments ago." Honest, and still real.
- **WHY THIS SCENE WINS:** nobody else in the track shows a *signed EIP-712 AI recommendation generated live in the demo*. This is the moment judges remember.

---

### SCENE 7 — ERC-8004: THE ARBITER HAS AN IDENTITY · 2:20–2:34 (14s)

- **SCREEN:** `/agent` — REGISTERED · AGENT ID 1918, registration tx link.
- **NARRATION (31 words):**
  > "The arbiter itself is registered as an ERC-8004 agent — identity nineteen-eighteen on Monad's on-chain registry — so every ruling it signs accumulates into portable, verifiable reputation."
- **CUT:** None.

---

### SCENE 8 — CLOSE (WHY MONAD, WHY THIS WINS) · 2:34–2:50 (16s)

- **SCREEN:** Landing hero again (full circle), slow push-in (slight zoom in edit). End card 3s: repo URL over dimmed hero.
- **NARRATION (37 words):**
  > "EscrowLens: passkey-native UX, one audited contract, AI with strictly bounded authority, and a public trust trail. Built on Monad — because instant, near-zero-cost settlement is what makes on-chain evidence practical. Fully open source, every hash verifiable."
- **END CARD TEXT:** `github.com/timmyspurs12/escrowlens · escrowlens.vercel.app · Sourcify verified`

---

## 3 · POST-PRODUCTION (30 min)

1. **Join scenes in order**; total must be ≤2:55 (leave margin under the cap).
2. **Cut every dead air** >0.7s; speed up tx/model waits (2–8×) — never show a spinner longer than 4s.
3. **Captions ON** (Loom auto-captions, or YouTube auto + manual fix of crypto terms: EscrowLens, passkey, EIP-712, ERC-8004, arbiter, Monad). Most judges watch muted.
4. **Audio**: normalize to ≈ −16 LUFS; remove clicks/breaths at clip joins.
5. **Zoom punch-ins** (110–130%) on: the passkey prompt, FUNDED flip, state chips, arbiter card signature, "IT CANNOT MOVE ESCROWED FUNDS", agent 1918. Viewers must read the evidence.
6. **No background music** or extremely subtle — narration clarity wins.
7. Export 1080p MP4, ≤60fps, ~8 Mbps.

---

## 4 · EMERGENCY FALLBACK PLAYBOOK

| During recording… | Do this |
|---|---|
| AI call 502 (all free models busy) | Retry once off-camera → if still down, Scene 6 B-roll: pinned tab with the last 200 JSON verdict + narration as written ("from the same endpoint moments ago") |
| Fund tx hangs >30s | Speed up in edit; if truly stuck, use escrow #1's historical funded state and say "funding an escrow" in present tense |
| Passkey prompt fumbles/fails | Re-take just that scene; worst case narrate over a pre-captured screenshot of the Hello prompt (it's auth UX, not a blockchain interaction — acceptable) |
| RPC slow / counters empty | Warm reload off-camera, re-take; never show a broken state longer than 2s |
| You fumble a line | Pause 1s, say the sentence again from its start, continue — cut it in edit |

---

## 5 · UPLOAD + SUBMISSION CHECKLIST

- [ ] Upload **YouTube (unlisted)** — title: **"EscrowLens — AI-arbitrated passkey escrow on Monad (demo)"**
- [ ] Description first line: *"Track 04 — Trust / Identity & AI Infrastructure · Monad Metropolis. Live app: https://escrowlens.vercel.app · Code: https://github.com/timmyspurs12/escrowlens"*
- [ ] Chapters: `0:00 Problem · 0:12 Passkey login · 0:32 Create escrow · 0:56 Explorer · 1:12 Full dispute arc · 1:44 Live AI ruling · 2:20 ERC-8004 · 2:34 Close`
- [ ] Verify: video plays incognito, captions show, length ≤3:00
- [ ] Paste the link into the risein submission form; confirm the form shows COMPLETE (not draft) before Oct 13, 11:59 PM ET (= Oct 14, 04:59 WAT)
- [ ] After submission: revoke `ghp_fTB9…` (GitHub) and the dead Vercel token

---

## 6 · ONE-PAGE NARRATION ONLY (print this for the read-through)

1. Every peer-to-peer deal runs on the same fear — what if the other side doesn't come through? EscrowLens answers it with code, cryptography, and an AI arbiter that can't touch your money.
2. This is EscrowLens, live on Monad testnet. There's no seed phrase to write down and no browser extension to install. I sign in with a passkey — biometrics I already trust — and a secure wallet is provisioned for me behind the scenes.
3. Creating an escrow is one guided flow: what's traded, how much, and a delivery deadline. Both sides see identical terms — the hash goes on-chain, the details stay private. I confirm with my passkey wallet, and the funds lock in a single transaction on Monad — instant, and costing fractions of a cent.
4. Everything lands in a public explorer — every escrow, every state, every commitment hash, read straight from the blockchain. Funded. Delivered. Disputed. Settled. Nothing here is a mockup; these are live contract reads.
5. Escrow six ran the complete dispute arc for real. The buyer disputed, the seller submitted evidence, and the AI arbiter issued a signed recommendation. Then the rule that defines this product: both parties had to approve before anything moved. Buyer approved, seller approved — and only then did the contract execute the ruling. Every step is a transaction you can verify yourself on the Monad explorer — this hash, right here.
6. Now watch a brand-new AI ruling happen — live, right now. Escrow four is in genuine dispute. I request analysis: the server reads the contract state, builds an evidence brief, calls the model, validates the verdict against a strict schema, and signs it with the arbiter's key. That signature binds the arbiter to exactly one ruling, one escrow, one nonce — replay-proof. And here is the design line that matters: the arbiter signs a recommendation. It cannot move escrowed funds. Dual approval, or a permissionless timeout, settles — the AI only ever advises.
7. The arbiter itself is registered as an ERC-8004 agent — identity nineteen-eighteen on Monad's on-chain registry — so every ruling it signs accumulates into portable, verifiable reputation.
8. EscrowLens: passkey-native UX, one audited contract, AI with strictly bounded authority, and a public trust trail. Built on Monad — because instant, near-zero-cost settlement is what makes on-chain evidence practical. Fully open source, every hash verifiable.

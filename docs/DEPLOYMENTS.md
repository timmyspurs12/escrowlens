# EscrowLens — Deployment Record (real evidence only)

## EscrowLensEscrow — Monad Testnet (chain 10143)

| Field | Value |
|---|---|
| Date | 2026-09-21 |
| Contract | [`0x11B24EC00A86069fBFbaC6ba20742acdff2B4cB7`](https://testnet.monadexplorer.com/address/0x11B24EC00A86069fBFbaC6ba20742acdff2B4cB7) |
| Deploy tx | [`0x1f86bdb97e1e333754b80f4e618cdf53e087ac16d08f8312765c1a9680ceb7eb`](https://testnet.monadexplorer.com/tx/0x1f86bdb97e1e333754b80f4e618cdf53e087ac16d08f8312765c1a9680ceb7eb) |
| Block | 64,389,959 (0x3d68347) — receipt status `1 (success)` |
| Arbiter (immutable, constructor) | `0xd03a037b0EC873FDCE09e6035E8d706C597F80D4` — confirmed via on-chain `arbiter()` call |
| Deployer | `0x88c9B67106De5d6984DbF74c928c2D6B51F2620C` |
| RPC used | `https://testnet-rpc.monad.xyz` (chainId verified 10143) |
| Compiler | solc 0.8.28, `via_ir=true`, optimizer 1000 runs, EVM version prague |
| Tooling | forge 1.8.3, `forge script --network monad --broadcast --verify` |
| Verification | Sourcify **`exact_match`** — job `05eb5677-9da1-40bf-811a-83fd34728db8` (https://sourcify.dev/server/verify-ui/jobs/05eb5677-9da1-40bf-811a-83fd34728db8) |
| Constructor args | `0x…d03a037b0ec873fdce09e6035e8d706c597f80d4` (arbiter) |
| Runtime code | 8,062 bytes (`cast code` = 16,125 hex chars) |
| Initial `escrowCount()` | 0 (verified via RPC) |

Post-deploy on-chain checks (all via RPC, 2026-09-21):
- `cast code` non-empty at contract address ✓
- `arbiter()` → `0xd03a037b0EC873FDCE09e6035E8d706C597F80D4` ✓
- `escrowCount()` → `0` ✓
- Deployer balance after: 4.7459 MON (deploy cost ≈ 0.254 MON)

Notes:
- Arbiter key signs EIP-712 rulings off-chain only; it holds no funds and the
  contract exposes no arbiter fund-movement functions (dual-party approval only).
- Private keys live only in gitignored `.env`. Never committed.

---

## On-chain lifecycle evidence (appended 2026-09-22 UTC)

### Escrow #2 — full dispute arc (real txs, verifiable)

| Step | Tx |
|---|---|
| Created + funded (0.02 MON) | `0xf3b20aee3730b078fbe5288ab10dcaad62d8ce8ef5cd4bd2b36db6c2d327a96c` |
| Marked delivered | `0x1ec3e9871be22e38ed7a8d6f123816f7bf397130cc6466a377feecdf9b4aa1fe` |
| Dispute opened (buyer evidence hash) | `0xc5e9ca20309a76078a9344613e5ccadec8b57c4c87c0ab9927eb5fe9d1026363` |
| Seller evidence committed | `0x7d063162fcde837b3e085d2cd354953ca6e0c8eeef9b4420f4a931f82fb21f00` |
| Ruling recorded (arbiter EIP-712, RELEASE_SELLER) + buyer auto-approval | `0x945c6d9d25dd9786c2b6e559b7b72655fa5a701d1a1e6dcafff3053767dd00ab` |
| Seller approval → settlement | seller key was ephemeral in this run; the permissionless `fallbackResolveRuling` window opens at `1790038367` and will complete the arc as a real demonstration of the timeout-refund safety net. Trigger queued (deployer gas top-up pending). |

### Escrow #1 — probe escrow
Funded, currently in `Funded` state — visible in the explorer.

### ERC-8004 registries on 10143 (verified via `eth_getCode`, 2026-09-22)
- Identity `0x8004A818BFB912233c491871b3d84c89A494BD9e` — code present; `ownerOf(1)`,
  `tokenURI(1)`, `balanceOf(arbiter)` respond; agent #1 already exists on testnet.
- Reputation `0x8004B663056A597Dffe9eCcC1965A193B7388713` — code present.
- `register(string)` from the arbiter simulated successfully via `eth_call`
  (would mint agentId 1916). Actual tx queued behind gas top-up.

### Operational note (honesty record)
The public Monad RPC is load-balanced with occasionally divergent backend state
(observed: differing balance reads, success receipts without logs, and gas estimates
at the block limit from stale views). All tooling in `web/scripts/` is hardened for
this (send+receipt retries, log-polling, explicit gas caps) and these mitigations are
part of the deliverable.

---

## FINAL SESSION EVIDENCE (2026-09-22, all real txs)

### Escrow #2 — dispute arc completed via permissionless timeout fallback
`fallbackResolveRuling(2)` → **`RULING_TIMEOUT_REFUNDED_BUYER`**, buyer refunded:
tx `0xd1743325a0ed9ed5139bb9281c98f6264f9d7ca7266cbdb42dec8d8e7f7d2a98`

### Escrow #3 — amicable path (complete)
| Step | Tx |
|---|---|
| Created + funded | `0x4c14104cd7c44f4240ffa6fce1e15f27cc9d886d531e6aa20285e3947f89c874` |
| Delivered | `0xa5ee19e8e7481de05c81d6cdd49ea4d3847ee1ecfb359172277450180f956bf4` |
| Buyer released → `RELEASED_BY_BUYER` | `0x7683c1be26de6016652f8bc08220382c8ce419abccfc731add87f1db46936812` |

### Escrow #6 — FULL DISPUTE CYCLE, settled by dual approval (complete)
| Step | Tx |
|---|---|
| Created + funded | `0xa38def3b355bd5fdd1e33f4d05ad5411410d31bb4c896201f421c36588454ef5` |
| Marked delivered | `0xdfb65a2431cba2f67d036ec61e2873e989ff323cbae00e3f60a5b7166ab3ede5` |
| Dispute opened (buyer evidence) | `0x8ea749825ed7a95791d61714543dd0007a930c9884e5492675b121bb466bf050` |
| Seller evidence committed | `0x3e2d581c52fdf985ebb825f342c2b8c01c7b72b98dbf344ab05b62c0d03dff78` |
| Arbiter signed RELEASE_SELLER (EIP-712, off-chain) | — signature only, no tx |
| Buyer published ruling (= her approval) | `0x3a1ff383cc9d287f341b134dd1f88d837afc795a4478095856f4ee574d7397b4` |
| **Seller approved → `RULING_EXECUTED`** | `0x4ddf78864b55a26c4dc4a77febb2543d706ea35069e7cea2eaaca18bcb42489a` |

(Escrow #4: dispute opened but its run's seller key was ephemeral and lost before
approval; it will complete via the same permissionless timeout refund — a further
demonstration of the safety net. Escrow #5: amicable path, `RELEASED_BY_BUYER`,
txs `0xea48fd9e…`, `0xc86651fb…`, `0x312a8272…`.)

### ERC-8004 — arbiter registered (verified on-chain)
- **Agent ID 1918**, owner = arbiter `0xd03a037b0EC873FDCE09e6035E8d706C597F80D4`
- Registration tx: `0xf00b0761f93b102b7058ce62b6881e728356717c988c8d3b5556d60d4c57eae9`
- `Registered(1918, "https://escrowlens.xyz/agent.json", arbiter)` + `Transfer` events confirmed
- `balanceOf(arbiter) = 1` (canonical read)

### Contract state after session
`escrowCount = 6` — escrows #2, #3, #5, #6 Settled; #1 Funded; #4 Disputed (timeout
refund eligible later; permissionless).

---

## § Production deployment (VERIFIED LIVE)

**URL:** https://escrowlens.vercel.app  (Vercel, git-connected auto-deploy from `main`)

| Check | Result |
|---|---|
| All routes (`/`, `/explorer`, `/dashboard`, `/escrow/6`, `/agent`, `/escrow/new`, `/arbiter`) | HTTP 200 |
| Build (Next 16.3.5 / Turbopack on Vercel) | ✓ compiled, all 9 app routes in route table |
| `POST /api/arbiter/analyze` (bad input) | 400 `escrowId must be a non-negative integer.` |
| `POST /api/arbiter/analyze` escrowId=3 (settled) | 409 `This escrow is not in dispute state.` — live Monad RPC read from serverless |
| `POST /api/arbiter/analyze` escrowId=4 (disputed) | 503 `No arbiter model key is configured` — pending real `QWEN_API_KEY` value |

Env inventory on Vercel (names only; values live only in Vercel's encrypted store):
`NEXT_PUBLIC_MONAD_RPC`, `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_ESCROW_CONTRACT`,
`NEXT_PUBLIC_PRIVY_APP_ID`, `NEXT_PUBLIC_EVENT_ANCHORS`, `LLM_PROVIDER`,
`KIMI_API_KEY`, `QWEN_API_KEY`, `ARBITER_PRIVATE_KEY`, `ARBITER_ADDRESS`,
`DEPLOYER_PRIVATE_KEY`, `IPFS_API_KEY`, `IPFS_API_SECRET`.

Note: adding/changing env values on Vercel takes effect only after a redeploy.
AI analysis goes live the moment a real Qwen key value is saved + project redeployed.

### § AI arbiter LIVE in production (first end-to-end verdict)

`POST /api/arbiter/analyze {escrowId:4}` → **HTTP 200**:

- On-chain read: escrow #4 (disputed) — buyer `0x88c9…620C`, seller `0xAfEd…Ad74`, 0.0005 MON, real `evidenceHash`
- Verdict: `RELEASE_BUYER`, confidence 20/100 (honest "unknown" evidence status — no party statements supplied; the arbiter flags, never invents)
- EIP-712 `ruling` struct built with `arbiterNonce` + future `expiry`
- **`signature`: 0x1365065b…f6a1b — signed by the arbiter key from server env** (publishable on-chain, dual-approval required to settle; arbiter itself cannot move funds)
- Served by `nvidia/nemotron-3-super-120b-a12b:free` via OpenRouter (qwen free slug was upstream-rate-limited at that moment; model fallback chain worked as designed)
- Ops notes: `LLM_PROVIDER=openrouter`, `OPENROUTER_API_KEY` set in Vercel (value never leaves Vercel); switching to first-party Qwen later = env-only change. Build logs expose `[env-check]` key-length lines for verification. Escrow #4 seller key was lost pre-recovery (see lifecycle section) — its ruling stays demonstrative; do NOT publish on #4. Use a fresh escrow for live ruling-publication demos.

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

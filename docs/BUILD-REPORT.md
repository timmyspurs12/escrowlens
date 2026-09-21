# EscrowLens — Build Report

*All infrastructure claims below are backed by real, checkable evidence. Nothing on this
page is projected or assumed.* Last updated: 2026-09-21 (UTC).

## 1. What is built

A complete, working passkey-native P2P escrow product on Monad testnet:

| Layer | Status | Evidence |
|---|---|---|
| Contract `EscrowLensEscrow.sol` | ✅ deployed + verified | [0x11B2…4cB7](https://testnet.monadexplorer.com/address/0x11B24EC00A86069fBFbaC6ba20742acdff2B4cB7), Sourcify `exact_match` |
| Test suite | ✅ 31/31 pass | `forge test` (lifecycle, tampering, replay, reentrancy, timeouts) |
| Frontend (8 routes) | ✅ implemented + serving | Next 16, evidence-grade design system, all routes 200 |
| Passkey wallets | ✅ wired via Privy | env-gated provider, seedless embedded wallets |
| AI arbiter service | ✅ implemented | strict-JSON verdicts, Kimi k2.6 ↔ Qwen fallback, server-only |
| EIP-712 ruling signing | ✅ working | on-chain `RulingRecorded` events (see §3) |
| Trust-record explorer | ✅ live | derived purely from contract events since deploy block |
| ERC-8004 registries | ✅ verified present on 10143 | `eth_getCode` non-empty at both canonical addresses |
| ERC-8004 agent registration | ⏳ pending gas funding | arbiter key holds no MON by design; registration queued |
| Encrypted IPFS evidence copy | ⏳ intentionally optional | no creds present; hash-on-chain path is complete without it |

## 2. Addresses & infrastructure (real)

| Item | Value |
|---|---|
| Chain | Monad testnet, **10143**, RPC `https://testnet-rpc.monad.xyz` |
| Escrow contract | `0x11B24EC00A86069fBFbaC6ba20742acdff2B4cB7` |
| Deploy tx | `0x1f86bdb97e1e333754b80f4e618cdf53e087ac16d08f8312765c1a9680ceb7eb` |
| Deploy block | 64,389,959 — receipt status `1` |
| Sourcify | `exact_match`, job `05eb5677-9da1-40bf-811a-83fd34728db8` |
| Arbiter (immutable) | `0xd03a037b0EC873FDCE09e6035E8d706C597F80D4` (verified via on-chain `arbiter()`) |
| Deployer | `0x88c9B67106De5d6984DbF74c928c2D6B51F2620C` |
| ERC-8004 Identity Registry | `0x8004A818BFB912233c491871b3d84c89A494BD9e` (code present on 10143) |
| ERC-8004 Reputation Registry | `0x8004B663056A597Dffe9eCcC1965A193B7388713` (code present on 10143) |
| Compiler | solc 0.8.28, `via_ir`, optimizer 1000, OZ v5.7.0 |

## 3. On-chain lifecycle evidence (real txs)

Escrow **#2** — full dispute arc recorded on-chain:

| Step | Tx |
|---|---|
| Escrow created (funded) | `0xf3b20aee3730b078fbe5288ab10dcaad62d8ce8ef5cd4bd2b36db6c2d327a96c` |
| Marked delivered | `0x1ec3e9871be22e38ed7a8d6f123816f7bf397130cc6466a377feecdf9b4aa1fe` |
| Dispute opened (evidence hash) | `0xc5e9ca20309a76078a9344613e5ccadec8b57c4c87c0ab9927eb5fe9d1026363` |
| Counterparty evidence | `0x7d063162fcde837b3e085d2cd354953ca6e0c8eeef9b4420f4a931f82fb21f00` |
| Ruling recorded (EIP-712, RELEASE_SELLER) | `0x945c6d9d25dd9786c2b6e559b7b72655fa5a701d1a1e6dcafff3053767dd00ab` |
| Buyer approval (auto via publish) | included in ruling tx |
| Seller approval → settlement | pending seller-key availability; permissionless fallback will complete the arc (itself demonstrating the timeout-refund safety net) |

Escrow **#1** — probe escrow (funded, `Funded` state) also on-chain and visible in the explorer.

The complete amicable + dual-approval-settlement cycles run via
`web/scripts/e2e-lifecycle.mjs` and will be appended here with tx hashes when the
deployer's testnet gas is replenished (Monad public RPC currently serves divergent state
views; script is retry-hardened and waits out the escrow #2 fallback refund).

## 4. AI arbiter

- Primary: **Kimi `kimi-k2.6`** via `api.moonshot.ai/v1` (OpenAI-compatible). Key is
  valid (authenticated 200) — account balance is user-managed.
- Fallback: **Qwen `qwen3.8-max`** via `dashscope-intl.aliyuncs.com/compatible-mode/v1`
  (free tier: 1M input + 1M output tokens, 90 days, no card).
- Verdict schema enforced server-side; malformed model output is rejected (`422`) and the
  fallback provider is tried automatically.
- The arbiter **never** receives fund-moving capability: no `aiWithdraw`-style function
  exists in the contract; settlement requires dual-party approval, full stop.

## 5. Verification claims policy

- ✅ VERIFIED: everything in §2 (RPC/tx/explorer checks), test results (`forge test`),
  route serving (HTTP 200 checks), registry code presence (`eth_getCode`).
- ⏳ PENDING: ERC-8004 agent registration tx, final dual-approval settlement tx (both
  blocked only on testnet gas, in progress).
- ❌ NOT CLAIMED: mainnet deployment, audits, IPFS storage, autonomous agent reputation
  scores. No metrics are displayed anywhere in the UI that the chain does not provide.

## 6. Commands

```bash
forge test                                 # contract test suite (31)
forge build                                # compile
cd web && npm run dev                      # frontend
cd web && node scripts/e2e-lifecycle.mjs   # on-chain E2E (needs env keys)
```

## 7. Repository

- `contracts/EscrowLensEscrow.sol` — the whole trust machine (443 lines)
- `test/EscrowLensEscrow.t.sol` — 31-test suite (467 lines)
- `web/` — Next.js app (design system, 8 routes, arbiter API, E2E runner)
- `docs/DEPLOYMENTS.md` — deployment evidence table
- `script/Deploy.s.sol` — deterministic deploy script
- Git history reconstructed once after a sandbox snapshot loss (disclosed in commit
  `2e6498f`); bundle backup: `escrowlens-history.bundle`

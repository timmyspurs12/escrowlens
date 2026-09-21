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

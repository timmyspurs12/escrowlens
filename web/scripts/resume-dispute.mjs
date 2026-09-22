/**
 * Resume a disputed escrow: sign the pending ruling (arbiter EIP-712),
 * publish it (buyer = auto-approval), then seller approves → settlement.
 *
 *   set -a; source ../.env; set +a
 *   NEXT_PUBLIC_ESCROW_CONTRACT=0x… node scripts/resume-dispute.mjs 4
 */
import {
  createPublicClient, createWalletClient, http, parseAbi, parseEventLogs,
  formatEther,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

const RPC = "https://testnet-rpc.monad.xyz";
const C = process.env.NEXT_PUBLIC_ESCROW_CONTRACT;
const CHAIN_ID = 10143;
const GAS = { maxFeePerGas: 22n * 10n ** 10n, maxPriorityFeePerGas: 2n * 10n ** 9n, gas: 400000n };

const id = BigInt(process.argv[2] ?? "4");
if (!process.env.DEPLOYER_PRIVATE_KEY || !process.env.ARBITER_PRIVATE_KEY || !process.env.DEMO_SELLER_KEY || !C) {
  console.error("Need DEPLOYER_PRIVATE_KEY, ARBITER_PRIVATE_KEY, DEMO_SELLER_KEY, NEXT_PUBLIC_ESCROW_CONTRACT");
  process.exit(1);
}

const monad = { id: CHAIN_ID, nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } };
const pc = createPublicClient({ chain: monad, transport: http(RPC) });
const alice = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
const arbiter = privateKeyToAccount(process.env.ARBITER_PRIVATE_KEY);
const seller = privateKeyToAccount(process.env.DEMO_SELLER_KEY);
const aliceWc = createWalletClient({ account: alice, chain: monad, transport: http(RPC) });
const sellerWc = createWalletClient({ account: seller, chain: monad, transport: http(RPC) });

const ABI = parseAbi([
  "function getEscrow(uint256) view returns (address buyer, address seller, uint256 amount, string description, uint64 deliveryDeadline, uint64 disputeWindow, uint64 disputeOpenedAt, uint64 rulingDeadline, bytes32 buyerEvidenceHash, bytes32 sellerEvidenceHash, uint8 pendingRulingType, uint16 pendingSplitBps, uint8 status)",
  "function submitRuling((uint256 escrowId,address buyer,address seller,uint256 amount,bytes32 evidenceHash,uint8 rulingType,uint16 splitBps,uint256 arbiterNonce,uint64 expiry) r, bytes signature)",
  "function approveRuling(uint256 escrowId)",
  "function combinedEvidenceHash(uint256) view returns (bytes32)",
  "function rulingNonce(uint256) view returns (uint256)",
  "event RulingRecorded(uint256 indexed escrowId, bytes32 indexed rulingHash, uint8 rulingType, uint16 splitBps, uint64 recordUntil)",
  "event RulingApproved(uint256 indexed escrowId, address indexed party, bytes32 indexed rulingHash)",
  "event EscrowSettled(uint256 indexed escrowId, uint256 amountToBuyer, uint256 amountToSeller, string outcome)",
]);

const log = console.log;
const H = (t) => `https://testnet.monadexplorer.com/tx/${t}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function exec(factory, tries = 8) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try {
      const hash = await factory();
      await pc.waitForTransactionReceipt({ hash }).catch(() => {});
      for (let k = 0; k < 10; k++) {
        const r = await pc.getTransactionReceipt({ hash });
        if (r.status !== "success") throw new Error(`reverted ${hash}`);
        if (r.logs.length > 0) return r;
        await sleep(1200);
      }
      throw new Error(`no logs ${hash}`);
    } catch (e) {
      lastErr = e;
      log(`    attempt ${i}: ${String(e.cause?.details ?? e.shortMessage ?? e.message).slice(0, 70)}`);
      await sleep(3000);
    }
  }
  throw lastErr;
}

async function main() {
  const e = await pc.readContract({ address: C, abi: ABI, functionName: "getEscrow", args: [id] });
  const status = e[12];
  log(`Escrow #${id}: status ${status} (2=Disputed, 3=RulingPending), amount ${formatEther(e[2])} MON`);
  if (status !== 2n && status !== 3) {
    log(status === 4n ? "Already settled — nothing to do." : `Unexpected state; aborting.`);
    return;
  }

  if (status === 2n || status === 2) {
    // 1. arbiter signs (off-chain)
    const [combined, nonce] = await Promise.all([
      pc.readContract({ address: C, abi: ABI, functionName: "combinedEvidenceHash", args: [id] }),
      pc.readContract({ address: C, abi: ABI, functionName: "rulingNonce", args: [id] }),
    ]);
    const expiry = BigInt(Math.floor(Date.now() / 1000) + 7200);
    const ruling = {
      escrowId: id, buyer: e[0], seller: e[1], amount: e[2], evidenceHash: combined,
      rulingType: 1, splitBps: 0, arbiterNonce: nonce, expiry,
    };
    const signature = await arbiter.signTypedData({
      domain: { name: "EscrowLens", version: "1", chainId: CHAIN_ID, verifyingContract: C },
      types: {
        Ruling: [
          { name: "escrowId", type: "uint256" }, { name: "buyer", type: "address" },
          { name: "seller", type: "address" }, { name: "amount", type: "uint256" },
          { name: "evidenceHash", type: "bytes32" }, { name: "rulingType", type: "uint8" },
          { name: "splitBps", type: "uint16" }, { name: "arbiterNonce", type: "uint256" },
          { name: "expiry", type: "uint64" },
        ],
      },
      primaryType: "Ruling",
      message: ruling,
    });
    log(`[1] Arbiter signed RELEASE_SELLER (nonce ${nonce})`);

    // 2. buyer publishes (= her approval)
    const r1 = await exec(() => aliceWc.writeContract({ ...GAS, address: C, abi: ABI, functionName: "submitRuling", args: [ruling, signature] }));
    log(`[2] Buyer published ruling (= her approval): ${H(r1.transactionHash)}`);
  }

  // 3. seller approves → dual-approval settlement
  const before = await pc.getBalance({ address: seller.address });
  const r2 = await exec(() => sellerWc.writeContract({ ...GAS, address: C, abi: ABI, functionName: "approveRuling", args: [id] }));
  const settled = parseEventLogs({ abi: ABI, logs: r2.logs }).find((l) => l.eventName === "EscrowSettled");
  const after = await pc.getBalance({ address: seller.address });
  log(`[3] Seller approved → SETTLED "${settled.args.outcome}" | seller received ${formatEther(settled.args.amountToSeller)} MON (Δ ${formatEther(after - before)})`);
  log(`    https://testnet.monadexplorer.com/tx/${r2.transactionHash}`);
  log(`\nESCROW #${id} FULLY SETTLED BY DUAL APPROVAL OF AN ARBITER RULING.`);
}

main().catch((e) => {
  console.error("FAILED:", e.cause?.details ?? e.shortMessage ?? e.message);
  process.exit(1);
});

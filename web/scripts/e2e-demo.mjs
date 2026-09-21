/**
 * EscrowLens E2E lifecycle demo — REAL transactions on Monad testnet 10143.
 *
 * Story:
 *   Alice (deployer) buys a vintage camera lens from Bob (ephemeral demo key).
 *   Escrow 1 — dispute path:  fund → deliver → dispute → evidence ×2 →
 *             arbiter signs RELEASE_SELLER (EIP-712, local key) →
 *             buyer publishes (=her approval) → seller approves → settlement.
 *   Escrow 2 — amicable path: fund → deliver → buyer releases directly.
 *
 * Robustness: the public RPC is load-balanced and backends can hold briefly
 * divergent state — a perfectly valid tx can land on a stale backend and
 * revert, or a receipt can come back without logs. Every step therefore
 * retries (R) and every receipt is polled until its logs actually appear.
 *
 * Usage (from web/):
 *   DEPLOYER_PRIVATE_KEY=0x.. ARBITER_PRIVATE_KEY=0x.. \
 *   NEXT_PUBLIC_ESCROW_CONTRACT=0x.. node scripts/e2e-demo.mjs
 * No keys are read from anywhere else and none are stored in this file.
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  parseEventLogs,
  keccak256,
  toBytes,
  formatEther,
} from "viem";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";

const RPC = process.env.RPC_URL ?? "https://testnet-rpc.monad.xyz";
const CONTRACT = process.env.NEXT_PUBLIC_ESCROW_CONTRACT;
const CHAIN_ID = 10143;

if (!process.env.DEPLOYER_PRIVATE_KEY || !process.env.ARBITER_PRIVATE_KEY || !CONTRACT) {
  console.error("Need DEPLOYER_PRIVATE_KEY, ARBITER_PRIVATE_KEY, NEXT_PUBLIC_ESCROW_CONTRACT");
  process.exit(1);
}

const monad = {
  id: CHAIN_ID,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [RPC] } },
  blockExplorers: { default: { name: "Monad Explorer", url: "https://testnet.monadexplorer.com" } },
  testnet: true,
};

const ABI = parseAbi([
  "function createEscrow(address seller, string description, uint64 deliveryDeadline, uint64 disputeWindow) payable returns (uint256)",
  "function markDelivered(uint256 escrowId)",
  "function releaseToSeller(uint256 escrowId)",
  "function openDispute(uint256 escrowId, bytes32 evidenceHash)",
  "function submitEvidence(uint256 escrowId, bytes32 evidenceHash)",
  "function submitRuling((uint256 escrowId,address buyer,address seller,uint256 amount,bytes32 evidenceHash,uint8 rulingType,uint16 splitBps,uint256 arbiterNonce,uint64 expiry) r, bytes signature)",
  "function approveRuling(uint256 escrowId)",
  "function getEscrow(uint256) view returns (address,address,uint256,string,uint64,uint64,uint64,uint64,bytes32,bytes32,uint8,uint16,uint8)",
  "function escrowCount() view returns (uint256)",
  "function combinedEvidenceHash(uint256) view returns (bytes32)",
  "function rulingNonce(uint256) view returns (uint256)",
  "function arbiter() view returns (address)",
  "event EscrowCreated(uint256 indexed escrowId, address indexed buyer, address indexed seller, uint256 amount, string description, uint64 deliveryDeadline, uint64 disputeWindow)",
  "event Delivered(uint256 indexed escrowId)",
  "event DisputeOpened(uint256 indexed escrowId, address indexed party, bytes32 evidenceHash, uint64 disputeOpenedAt)",
  "event EvidenceSubmitted(uint256 indexed escrowId, address indexed party, bytes32 evidenceHash)",
  "event RulingRecorded(uint256 indexed escrowId, bytes32 indexed rulingHash, uint8 rulingType, uint16 splitBps, uint64 recordUntil)",
  "event RulingApproved(uint256 indexed escrowId, address indexed party, bytes32 indexed rulingHash)",
  "event EscrowSettled(uint256 indexed escrowId, uint256 amountToBuyer, uint256 amountToSeller, string outcome)",
]);

const publicClient = createPublicClient({ chain: monad, transport: http(RPC) });
const alice = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY); // buyer
const arbiter = privateKeyToAccount(process.env.ARBITER_PRIVATE_KEY);
const bobPk = generatePrivateKey(); // ephemeral demo seller — not persisted
const bob = privateKeyToAccount(bobPk);
const bobClient = createWalletClient({ account: bob, chain: monad, transport: http(RPC) });
const aliceClient = createWalletClient({ account: alice, chain: monad, transport: http(RPC) });

const log = (...a) => console.log(...a);
// Generous fee ceiling: the base fee fluctuates and stale-backends return
// low estimates that nodes reject as invalid parameters.
const GAS = { maxFeePerGas: 5n * 10n ** 11n, maxPriorityFeePerGas: 2n * 10n ** 9n };
const H = (t) => `https://testnet.monadexplorer.com/tx/${t}`;
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

/**
 * Send a tx and wait for a receipt WITH logs. Retries the whole send on
 * revert: the public RPC is load-balanced and some backends hold divergent
 * state, so a valid tx can land on a stale backend and revert. Retrying
 * issues a FRESH transaction (new nonce) that can land on a healthy one.
 */
async function exec(factory, tries = 6, needLogs = true) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try {
      const hash = await factory();
      return await receiptWithLogs(hash, needLogs);
    } catch (e) {
      lastErr = e;
      const msg = String(e.shortMessage ?? e.message ?? "").toLowerCase();
      if (msg.includes("user rejected") || msg.includes("user denied")) throw e;
      log(`    attempt ${i} failed (${msg.slice(0, 70)}) — retrying with a fresh tx`);
      await sleep(2500);
    }
  }
  throw lastErr;
}

/** Receipt WITH logs (poll — some backends return success receipts w/o logs). */
async function receiptWithLogs(hash, needLogs = true) {
  await publicClient.waitForTransactionReceipt({ hash }).catch(() => {});
  for (let i = 0; i < 8; i++) {
    const r = await publicClient.getTransactionReceipt({ hash });
    if (r.status !== "success") throw new Error(`tx reverted: ${hash}`);
    if (!needLogs || r.logs.length > 0) return r;
    await sleep(1200);
  }
  throw new Error(`receipt has no logs after retries: ${hash}`);
}

const parseLogs = (r) => parseEventLogs({ abi: ABI, logs: r.logs });
const ev = keccak256(toBytes("demo-evidence"));

async function main() {
  log(`EscrowLens E2E — chain ${CHAIN_ID}, contract ${CONTRACT}`);
  log(`Alice (buyer/deployer): ${alice.address}`);
  log(`Arbiter (signs only):   ${arbiter.address} (on-chain: ${await publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: "arbiter" })})`);
  log(`Bob (seller, ephemeral): ${bob.address}`);

  // 0. Fund Bob (small amount, verified on the balance — not just the receipt)
  let funded = false;
  for (let attempt = 1; attempt <= 3 && !funded; attempt++) {
    const fundR = await exec(() => aliceClient.sendTransaction({ to: bob.address, value: 2n * 10n ** 16n, ...GAS }), 4, false).catch(() => null);
    if (!fundR) { log(`    funding attempt ${attempt} failed — retrying`); await sleep(2500); continue; }
    const fundTx = fundR.transactionHash;
    await publicClient.waitForTransactionReceipt({ hash: fundTx }).catch(() => {});
    for (let i = 0; i < 8; i++) {
      if ((await publicClient.getBalance({ address: bob.address })) >= 15n * 10n ** 15n) {
        funded = true;
        log(`\n[0] Funded Bob with 0.02 MON gas money (attempt ${attempt}): ${H(fundTx)}`);
        break;
      }
      await sleep(1500);
    }
  }
  if (!funded) throw new Error("could not fund Bob — RPC state divergence");

  // ---------------- Escrow 1: the dispute path ----------------
  const desc1 = "E2E demo: Nikon 50mm f/1.4 lens — disputed delivery, settled by arbiter";
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const window = 3600n;

  const r1 = await exec(() =>
    aliceClient.writeContract({
      ...GAS, address: CONTRACT, abi: ABI, functionName: "createEscrow",
      args: [bob.address, desc1, deadline, window], value: 2n * 10n ** 16n,
    })
  );
  const id1 = parseLogs(r1).find((l) => l.eventName === "EscrowCreated").args.escrowId;
  log(`\n[1] Escrow #${id1} created (0.02 MON): ${H(r1.transactionHash)}`);

  const r2 = await exec(() => bobClient.writeContract({ ...GAS, address: CONTRACT, abi: ABI, functionName: "markDelivered", args: [id1] }));
  log(`[2] Bob marked delivered: ${H(r2.transactionHash)}`);

  const r3 = await exec(() =>
    aliceClient.writeContract({
      ...GAS, address: CONTRACT, abi: ABI, functionName: "openDispute",
      args: [id1, keccak256(toBytes("alice: lens never arrived — photos " + ev.slice(2, 10)))],
    })
  );
  log(`[3] Alice opened dispute: ${H(r3.transactionHash)}`);

  const r4 = await exec(() =>
    bobClient.writeContract({
      ...GAS, address: CONTRACT, abi: ABI, functionName: "submitEvidence",
      args: [id1, keccak256(toBytes("bob: shipping receipt + tracking, delivered 16 Sep " + ev.slice(2, 10)))],
    })
  );
  log(`[4] Bob committed evidence: ${H(r4.transactionHash)}`);

  // Arbiter reviews and signs RELEASE_SELLER (evidence consistent with delivery)
  const [combined, nonce, e] = await Promise.all([
    publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: "combinedEvidenceHash", args: [id1] }),
    publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: "rulingNonce", args: [id1] }),
    publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: "getEscrow", args: [id1] }),
  ]);
  const expiry = BigInt(Math.floor(Date.now() / 1000) + 7200);
  const ruling = {
    escrowId: id1, buyer: e[0], seller: e[1], amount: e[2], evidenceHash: combined,
    rulingType: 1, splitBps: 0, arbiterNonce: nonce, expiry,
  };
  const signature = await arbiter.signTypedData({
    domain: { name: "EscrowLens", version: "1", chainId: CHAIN_ID, verifyingContract: CONTRACT },
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
  log(`[5] Arbiter signed RELEASE_SELLER (EIP-712, sig ${signature.slice(0, 18)}…) — off-chain, no funds access`);

  const r5 = await exec(() =>
    aliceClient.writeContract({
      ...GAS, address: CONTRACT, abi: ABI, functionName: "submitRuling", args: [ruling, signature],
    })
  );
  log(`[6] Alice published ruling (= her approval): ${H(r5.transactionHash)}`);

  const bobBefore = await publicClient.getBalance({ address: bob.address });
  const r6 = await exec(() => bobClient.writeContract({ ...GAS, address: CONTRACT, abi: ABI, functionName: "approveRuling", args: [id1] }));
  const settled = parseLogs(r6).find((l) => l.eventName === "EscrowSettled");
  const bobAfter = await publicClient.getBalance({ address: bob.address });
  log(`[7] Bob approved → SETTLED "${settled.args.outcome}" (toSeller ${formatEther(settled.args.amountToSeller)} MON): ${H(r6.transactionHash)}`);
  log(`    Bob balance Δ ≈ ${formatEther(bobAfter - bobBefore)} MON`);

  // ---------------- Escrow 2: the amicable path ----------------
  const r7 = await exec(() =>
    aliceClient.writeContract({
      ...GAS, address: CONTRACT, abi: ABI, functionName: "createEscrow",
      args: [bob.address, "E2E demo: smooth delivery — buyer releases directly", deadline, window],
      value: 5n * 10n ** 15n,
    })
  );
  const id2 = parseLogs(r7).find((l) => l.eventName === "EscrowCreated").args.escrowId;
  log(`\n[8] Escrow #${id2} created (0.005 MON): ${H(r7.transactionHash)}`);

  const r8 = await exec(() => bobClient.writeContract({ ...GAS, address: CONTRACT, abi: ABI, functionName: "markDelivered", args: [id2] }));
  log(`[9] Bob marked delivered: ${H(r8.transactionHash)}`);

  const r9 = await exec(() => aliceClient.writeContract({ ...GAS, address: CONTRACT, abi: ABI, functionName: "releaseToSeller", args: [id2] }));
  log(`[10] Alice released directly → "${parseLogs(r9).find((l) => l.eventName === "EscrowSettled").args.outcome}": ${H(h9)}`);

  log(`\nDone. escrowCount = ${await publicClient.readContract({ address: CONTRACT, abi: ABI, functionName: "escrowCount" })}`);
  log(`Bob demo key (ephemeral, discardable): ${bobPk}`);
}

main().catch((e) => {
  console.error("E2E FAILED:", e.shortMessage ?? e.message);
  process.exit(1);
});

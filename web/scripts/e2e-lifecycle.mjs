/**
 * EscrowLens E2E lifecycle — final, budget-aware. Monad testnet 10143.
 *
 * Two complete escrows using keys we hold throughout (no stuck states):
 *   Escrow A — amicable:  fund → deliver → buyer releases directly.
 *   Escrow B — dispute:   fund → deliver → dispute → evidence ×2 →
 *                         arbiter signs EIP-712 RELEASE_SELLER →
 *                         buyer publishes (= approval) → seller approves →
 *                         dual-approval settlement executes on-chain.
 *
 * The seller key is printed and stored (DEMO_SELLER_KEY) so the demo
 * accounts remain usable afterwards. Retries included: the public RPC is
 * load-balanced and occasionally executes against stale state.
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
import { writeFileSync, appendFileSync } from "node:fs";

const RPC = process.env.RPC_URL ?? "https://testnet-rpc.monad.xyz";
const CONTRACT = process.env.NEXT_PUBLIC_ESCROW_CONTRACT;
const CHAIN_ID = 10143;
const GAS = { maxFeePerGas: 22n * 10n ** 10n, maxPriorityFeePerGas: 2n * 10n ** 9n };

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

const pc = createPublicClient({ chain: monad, transport: http(RPC) });
const alice = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
const arbiter = privateKeyToAccount(process.env.ARBITER_PRIVATE_KEY);
const sellerPk = process.env.DEMO_SELLER_KEY ?? generatePrivateKey();
const seller = privateKeyToAccount(sellerPk);
const sellerClient = createWalletClient({ account: seller, chain: monad, transport: http(RPC) });
const aliceClient = createWalletClient({ account: alice, chain: monad, transport: http(RPC) });

const log = (...a) => console.log(...a);
const H = (t) => `https://testnet.monadexplorer.com/tx/${t}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function exec(factory, tries = 6, needLogs = true) {
  let lastErr;
  for (let i = 1; i <= tries; i++) {
    try {
      const hash = await factory();
      await pc.waitForTransactionReceipt({ hash }).catch(() => {});
      for (let k = 0; k < 8; k++) {
        const r = await pc.getTransactionReceipt({ hash });
        if (r.status !== "success") throw new Error(`reverted ${hash}`);
        if (!needLogs || r.logs.length > 0) return r;
        await sleep(1200);
      }
      throw new Error(`no logs ${hash}`);
    } catch (e) {
      lastErr = e;
      const msg = String(e.shortMessage ?? e.message ?? "").toLowerCase();
      if (msg.includes("user rejected")) throw e;
      log(`    attempt ${i} failed (${msg.slice(0, 60)}) — retrying`);
      await sleep(2500);
    }
  }
  throw lastErr;
}

const parseLogs = (r) => parseEventLogs({ abi: ABI, logs: r.logs });

async function fundTiny(to, value) {
  for (let i = 0; i < 5; i++) {
    await exec(() => aliceClient.sendTransaction({ to, value, ...GAS }), 2, false).catch(() => null);
    if ((await pc.getBalance({ address: to })) >= (value * 9n) / 10n) return;
    await sleep(2000);
  }
  throw new Error(`funding ${to} failed`);
}

async function main() {
  log(`EscrowLens E2E final — contract ${CONTRACT}`);
  log(`Alice(buyer)=${alice.address}  Arbiter=${arbiter.address}  Seller=${seller.address}`);
  const aliceBal = await pc.getBalance({ address: alice.address });
  log(`Alice balance: ${formatEther(aliceBal)} MON`);

  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const window = 3600n;

  // seller needs gas money only (never receives escrow except via settlement)
  await fundTiny(seller.address, 5n * 10n ** 14n);
  log(`[0] Seller funded with gas money`);

  // ---------------- Escrow A — amicable ----------------
  const rA = await exec(() =>
    aliceClient.writeContract({
      ...GAS, address: CONTRACT, abi: ABI, functionName: "createEscrow",
      args: [seller.address, "E2E: lens hood accessory — smooth deal, direct release", deadline, window],
      value: 5n * 10n ** 14n,
    })
  );
  const idA = parseLogs(rA).find((l) => l.eventName === "EscrowCreated").args.escrowId;
  log(`\n[A1] Escrow #${idA} created (0.0005 MON): ${H(rA.transactionHash)}`);

  const rA2 = await exec(() => sellerClient.writeContract({ ...GAS, address: CONTRACT, abi: ABI, functionName: "markDelivered", args: [idA] }));
  log(`[A2] Delivered: ${H(rA2.transactionHash)}`);

  const rA3 = await exec(() => aliceClient.writeContract({ ...GAS, address: CONTRACT, abi: ABI, functionName: "releaseToSeller", args: [idA] }));
  log(`[A3] Buyer released → "${parseLogs(rA3).find((l) => l.eventName === "EscrowSettled").args.outcome}": ${H(rA3.transactionHash)}`);

  // ---------------- Escrow B — full dispute cycle ----------------
  const rB = await exec(() =>
    aliceClient.writeContract({
      ...GAS, address: CONTRACT, abi: ABI, functionName: "createEscrow",
      args: [seller.address, "E2E: camera body refurb — disputed then settled by arbiter", deadline, window],
      value: 5n * 10n ** 14n,
    })
  );
  const idB = parseLogs(rB).find((l) => l.eventName === "EscrowCreated").args.escrowId;
  log(`\n[B1] Escrow #${idB} created (0.0005 MON): ${H(rB.transactionHash)}`);

  const rB2 = await exec(() => sellerClient.writeContract({ ...GAS, address: CONTRACT, abi: ABI, functionName: "markDelivered", args: [idB] }));
  log(`[B2] Delivered: ${H(rB2.transactionHash)}`);

  const rB3 = await exec(() =>
    aliceClient.writeContract({
      ...GAS, address: CONTRACT, abi: ABI, functionName: "openDispute",
      args: [idB, keccak256(toBytes("alice: claims refurb never shipped — tracking missing"))],
    })
  );
  log(`[B3] Dispute opened: ${H(rB3.transactionHash)}`);

  const rB4 = await exec(() =>
    sellerClient.writeContract({
      ...GAS, address: CONTRACT, abi: ABI, functionName: "submitEvidence",
      args: [idB, keccak256(toBytes("seller: courier receipt + serial photos, shipped on time"))],
    })
  );
  log(`[B4] Seller evidence: ${H(rB4.transactionHash)}`);

  const [combined, nonce, e] = await Promise.all([
    pc.readContract({ address: CONTRACT, abi: ABI, functionName: "combinedEvidenceHash", args: [idB] }),
    pc.readContract({ address: CONTRACT, abi: ABI, functionName: "rulingNonce", args: [idB] }),
    pc.readContract({ address: CONTRACT, abi: ABI, functionName: "getEscrow", args: [idB] }),
  ]);
  const ruling = {
    escrowId: idB, buyer: e[0], seller: e[1], amount: e[2], evidenceHash: combined,
    rulingType: 1, splitBps: 0, arbiterNonce: nonce,
    expiry: BigInt(Math.floor(Date.now() / 1000) + 7200),
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
  log(`[B5] Arbiter signed RELEASE_SELLER (EIP-712) — off-chain, funds untouched`);

  const rB5 = await exec(() =>
    aliceClient.writeContract({ ...GAS, address: CONTRACT, abi: ABI, functionName: "submitRuling", args: [ruling, signature] })
  );
  log(`[B6] Buyer published ruling (= her approval): ${H(rB5.transactionHash)}`);

  const before = await pc.getBalance({ address: seller.address });
  const rB6 = await exec(() => sellerClient.writeContract({ ...GAS, address: CONTRACT, abi: ABI, functionName: "approveRuling", args: [idB] }));
  const settled = parseLogs(rB6).find((l) => l.eventName === "EscrowSettled");
  const after = await pc.getBalance({ address: seller.address });
  log(`[B7] Seller approved → SETTLED "${settled.args.outcome}": ${H(rB6.transactionHash)}`);
  log(`     seller received ${formatEther(settled.args.amountToSeller)} MON (balance Δ ${formatEther(after - before)})`);

  log(`\nDone. escrowCount = ${await pc.readContract({ address: CONTRACT, abi: ABI, functionName: "escrowCount" })}`);
  log(`DEMO_SELLER_KEY=${sellerPk}`);

  // persist for future turns (gitignored location)
  try {
    appendFileSync("../.env", `\nDEMO_SELLER_KEY=${sellerPk}\n`);
  } catch {}
}

main().catch((e) => {
  console.error("E2E FAILED:", e.shortMessage ?? e.message);
  process.exit(1);
});

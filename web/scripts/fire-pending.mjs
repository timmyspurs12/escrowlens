/**
 * EscrowLens — one-shot pending-actions runner.
 *
 * Executes every queued chain action in order, each idempotent (skips if
 * already done). Designed to be run once after the deployer is topped up:
 *
 *   set -a; source ../.env; set +a
 *   NEXT_PUBLIC_ESCROW_CONTRACT=0x… DEMO_SELLER_KEY=0x… \
 *   node scripts/fire-pending.mjs
 *
 * Steps:
 *   1. fallbackResolveRuling(2) — completes escrow #2's arc (timeout refund)
 *      [skips if already Settled]
 *   2. register the arbiter on ERC-8004 Identity Registry
 *      [skips if balanceOf(arbiter) > 0]
 *   3. full E2E lifecycle (amicable + dispute + dual-approval settlement)
 *      via e2e-lifecycle.mjs
 */
import { createPublicClient, createWalletClient, http, parseAbi, parseEventLogs, encodeFunctionData, formatEther, keccak256, toBytes } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { execSync } from "node:child_process";

const RPC = "https://testnet-rpc.monad.xyz";
const C = process.env.NEXT_PUBLIC_ESCROW_CONTRACT;
const REG = "0x8004A818BFB912233c491871b3d84c89A494BD9e";
const monad = { id: 10143, nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 }, rpcUrls: { default: { http: [RPC] } } };
const GAS = { maxFeePerGas: 22n * 10n ** 10n, maxPriorityFeePerGas: 2n * 10n ** 9n, gas: 400000n };

if (!process.env.DEPLOYER_PRIVATE_KEY || !C) {
  console.error("Need DEPLOYER_PRIVATE_KEY and NEXT_PUBLIC_ESCROW_CONTRACT");
  process.exit(1);
}

const pc = createPublicClient({ chain: monad, transport: http(RPC) });
const alice = privateKeyToAccount(process.env.DEPLOYER_PRIVATE_KEY);
const wc = createWalletClient({ account: alice, chain: monad, transport: http(RPC) });
const ARB = privateKeyToAccount(process.env.ARBITER_PRIVATE_KEY ?? "0x0000000000000000000000000000000000000000000000000000000000000001");

const log = (...a) => console.log(...a);
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
      log(`    attempt ${i}: ${String(e.cause?.details ?? e.shortMessage ?? e.message).slice(0, 70)}`);
      await sleep(2500);
    }
  }
  throw lastErr;
}

async function step1_fallbackEscrow2() {
  const abi = parseAbi([
    "function getEscrow(uint256) view returns (address,address,uint256,string,uint64,uint64,uint64,uint64,bytes32,bytes32,uint8,uint16,uint8)",
    "function fallbackResolveRuling(uint256 escrowId)",
    "event EscrowSettled(uint256 indexed escrowId, uint256 amountToBuyer, uint256 amountToSeller, string outcome)",
  ]);
  const e = await pc.readContract({ address: C, abi, functionName: "getEscrow", args: [2n] });
  if (e[12] === 4) {
    log("[1] escrow #2 already Settled — skip");
    return;
  }
  if (e[12] !== 3) {
    log(`[1] escrow #2 status ${e[12]} (not RulingPending) — skip`);
    return;
  }
  if (BigInt(e[7]) > BigInt(Math.floor(Date.now() / 1000))) {
    log(`[1] escrow #2 window still open for ${Number(e[7]) - Math.floor(Date.now() / 1000)}s — skip (either a party approves, or re-run later)`);
    return;
  }
  const r = await exec(() => wc.writeContract({ ...GAS, address: C, abi, functionName: "fallbackResolveRuling", args: [2n] }));
  const s = parseEventLogs({ abi, logs: r.logs }).find((l) => l.eventName === "EscrowSettled");
  log(`[1] ESCROW #2 ARC COMPLETE: "${s.args.outcome}", buyer refunded ${formatEther(s.args.amountToBuyer)} MON — https://testnet.monadexplorer.com/tx/${r.transactionHash}`);
}

async function step2_registerAgent() {
  if (!process.env.ARBITER_PRIVATE_KEY) {
    log("[2] no ARBITER_PRIVATE_KEY in env — skip");
    return;
  }
  const balAbi = parseAbi(["function balanceOf(address) view returns (uint256)"]);
  const n = await pc.readContract({ address: REG, abi: balAbi, functionName: "balanceOf", args: [ARB.address] });
  if (n > 0n) {
    log(`[2] arbiter already owns ${n} agent token(s) — skip`);
    return;
  }
  const arbWc = createWalletClient({ account: ARB, chain: monad, transport: http(RPC) });
  if ((await pc.getBalance({ address: ARB.address })) < 10n ** 17n) { // need ≥ gas ceiling 0.088
    log("[2] funding arbiter with gas for the one-time registration…");
    // fund enough to cover the gas ceiling: 400k × 220 gwei = 0.088 MON
    await exec(() => wc.sendTransaction({
      to: ARB.address, value: 25n * 10n ** 16n, gas: 30000n,
      maxFeePerGas: 22n * 10n ** 10n, maxPriorityFeePerGas: 2n * 10n ** 9n,
    }), 4, false);
  }
  const data = encodeFunctionData({
    abi: [{ name: "register", type: "function", stateMutability: "nonpayable", inputs: [{ name: "tokenURI", type: "string" }], outputs: [{ type: "uint256" }] }],
    functionName: "register",
    args: ["https://escrowlens.xyz/agent.json"],
  });
  const r = await exec(() => arbWc.sendTransaction({ to: REG, data, ...GAS }));
  const log0 = r.logs[0];
  log(`[2] ARBITER REGISTERED on ERC-8004 Identity Registry — tx https://testnet.monadexplorer.com/tx/${r.transactionHash} (agentId visible in the token event)`);
}

async function step3_lifecycle() {
  log("[3] running full E2E lifecycle…");
  const env = { ...process.env, NEXT_PUBLIC_ESCROW_CONTRACT: C };
  try {
    const out = execSync("node scripts/e2e-lifecycle.mjs", { env, encoding: "utf8", timeout: 600000 });
    console.log(out);
  } catch (e) {
    log("[3] lifecycle reported:", String(e.stdout ?? e.message).slice(-1500));
  }
}

async function main() {
  log(`fire-pending — deployer ${alice.address} has ${formatEther(await pc.getBalance({ address: alice.address }))} MON`);
  if ((await pc.getBalance({ address: alice.address })) < 10n ** 14n) {
    console.error("Deployer still unfunded. Top up at https://testnet.monad.xyz then re-run.");
    process.exit(1);
  }
  await step1_fallbackEscrow2();
  await step2_registerAgent();
  await step3_lifecycle();
  log("\nAll pending actions processed.");
}

main().catch((e) => {
  console.error("FAILED:", e.cause?.details ?? e.shortMessage ?? e.message);
  process.exit(1);
});

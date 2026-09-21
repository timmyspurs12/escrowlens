import { createPublicClient, http, parseAbi, formatLog } from "viem";
import { monadTestnet } from "./monad";

/* ------------------------------------------------------------------ */
/* Contract binding                                                    */
/* ------------------------------------------------------------------ */

export const CONTRACT = (process.env.NEXT_PUBLIC_ESCROW_CONTRACT ?? "") as `0x${string}`;
export const DEPLOY_BLOCK = Number(process.env.NEXT_PUBLIC_DEPLOY_BLOCK ?? 64389959);
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 10143);

export const Status = {
  Funded: 0,
  Delivered: 1,
  Disputed: 2,
  RulingPending: 3,
  Settled: 4,
} as const;

export const RulingType = {
  RELEASE_BUYER: 0,
  RELEASE_SELLER: 1,
  SPLIT: 2,
} as const;

export const ESCROW_ABI = parseAbi([
  "function createEscrow(address seller, string description, uint64 deliveryDeadline, uint64 disputeWindow) payable returns (uint256)",
  "function markDelivered(uint256 escrowId)",
  "function releaseToSeller(uint256 escrowId)",
  "function openDispute(uint256 escrowId, bytes32 evidenceHash)",
  "function submitEvidence(uint256 escrowId, bytes32 evidenceHash)",
  "function approveRuling(uint256 escrowId)",
  "function submitRuling((uint256 escrowId,address buyer,address seller,uint256 amount,bytes32 evidenceHash,uint8 rulingType,uint16 splitBps,uint256 arbiterNonce,uint64 expiry) r, bytes signature)",
  "function expire(uint256 escrowId)",
  "function fallbackResolveDispute(uint256 escrowId)",
  "function fallbackResolveRuling(uint256 escrowId)",
  "function getEscrow(uint256 escrowId) view returns (address buyer, address seller, uint256 amount, string description, uint64 deliveryDeadline, uint64 disputeWindow, uint64 disputeOpenedAt, uint64 rulingDeadline, bytes32 buyerEvidenceHash, bytes32 sellerEvidenceHash, uint8 pendingRulingType, uint16 pendingSplitBps, uint8 status)",
  "function escrowCount() view returns (uint256)",
  "function arbiter() view returns (address)",
  "function combinedEvidenceHash(uint256 escrowId) view returns (bytes32)",
  "function rulingNonce(uint256 escrowId) view returns (uint256)",
  "function rulingApproved(uint256 escrowId, address party) view returns (bool)",
  "function rulingDigest((uint256 escrowId,address buyer,address seller,uint256 amount,bytes32 evidenceHash,uint8 rulingType,uint16 splitBps,uint256 arbiterNonce,uint64 expiry) r) view returns (bytes32)",
  "function domainSeparator() view returns (bytes32)",
  "event EscrowCreated(uint256 indexed escrowId, address indexed buyer, address indexed seller, uint256 amount, string description, uint64 deliveryDeadline, uint64 disputeWindow)",
  "event Delivered(uint256 indexed escrowId)",
  "event Released(uint256 indexed escrowId, uint256 amount)",
  "event EvidenceSubmitted(uint256 indexed escrowId, address indexed party, bytes32 evidenceHash)",
  "event DisputeOpened(uint256 indexed escrowId, address indexed party, bytes32 evidenceHash, uint64 disputeOpenedAt)",
  "event RulingRecorded(uint256 indexed escrowId, bytes32 indexed rulingHash, uint8 rulingType, uint16 splitBps, uint64 recordUntil)",
  "event RulingApproved(uint256 indexed escrowId, address indexed party, bytes32 indexed rulingHash)",
  "event EscrowSettled(uint256 indexed escrowId, uint256 amountToBuyer, uint256 amountToSeller, string outcome)",
  "event RulingSettled(uint256 indexed escrowId, uint8 rulingType, uint16 splitBps)",
]);

export const EIP712_DOMAIN = {
  name: "EscrowLens",
  version: "1",
  chainId: CHAIN_ID,
  verifyingContract: CONTRACT,
} as const;

export const EIP712_TYPES = {
  Ruling: [
    { name: "escrowId", type: "uint256" },
    { name: "buyer", type: "address" },
    { name: "seller", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "evidenceHash", type: "bytes32" },
    { name: "rulingType", type: "uint8" },
    { name: "splitBps", type: "uint16" },
    { name: "arbiterNonce", type: "uint256" },
    { name: "expiry", type: "uint64" },
  ],
} as const;

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

let _read: ReturnType<typeof createPublicClient> | null = null;

export function readClient() {
  if (!_read) {
    _read = createPublicClient({
      chain: monadTestnet,
      transport: http(process.env.NEXT_PUBLIC_MONAD_RPC ?? "https://testnet-rpc.monad.xyz"),
    });
  }
  return _read;
}

export type EscrowState = {
  id: bigint;
  buyer: string;
  seller: string;
  amount: bigint;
  description: string;
  deliveryDeadline: bigint;
  disputeWindow: bigint;
  disputeOpenedAt: bigint;
  rulingDeadline: bigint;
  buyerEvidenceHash: string;
  sellerEvidenceHash: string;
  pendingRulingType: number;
  pendingSplitBps: number;
  status: number;
};

export async function readEscrow(id: bigint): Promise<EscrowState | null> {
  if (!CONTRACT) return null;
  try {
    const r = await readClient().readContract({
      address: CONTRACT,
      abi: ESCROW_ABI,
      functionName: "getEscrow",
      args: [id],
    });
    const [
      buyer, seller, amount, description, deliveryDeadline, disputeWindow,
      disputeOpenedAt, rulingDeadline, buyerEvidenceHash, sellerEvidenceHash,
      pendingRulingType, pendingSplitBps, status,
    ] = r as [string, string, bigint, string, bigint, bigint, bigint, bigint, string, string, number, number, number];
    return {
      id, buyer, seller, amount, description, deliveryDeadline, disputeWindow,
      disputeOpenedAt, rulingDeadline, buyerEvidenceHash, sellerEvidenceHash,
      pendingRulingType, pendingSplitBps, status,
    };
  } catch {
    return null;
  }
}

export async function readEscrowCount(): Promise<number> {
  if (!CONTRACT) return 0;
  try {
    const n = await readClient().readContract({
      address: CONTRACT, abi: ESCROW_ABI, functionName: "escrowCount",
    });
    return Number(n);
  } catch {
    return 0;
  }
}

export async function readArbiter(): Promise<string> {
  if (!CONTRACT) return "";
  try {
    return (await readClient().readContract({
      address: CONTRACT, abi: ESCROW_ABI, functionName: "arbiter",
    })) as string;
  } catch {
    return "";
  }
}

export async function readRulingNonce(id: bigint): Promise<bigint> {
  return (await readClient().readContract({
    address: CONTRACT, abi: ESCROW_ABI, functionName: "rulingNonce", args: [id],
  })) as bigint;
}

export async function readApprovals(id: bigint, parties: [string, string]): Promise<[boolean, boolean]> {
  const c = readClient();
  const [a, b] = await Promise.all(parties.map((p) =>
    c.readContract({
      address: CONTRACT, abi: ESCROW_ABI, functionName: "rulingApproved",
      args: [id, p as `0x${string}`],
    })
  ));
  return [Boolean(a), Boolean(b)];
}

/* ------------------------------------------------------------------ */
/* Event scan — complete history since the deploy block                */
/* ------------------------------------------------------------------ */

export type EventRecord = {
  name: string;
  args: Record<string, unknown>;
  txHash: string;
  blockNumber: bigint;
};

export async function scanEvents(): Promise<EventRecord[]> {
  if (!CONTRACT) return [];
  const client = readClient();
  const head = await client.getBlockNumber();
  const names = [
    "EscrowCreated", "Delivered", "Released", "EvidenceSubmitted",
    "DisputeOpened", "RulingRecorded", "RulingApproved", "EscrowSettled", "RulingSettled",
  ] as const;
  const out: EventRecord[] = [];
  const CH = BigInt(40000);
  for (let from = BigInt(DEPLOY_BLOCK); from <= head; from += CH) {
    const to = from + CH - 1n > head ? head : from + CH - 1n;
    const logs = await client.getLogs({
      address: CONTRACT,
      events: ESCROW_ABI.filter((a) => a.type === "event") as never,
      fromBlock: from,
      toBlock: to,
    });
    for (const l of logs) {
      const ev = l as unknown as { eventName: string; args: Record<string, unknown>; transactionHash: string; blockNumber: bigint };
      if (names.includes(ev.eventName as (typeof names)[number])) {
        out.push({ name: ev.eventName, args: ev.args, txHash: ev.transactionHash, blockNumber: ev.blockNumber });
      }
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Derived index — the trust record per escrow                         */
/* ------------------------------------------------------------------ */

export type EvidenceItem = {
  party: string;
  hash: string;
  txHash: string;
  blockNumber: number;
};

export type EscrowRecord = {
  id: number;
  createdAt?: number;
  buyer?: string;
  seller?: string;
  amount?: bigint;
  description?: string;
  deliveryDeadline?: bigint;
  disputeWindow?: bigint;
  evidence: EvidenceItem[];
  dispute?: { party: string; evidenceHash: string; openedAt: bigint; txHash: string };
  ruling?: { rulingHash: string; rulingType: number; splitBps: number; recordUntil: bigint; txHash: string };
  approvals: { party: string; rulingHash: string; txHash: string }[];
  settlement?: { toBuyer: bigint; toSeller: bigint; outcome: string; txHash: string; rulingType?: number; splitBps?: number };
  txs: { label: string; txHash: string }[];
};

export function buildIndex(events: EventRecord[]): Map<number, EscrowRecord> {
  const idx = new Map<number, EscrowRecord>();
  const rec = (id: number): EscrowRecord => {
    let r = idx.get(id);
    if (!r) {
      r = { id, evidence: [], approvals: [], txs: [] };
      idx.set(id, r);
    }
    return r;
  };
  const num = (v: unknown) => Number(v);

  for (const e of events) {
    const a = e.args as never as Record<string, never>;
    const id = num(a.escrowId);
    switch (e.name) {
      case "EscrowCreated": {
        const r = rec(id);
        r.buyer = a.buyer as string;
        r.seller = a.seller as string;
        r.amount = a.amount as bigint;
        r.description = a.description as string;
        r.deliveryDeadline = a.deliveryDeadline as bigint;
        r.disputeWindow = a.disputeWindow as bigint;
        r.createdAt = Number(e.blockNumber);
        r.txs.push({ label: "Escrow created", txHash: e.txHash });
        break;
      }
      case "Delivered":
        rec(id).txs.push({ label: "Marked delivered", txHash: e.txHash });
        break;
      case "Released":
        rec(id).txs.push({ label: "Released by buyer", txHash: e.txHash });
        break;
      case "EvidenceSubmitted":
        rec(id).evidence.push({
          party: a.party as string,
          hash: a.evidenceHash as string,
          txHash: e.txHash,
          blockNumber: Number(e.blockNumber),
        });
        break;
      case "DisputeOpened": {
        const r = rec(id);
        r.dispute = {
          party: a.party as string,
          evidenceHash: a.evidenceHash as string,
          openedAt: a.disputeOpenedAt as bigint,
          txHash: e.txHash,
        };
        r.txs.push({ label: "Dispute opened", txHash: e.txHash });
        break;
      }
      case "RulingRecorded": {
        const r = rec(id);
        r.ruling = {
          rulingHash: a.rulingHash as string,
          rulingType: num(a.rulingType),
          splitBps: num(a.splitBps),
          recordUntil: a.recordUntil as bigint,
          txHash: e.txHash,
        };
        r.txs.push({ label: "Ruling recorded", txHash: e.txHash });
        break;
      }
      case "RulingApproved": {
        const r = rec(id);
        r.approvals.push({ party: a.party as string, rulingHash: a.rulingHash as string, txHash: e.txHash });
        r.txs.push({ label: "Ruling approved", txHash: e.txHash });
        break;
      }
      case "EscrowSettled": {
        const r = rec(id);
        r.settlement = {
          toBuyer: a.amountToBuyer as bigint,
          toSeller: a.amountToSeller as bigint,
          outcome: a.outcome as string,
          txHash: e.txHash,
        };
        r.txs.push({ label: "Settled", txHash: e.txHash });
        break;
      }
      case "RulingSettled": {
        const r = rec(id);
        if (r.settlement) {
          r.settlement.rulingType = num(a.rulingType);
          r.settlement.splitBps = num(a.splitBps);
        }
        break;
      }
    }
  }
  return idx;
}

/** Complete trust record for one escrow: chain state + event history. */
export async function fetchTrustRecord(id: number): Promise<{
  state: EscrowState | null;
  record: EscrowRecord | null;
  approvals: [boolean, boolean];
} | null> {
  if (!CONTRACT) return null;
  const state = await readEscrow(BigInt(id));
  if (!state) return null;
  const events = await scanEvents();
  const idx = buildIndex(events);
  const record = idx.get(id) ?? null;
  const approvals = await readApprovals(BigInt(id), [state.buyer, state.seller]);
  return { state, record, approvals };
}

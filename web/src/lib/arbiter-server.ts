import { createPublicClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "./monad";

/**
 * AI arbiter service — SERVER ONLY.
 *
 * - Calls Kimi (Moonshot) or Qwen (Alibaba DashScope Intl), OpenAI-compatible.
 * - Enforces a strict JSON verdict schema; malformed output is rejected.
 * - Re-reads escrow state from the RPC so the verdict is bound to real
 *   on-chain terms, never to client-supplied values.
 * - Signs the EIP-712 ruling with the arbiter key. The arbiter can NEVER
 *   move funds — only a buyer/seller transaction records the ruling.
 */

const KIMI_URL = "https://api.moonshot.ai/v1/chat/completions";
const QWEN_URL = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions";
const KIMI_MODEL = "kimi-k2.6";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL = "qwen/qwen3.8-27b:free";
const QWEN_MODEL = "qwen3.8-max";

const CONTRACT = process.env.NEXT_PUBLIC_ESCROW_CONTRACT as `0x${string}`;
const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 10143);

const ESCROW_ABI_SERVER = [
  {
    type: "function",
    name: "getEscrow",
    stateMutability: "view",
    inputs: [{ name: "escrowId", type: "uint256" }],
    outputs: [
      { name: "buyer", type: "address" },
      { name: "seller", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "description", type: "string" },
      { name: "deliveryDeadline", type: "uint64" },
      { name: "disputeWindow", type: "uint64" },
      { name: "disputeOpenedAt", type: "uint64" },
      { name: "rulingDeadline", type: "uint64" },
      { name: "buyerEvidenceHash", type: "bytes32" },
      { name: "sellerEvidenceHash", type: "bytes32" },
      { name: "pendingRulingType", type: "uint8" },
      { name: "pendingSplitBps", type: "uint16" },
      { name: "status", type: "uint8" },
    ],
  },
  {
    type: "function",
    name: "combinedEvidenceHash",
    stateMutability: "view",
    inputs: [{ name: "escrowId", type: "uint256" }],
    outputs: [{ name: "", type: "bytes32" }],
  },
  {
    type: "function",
    name: "rulingNonce",
    stateMutability: "view",
    inputs: [{ name: "escrowId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export type ArbiterVerdict = {
  rulingType: "RELEASE_BUYER" | "RELEASE_SELLER" | "SPLIT";
  splitBps: number;
  confidence: number;
  findings: { title: string; status: "satisfied" | "partial" | "unmet" | "unknown"; detail: string }[];
  reasoning: string;
};

export type SignedAnalysis = {
  verdict: ArbiterVerdict;
  ruling: {
    escrowId: number;
    buyer: string;
    seller: string;
    amount: string;
    evidenceHash: string;
    rulingType: number;
    splitBps: number;
    arbiterNonce: string;
    expiry: number;
  };
  signature: string;
  provider: string;
  model: string;
};

function systemPrompt(): string {
  return `You are the EscrowLens arbitration engine: an independent instrument that reviews disputed peer-to-peer escrows and issues a deterministic recommendation.

You receive the on-chain escrow terms (authoritative) and optional statements from buyer and seller (claims, not verified facts). Evidence exists as cryptographic hashes on-chain; statements describe what each hash represents.

Rules:
- You NEVER invent facts. If the statements do not establish something, mark it "unknown".
- You are biased toward evidence specificity: concrete, checkable claims weigh more than adjectives.
- A buyer who received nothing after a missed delivery deadline favors RELEASE_BUYER.
- A seller with consistent, specific delivery evidence before the deadline favors RELEASE_SELLER.
- Use SPLIT only when both parties clearly performed partially; give an exact splitBps (100-lesson: use round numbers).
- confidence is 0-100 and must be honest: low when statements are thin.

Respond with ONLY this JSON object, no prose, no code fences:
{
  "rulingType": "RELEASE_BUYER" | "RELEASE_SELLER" | "SPLIT",
  "splitBps": <integer 0-10000, share to seller; 0 or 10000 for non-SPLIT>,
  "confidence": <integer 0-100>,
  "findings": [
    { "title": "<short finding>", "status": "satisfied" | "partial" | "unmet" | "unknown", "detail": "<one precise sentence>" }
  ],
  "reasoning": "<2-4 sentences, audit-style, referencing the findings>"
}`;
}

type Provider = "kimi" | "qwen" | "openrouter";

async function callLLM(
  provider: Provider,
  userContent: string
): Promise<{ text: string; model: string }> {
  const key =
    provider === "kimi"
      ? process.env.KIMI_API_KEY
      : provider === "qwen"
        ? process.env.QWEN_API_KEY
        : process.env.OPENROUTER_API_KEY;
  if (!key || !key.trim()) throw new Error(`NO_KEY:${provider}`);
  const authKey = key.trim();
  const url =
    provider === "kimi" ? KIMI_URL : provider === "qwen" ? QWEN_URL : OPENROUTER_URL;
  const model =
    process.env.LLM_MODEL ||
    (provider === "kimi" ? KIMI_MODEL : provider === "qwen" ? QWEN_MODEL : OPENROUTER_MODEL);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authKey}`,
      ...(provider === "openrouter" ? { "X-Title": "EscrowLens" } : {}),
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt() },
        { role: "user", content: userContent },
      ],
      temperature: 0,
      max_tokens: 1200,
    }),
  });
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  if (!res.ok || !data.choices?.[0]?.message?.content) {
    throw new Error(`LLM_ERROR:${provider}:${data.error?.message ?? res.status}`);
  }
  return { text: data.choices[0].message.content, model };
}

function extractJson(raw: string): ArbiterVerdict {
  const cleaned = raw.replace(/```json|```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("MALFORMED:no JSON object in model output");
  const parsed = JSON.parse(cleaned.slice(start, end + 1)) as ArbiterVerdict;
  const types = ["RELEASE_BUYER", "RELEASE_SELLER", "SPLIT"];
  if (!types.includes(parsed.rulingType)) throw new Error("MALFORMED:bad rulingType");
  if (!Number.isInteger(parsed.splitBps) || parsed.splitBps < 0 || parsed.splitBps > 10000)
    throw new Error("MALFORMED:bad splitBps");
  if (parsed.rulingType !== "SPLIT") parsed.splitBps = 0;
  if (parsed.rulingType === "SPLIT" && (parsed.splitBps === 0 || parsed.splitBps === 10000))
    throw new Error("MALFORMED:SPLIT must be a real split");
  if (!Number.isInteger(parsed.confidence) || parsed.confidence < 0 || parsed.confidence > 100)
    throw new Error("MALFORMED:bad confidence");
  if (!Array.isArray(parsed.findings) || parsed.findings.length === 0)
    throw new Error("MALFORMED:findings required");
  parsed.findings = parsed.findings.slice(0, 8).map((f) => ({
    title: String(f.title).slice(0, 120),
    status: (["satisfied", "partial", "unmet", "unknown"] as const).includes(f.status) ? f.status : "unknown",
    detail: String(f.detail).slice(0, 400),
  }));
  if (typeof parsed.reasoning !== "string" || parsed.reasoning.length < 10)
    throw new Error("MALFORMED:reasoning required");
  parsed.reasoning = parsed.reasoning.slice(0, 1200);
  return parsed;
}

const TYPE_TO_ENUM = { RELEASE_BUYER: 0, RELEASE_SELLER: 1, SPLIT: 2 } as const;

export async function analyzeDispute(input: {
  escrowId: number;
  buyerStatement?: string;
  sellerStatement?: string;
}): Promise<SignedAnalysis> {
  const client = createPublicClient({
    chain: monadTestnet,
    transport: http(process.env.NEXT_PUBLIC_MONAD_RPC ?? "https://testnet-rpc.monad.xyz"),
  });

  const e = await client.readContract({
    address: CONTRACT,
    abi: ESCROW_ABI_SERVER,
    functionName: "getEscrow",
    args: [BigInt(input.escrowId)],
  });
  const [buyer, seller, amount, description, deliveryDeadline, , disputeOpenedAt, , , , , , status] = e as [
    string, string, bigint, string, bigint, bigint, bigint, bigint, string, string, number, number, number,
  ];
  if (status !== 2) throw new Error("NOT_DISPUTED");

  const [evidenceHash, arbiterNonce] = await Promise.all([
    client.readContract({ address: CONTRACT, abi: ESCROW_ABI_SERVER, functionName: "combinedEvidenceHash", args: [BigInt(input.escrowId)] }),
    client.readContract({ address: CONTRACT, abi: ESCROW_ABI_SERVER, functionName: "rulingNonce", args: [BigInt(input.escrowId)] }),
  ]);

  const order = providerOrder();
  let verdict: ArbiterVerdict | null = null;
  let used = { provider: "", model: "" };
  const attempts: { provider: string; error: string }[] = [];

  for (const p of order) {
    try {
      const { text, model } = await callLLM(
        p,
        `ESCROW #${input.escrowId} (on-chain, authoritative)
Description: ${description}
Amount: ${Number(amount) / 1e18} MON
Delivery deadline (unix): ${Number(deliveryDeadline)}
Dispute opened (unix): ${Number(disputeOpenedAt)}

BUYER STATEMENT:
${input.buyerStatement?.trim() || "(not provided)"}

SELLER STATEMENT:
${input.sellerStatement?.trim() || "(not provided)"}

Deliver the JSON verdict now.`
      );
      verdict = extractJson(text);
      used = { provider: p, model };
      break;
    } catch (err) {
      attempts.push({ provider: p, error: ((err as Error).message ?? "unknown").slice(0, 300) });
    }
  }
  if (!verdict) {
    const keyless = attempts.length > 0 && attempts.every((a) => a.error.startsWith("NO_KEY:"));
    if (keyless) throw new Error("NO_PROVIDER_KEY");
    throw new Error(`ALL_PROVIDERS_FAILED:${JSON.stringify(attempts)}`);
  }

  const expiry = Math.floor(Date.now() / 1000) + 2 * 3600;
  const ruling = {
    escrowId: input.escrowId,
    buyer,
    seller,
    amount,
    evidenceHash: evidenceHash as string,
    rulingType: TYPE_TO_ENUM[verdict.rulingType],
    splitBps: verdict.splitBps,
    arbiterNonce,
    expiry: BigInt(expiry),
  };

  const arbiterAccount = privateKeyToAccount(process.env.ARBITER_PRIVATE_KEY! as `0x${string}`);
  const signature = await arbiterAccount.signTypedData({
    domain: { name: "EscrowLens", version: "1", chainId: CHAIN_ID, verifyingContract: CONTRACT },
    types: {
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
    },
    primaryType: "Ruling",
    message: {
      escrowId: BigInt(input.escrowId),
      buyer: buyer as `0x${string}`,
      seller: seller as `0x${string}`,
      amount,
      evidenceHash: evidenceHash as `0x${string}`,
      rulingType: TYPE_TO_ENUM[verdict.rulingType],
      splitBps: verdict.splitBps,
      arbiterNonce,
      expiry: BigInt(expiry),
    },
  });

  return {
    verdict,
    ruling: {
      escrowId: input.escrowId,
      buyer,
      seller,
      amount: amount.toString(),
      evidenceHash: evidenceHash,
      rulingType: ruling.rulingType,
      splitBps: verdict.splitBps,
      arbiterNonce: arbiterNonce.toString(),
      expiry,
    },
    signature,
    provider: used.provider,
    model: used.model,
  };
}

function providerOrder(): Provider[] {
  const pref = (process.env.LLM_PROVIDER ?? "kimi") as Provider;
  const all: Provider[] = ["kimi", "qwen", "openrouter"];
  return [pref, ...all.filter((x) => x !== pref)];
}

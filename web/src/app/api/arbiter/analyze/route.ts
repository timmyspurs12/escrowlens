import { NextResponse } from "next/server";
import { analyzeDispute } from "@/lib/arbiter-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/arbiter/analyze
 * Body: { escrowId: number, buyerStatement?: string, sellerStatement?: string }
 *
 * The server re-reads the escrow from the RPC — client-supplied terms are
 * never trusted. Statements are used as claims for the model only; they are
 * never written on-chain (privacy posture: hashes on-chain, plaintext stays
 * off-chain).
 */
export async function POST(req: Request) {
  let body: { escrowId?: number; buyerStatement?: string; sellerStatement?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const escrowId = Number(body.escrowId);
  if (!Number.isInteger(escrowId) || escrowId < 0) {
    return NextResponse.json({ error: "escrowId must be a non-negative integer." }, { status: 400 });
  }

  try {
    const result = await analyzeDispute({
      escrowId,
      buyerStatement: body.buyerStatement?.slice(0, 4000),
      sellerStatement: body.sellerStatement?.slice(0, 4000),
    });
    return NextResponse.json(result);
  } catch (err) {
    const msg = (err as Error).message ?? "unknown";
    if (msg === "NOT_DISPUTED") {
      return NextResponse.json({ error: "This escrow is not in dispute state." }, { status: 409 });
    }
    if (msg === "NO_PROVIDER_KEY") {
      // Diagnostics: report which arbiter key NAMES the runtime can see
      // (booleans only — never values).
      const present = [
        "KIMI_API_KEY",
        "QWEN_API_KEY",
        "OPENROUTER_API_KEY",
      ].filter((k) => Boolean(process.env[k]));
      return NextResponse.json(
        {
          error: "No arbiter model key is configured. Add KIMI_API_KEY, QWEN_API_KEY, or OPENROUTER_API_KEY (server env).",
          keysPresentInRuntime: present,
        },
        { status: 503 }
      );
    }
    if (msg.startsWith("LLM_ERROR")) {
      if (msg.includes("insufficient balance") || msg.includes("exceeded_current_quota")) {
        return NextResponse.json(
          { error: `The arbiter model account has no balance. ${msg.split("LLM_ERROR:")[1]}` },
          { status: 502 }
        );
      }
      return NextResponse.json({ error: `Arbiter model unavailable. ${msg.split("LLM_ERROR:")[1] ?? ""}` }, { status: 502 });
    }
    if (msg.startsWith("MALFORMED:")) {
      return NextResponse.json({ error: `Arbiter output rejected — ${msg.split(":")[1]}` }, { status: 422 });
    }
    if (msg.startsWith("ALL_PROVIDERS_FAILED:")) {
      let attempts: unknown = msg.slice("ALL_PROVIDERS_FAILED:".length);
      try { attempts = JSON.parse(attempts as string); } catch { /* keep raw */ }
      return NextResponse.json(
        { error: "All configured arbiter providers failed.", attempts },
        { status: 502 }
      );
    }
    if (msg.startsWith("ANALYSIS_FAILED")) {
      return NextResponse.json({ error: "All configured arbiter providers failed." }, { status: 502 });
    }
    return NextResponse.json({ error: "Arbitration analysis failed." }, { status: 500 });
  }
}

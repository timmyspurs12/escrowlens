/**
 * Party statements are privacy-preserving by design: they live off-chain,
 * in the party's own browser, and are passed to the arbiter at review time.
 * Only their SHA-256 hashes touch the chain.
 */

export type Statements = { buyerStatement?: string; sellerStatement?: string };

const key = (id: number, party: "buyer" | "seller") => `escrowlens:statement:${id}:${party}`;

export function saveStatement(id: number, party: "buyer" | "seller", text: string) {
  try {
    localStorage.setItem(key(id, party), text);
  } catch {
    /* storage unavailable — statements are optional */
  }
}

export function loadStatements(id: number): Statements {
  try {
    return {
      buyerStatement: localStorage.getItem(key(id, "buyer")) ?? undefined,
      sellerStatement: localStorage.getItem(key(id, "seller")) ?? undefined,
    };
  } catch {
    return {};
  }
}

export async function sha256Hex(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return (
    "0x" +
    Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
  );
}

/**
 * Dependency-free JSON-RPC readers used on the landing page.
 * Selectors are precomputed (keccak4) so this file never imports viem:
 *   escrowCount()(uint256) -> 0xdb9dc824
 *   arbiter()(address)     -> 0x74c8f90a
 */
import { RPC_URL, CONTRACT } from "./env";

async function ethCall(data: string): Promise<string> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: CONTRACT, data }, "latest"],
    }),
  });
  const json = (await res.json()) as { result?: string; error?: unknown };
  if (!json.result) throw new Error("rpc_error");
  return json.result;
}

export async function readEscrowCountLite(): Promise<number | null> {
  if (!CONTRACT) return null;
  try {
    return Number(BigInt(await ethCall("0xdb9dc824")));
  } catch {
    return null;
  }
}

export async function readArbiterLite(): Promise<string> {
  if (!CONTRACT) return "";
  try {
    const hex = await ethCall("0x74c8f90a");
    return `0x${hex.slice(-40)}`;
  } catch {
    return "";
  }
}

/**
 * Pure environment constants — ZERO imports.
 * Safe to pull into any graph (app shell, landing) without dragging viem in.
 */
export const RPC_URL =
  process.env.NEXT_PUBLIC_MONAD_RPC ?? "https://testnet-rpc.monad.xyz";
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 10143);
export const CONTRACT = (process.env.NEXT_PUBLIC_ESCROW_CONTRACT ?? "") as `0x${string}`;
export const DEPLOY_BLOCK = Number(process.env.NEXT_PUBLIC_DEPLOY_BLOCK ?? 64389959);

import type { Chain } from "viem";
import { RPC_URL, CHAIN_ID } from "./env";

/**
 * Monad Testnet — chain 10143.
 * Plain-object definition (typed as viem Chain) so importing this file
 * never pulls the viem runtime into a page's compile graph.
 */
export const monadTestnet = {
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "Monad Explorer", url: "https://testnet.monadexplorer.com" } },
  testnet: true,
} as unknown as Chain;

export { CONTRACT as ESCROW_CONTRACT, CHAIN_ID, DEPLOY_BLOCK } from "./env";

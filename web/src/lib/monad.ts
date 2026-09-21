import { defineChain } from "viem";

/**
 * Monad Testnet — chain 10143.
 * Not yet exported by @privy-io/chains (only mainnet 143), so we define it.
 * RPC + explorer per docs.monad.xyz.
 */
export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_MONAD_RPC ?? "https://testnet-rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: { name: "Monad Explorer", url: "https://testnet.monadexplorer.com" },
  },
  testnet: true,
});

export const ESCROW_CONTRACT = process.env.NEXT_PUBLIC_ESCROW_CONTRACT ?? "";
export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 10143);

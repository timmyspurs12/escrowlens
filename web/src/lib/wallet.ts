"use client";

import { useCallback, useState } from "react";
import { createWalletClient, custom, parseAbi } from "viem";
import { useWallets } from "@privy-io/react-auth";
import { monadTestnet, ESCROW_CONTRACT, CHAIN_ID } from "./monad";
import { ESCROW_ABI, readClient } from "./escrow";

const MONAD_HEX = `0x${CHAIN_ID.toString(16)}`;

async function walletClientFromProvider(provider: unknown, account: string) {
  return createWalletClient({
    account: account as `0x${string}`,
    chain: monadTestnet,
    transport: custom(provider as never),
  });
}

async function ensureChain(provider: { request: (a: unknown) => Promise<unknown> }) {
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: MONAD_HEX }] });
  } catch (err) {
    const code = (err as { code?: number }).code;
    if (code === 4902 || code === -32603) {
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: MONAD_HEX,
            chainName: "Monad Testnet",
            nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
            rpcUrls: [process.env.NEXT_PUBLIC_MONAD_RPC ?? "https://testnet-rpc.monad.xyz"],
            blockExplorerUrls: ["https://testnet.monadexplorer.com"],
          },
        ],
      });
    } else {
      throw err;
    }
  }
}

export type TxState = "idle" | "signing" | "confirming" | "done" | "error";

export function useEscrowWrites() {
  const { wallets, ready } = useWallets();
  const [txState, setTxState] = useState<TxState>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wallet = wallets.find((w) => w.address) ?? wallets[0];

  const run = useCallback(
    async (fn: (wc: Awaited<ReturnType<typeof walletClientFromProvider>>) => Promise<`0x${string}`>) => {
      setError(null);
      setTxHash(null);
      if (!wallet) {
        setError("Sign in first — your passkey wallet is needed to authorize this.");
        setTxState("error");
        return null;
      }
      try {
        setTxState("signing");
        const provider = (await wallet.getEthereumProvider()) as unknown as {
          request: (a: unknown) => Promise<unknown>;
        };
        await ensureChain(provider);
        const wc = await walletClientFromProvider(provider, wallet.address);
        const hash = await fn(wc);
        setTxHash(hash);
        setTxState("confirming");
        await readClient().waitForTransactionReceipt({ hash, confirmations: 1 });
        setTxState("done");
        return hash;
      } catch (e) {
        const msg =
          (e as { shortMessage?: string; message?: string }).shortMessage ??
          (e as { message?: string }).message ??
          "Transaction not completed. No funds were moved.";
        setError(userFriendly(msg));
        setTxState("error");
        return null;
      }
    },
    [wallet]
  );

  const createEscrow = (seller: string, description: string, deliveryDeadline: bigint, disputeWindow: bigint, value: bigint) =>
    run((wc) =>
      wc.writeContract({
        address: ESCROW_CONTRACT as `0x${string}`,
        abi: ESCROW_ABI,
        functionName: "createEscrow",
        args: [seller as `0x${string}`, description, deliveryDeadline, disputeWindow],
        value,
      })
    );

  const markDelivered = (id: bigint) =>
    run((wc) => wc.writeContract({ address: ESCROW_CONTRACT as `0x${string}`, abi: ESCROW_ABI, functionName: "markDelivered", args: [id] }));

  const releaseToSeller = (id: bigint) =>
    run((wc) => wc.writeContract({ address: ESCROW_CONTRACT as `0x${string}`, abi: ESCROW_ABI, functionName: "releaseToSeller", args: [id] }));

  const openDispute = (id: bigint, evidenceHash: `0x${string}`) =>
    run((wc) => wc.writeContract({ address: ESCROW_CONTRACT as `0x${string}`, abi: ESCROW_ABI, functionName: "openDispute", args: [id, evidenceHash] }));

  const submitEvidence = (id: bigint, evidenceHash: `0x${string}`) =>
    run((wc) => wc.writeContract({ address: ESCROW_CONTRACT as `0x${string}`, abi: ESCROW_ABI, functionName: "submitEvidence", args: [id, evidenceHash] }));

  const submitRuling = (
    r: {
      escrowId: bigint; buyer: string; seller: string; amount: bigint; evidenceHash: string;
      rulingType: number; splitBps: number; arbiterNonce: bigint; expiry: bigint;
    },
    signature: string
  ) =>
    run((wc) =>
      wc.writeContract({
        address: ESCROW_CONTRACT as `0x${string}`,
        abi: ESCROW_ABI,
        functionName: "submitRuling",
        args: [
          {
            escrowId: r.escrowId, buyer: r.buyer as `0x${string}`, seller: r.seller as `0x${string}`,
            amount: r.amount, evidenceHash: r.evidenceHash as `0x${string}`,
            rulingType: r.rulingType, splitBps: r.splitBps, arbiterNonce: r.arbiterNonce, expiry: r.expiry,
          },
          signature as `0x${string}`,
        ],
      })
    );

  const approveRuling = (id: bigint) =>
    run((wc) => wc.writeContract({ address: ESCROW_CONTRACT as `0x${string}`, abi: ESCROW_ABI, functionName: "approveRuling", args: [id] }));

  const expire = (id: bigint) =>
    run((wc) => wc.writeContract({ address: ESCROW_CONTRACT as `0x${string}`, abi: ESCROW_ABI, functionName: "expire", args: [id] }));

  return {
    ready,
    address: wallet?.address ?? null,
    txState,
    txHash,
    error,
    createEscrow,
    markDelivered,
    releaseToSeller,
    openDispute,
    submitEvidence,
    submitRuling,
    approveRuling,
    expire,
  };
}

/** Contract reverts and wallet errors → calm, honest sentences. */
function userFriendly(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes("user rejected") || r.includes("user denied")) {
    return "You declined the signature request. Nothing was sent.";
  }
  if (r.includes("insufficient")) {
    return "Not enough MON in your wallet for this action plus network fees.";
  }
  if (r.includes("notparty")) {
    return "Only the buyer or seller of this escrow can perform this action.";
  }
  if (r.includes("notrulingpending")) {
    return "This escrow is not currently awaiting ruling approval.";
  }
  if (r.includes("rulingapprovalwindowclosed")) {
    return "The approval window has closed. The fallback refund can now be triggered.";
  }
  if (r.includes("rulingexpired")) {
    return "That ruling has expired. Request a fresh arbiter review.";
  }
  if (r.includes("notdisputed")) {
    return "This escrow is not in dispute, so a ruling cannot be recorded.";
  }
  if (r.includes("alreadyapproved")) {
    return "You have already approved this ruling.";
  }
  if (r.includes("invalidrulingdata")) {
    return "The ruling does not match the escrow's on-chain terms and was rejected.";
  }
  if (r.includes("invalidarbitersignature")) {
    return "The arbiter's signature is invalid for this escrow.";
  }
  return raw.length > 220 ? "Transaction not completed. No funds were moved." : raw;
}

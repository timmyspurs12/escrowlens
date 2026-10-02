import Link from "next/link";
import { decodeEventLog } from "viem";
import { ESCROW_ABI, CONTRACT, readClient } from "@/lib/escrow";
import { fmtMon, fmtDateUTC, shortenAddress, shortenHash } from "@/lib/format";
import { SectionLabel, TrustSignal } from "@/components/ui";

export const dynamic = "force-dynamic";

type TxLog = { data: `0x${string}`; topics: [] | [`0x${string}`, ...`0x${string}`[]] };

type Decoded = {
  name: string;
  entries: [string, string][];
  escrowId?: number;
};

function fmtArg(v: unknown): string {
  if (typeof v === "bigint") return v.toString();
  if (typeof v === "string") return v.length === 66 && v.startsWith("0x") ? shortenHash(v) : v;
  if (Array.isArray(v)) return v.map(fmtArg).join(", ");
  return String(v);
}

function decodeLogs(logs: TxLog[]): Decoded[] {
  const out: Decoded[] = [];
  for (const log of logs) {
    try {
      const ev = decodeEventLog({ abi: ESCROW_ABI, data: log.data, topics: log.topics });
      const args = ev.args as Record<string, unknown>;
      const rec: Decoded = {
        name: ev.eventName,
        entries: Object.entries(args).map(([k, v]) => [k, fmtArg(v)]),
      };
      if (typeof args.escrowId === "bigint") rec.escrowId = Number(args.escrowId);
      out.push(rec);
    } catch {
      const rows: [string, string][] = log.topics.map((t, i) => [`topic${i}`, shortenHash(t)]);
      if (log.data && log.data !== "0x") rows.push(["data", shortenHash(log.data)]);
      out.push({ name: "UNKNOWN EVENT", entries: rows });
    }
  }
  return out;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line/60 pb-2">
      <span className="label-mono !text-[10px] !text-ink-3">{label}</span>
      {children}
    </div>
  );
}

export default async function TxPage({ params }: { params: Promise<{ hash: string }> }) {
  const { hash: rawHash } = await params;
  const hash = rawHash.startsWith("0x") ? rawHash : `0x${rawHash}`;
  const valid = /^0x[0-9a-fA-F]{64}$/.test(hash);

  type TxData = Awaited<ReturnType<ReturnType<typeof readClient>["getTransaction"]>>;
  type RcptData = Awaited<ReturnType<ReturnType<typeof readClient>["getTransactionReceipt"]>>;
  let tx: TxData | null = null;
  let receipt: RcptData | null = null;
  let blockTime: bigint | null = null;
  let fetchError: string | null = null;

  if (valid) {
    try {
      const client = readClient();
      tx = await client.getTransaction({ hash: hash as `0x${string}` });
      receipt = await client.getTransactionReceipt({ hash: hash as `0x${string}` });
      const block = await client.getBlock({ blockNumber: receipt.blockNumber });
      blockTime = block.timestamp;
    } catch (e) {
      fetchError = (e as Error).message?.slice(0, 200) ?? "unknown RPC error";
    }
  }

  const success = receipt?.status === "success";
  const isOurs = tx?.to?.toLowerCase() === CONTRACT.toLowerCase();
  const decoded = receipt && isOurs ? decodeLogs(receipt.logs as TxLog[]) : [];

  return (
    <div className="mx-auto w-full max-w-4xl">
      <div className="label-mono !text-ink-3">TRANSACTION · LIVE CHAIN READ</div>
      <h1 className="mt-2 break-all font-mono text-[clamp(1.1rem,3.4vw,1.6rem)] tracking-tight text-ink">
        {shortenHash(hash, 20, 12)}
      </h1>
      <p className="mt-2 max-w-2xl text-[13.5px] leading-relaxed text-ink-2">
        Read directly from Monad testnet over RPC — no third-party indexer in between. Part of
        EscrowLens&apos; public trust trail: every hash shown in the app resolves here, decoded.
      </p>

      {!valid && (
        <div className="mt-8 rounded-[14px] border border-warn/30 bg-warn/5 px-6 py-5">
          <div className="label-mono !text-warn">INVALID HASH</div>
          <p className="mt-2 text-[13.5px] text-ink-2">
            That string is not a 32-byte transaction hash. Hashes look like
            <span className="data-mono"> 0x8ea74982…</span> (66 hex characters).
          </p>
        </div>
      )}

      {valid && !tx && (
        <div className="mt-8 rounded-[14px] border border-warn/30 bg-warn/5 px-6 py-5">
          <div className="label-mono !text-warn">NOT FOUND ON THE RPC (YET)</div>
          <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">
            The chain&apos;s public RPC has no record of this hash. Either the hash is wrong, or
            the node lagged during the read. Cross-check on an independent explorer:
          </p>
          <div className="mt-3 flex flex-wrap gap-3 text-[13px]">
            <a className="focus-ring rounded-[10px] border border-line-strong px-3 py-1.5 text-ink hover:bg-surface-2"
               href={`https://testnet.monadscan.com/tx/${hash}`} target="_blank" rel="noreferrer">
              testnet.monadscan.com ↗
            </a>
            <a className="focus-ring rounded-[10px] border border-line-strong px-3 py-1.5 text-ink hover:bg-surface-2"
               href={`https://testnet.monadexplorer.com/tx/${hash}`} target="_blank" rel="noreferrer">
              testnet.monadexplorer.com ↗
            </a>
          </div>
          {fetchError && <p className="data-mono mt-3 text-[11.5px] text-ink-3">rpc: {fetchError}</p>}
        </div>
      )}

      {tx && receipt && (
        <>
          <div className="mt-8 grid gap-x-8 gap-y-5 rounded-[14px] border border-line bg-surface-1 px-6 py-6 sm:grid-cols-2">
            <Row label="STATUS">
              <span className={`inline-flex items-center gap-2 text-[13px] font-medium ${success ? "text-ok" : "text-risk"}`}>
                <span className={`inline-block size-2 rounded-full ${success ? "bg-ok" : "bg-risk"}`} />
                {success ? "SUCCESS" : "FAILED / REVERTED"}
              </span>
            </Row>
            <Row label="BLOCK">
              <span className="data-mono text-[13px] text-ink">{receipt.blockNumber.toString()}</span>
            </Row>
            <Row label="TIMESTAMP (UTC)">
              <span className="text-[13px] text-ink-2">{blockTime ? fmtDateUTC(Number(blockTime)) : "—"}</span>
            </Row>
            <Row label="VALUE">
              <span className="data-mono text-[13px] text-ink">{fmtMon(tx.value)} MON</span>
            </Row>
            <Row label="FROM">
              <span className="data-mono text-[13px] text-ink-2">{shortenAddress(tx.from, 10, 8)}</span>
            </Row>
            <Row label="TO">
              <span className="data-mono text-[13px] text-ink-2">
                {tx.to ? shortenAddress(tx.to, 10, 8) : "—"}
                {isOurs && <span className="label-mono ml-2 !text-[10px] !text-accent">ESCROWLENS CONTRACT</span>}
              </span>
            </Row>
            <Row label="GAS USED">
              <span className="data-mono text-[13px] text-ink-2">{receipt.gasUsed.toString()}</span>
            </Row>
            <Row label="LOGS">
              <span className="data-mono text-[13px] text-ink-2">{receipt.logs.length}</span>
            </Row>
          </div>

          {isOurs ? (
            <div className="mt-8">
              <SectionLabel right={<span className="label-mono !text-[10px] text-ink-3">{decoded.length} EVENTS</span>}>
                ESCROW EVENTS · DECODED FROM RECEIPT LOGS
              </SectionLabel>
              <div className="mt-4 space-y-3">
                {decoded.map((ev, i) => (
                  <div key={i} className="rounded-[14px] border border-line bg-surface-1 px-6 py-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="label-mono !text-accent">{ev.name}</span>
                      {ev.escrowId !== undefined && (
                        <Link
                          href={`/escrow/${ev.escrowId}`}
                          className="focus-ring rounded-[10px] border border-line-strong px-3 py-1 text-[12px] text-ink hover:bg-surface-2"
                        >
                          Open escrow #{ev.escrowId} →
                        </Link>
                      )}
                    </div>
                    <dl className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
                      {ev.entries.map(([k, v]) => (
                        <div key={k} className="flex items-baseline justify-between gap-4 border-b border-line/60 py-1">
                          <dt className="label-mono !text-[10px] !text-ink-3">{k}</dt>
                          <dd className="data-mono truncate text-[12.5px] text-ink-2" title={v}>{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
                {decoded.length === 0 && (
                  <p className="text-[13.5px] text-ink-2">
                    Transaction succeeded with no escrow events in this receipt.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-8">
              <TrustSignal tone="signal">
                External transaction — not addressed to the EscrowLens contract. Event decoding
                is only performed for EscrowLens interactions.
              </TrustSignal>
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3 text-[13px]">
            <span className="label-mono mr-1 self-center !text-[10px] !text-ink-3">CROSS-CHECK:</span>
            <a className="focus-ring rounded-[10px] border border-line-strong px-3 py-1.5 text-ink hover:bg-surface-2"
               href={`https://testnet.monadscan.com/tx/${hash}`} target="_blank" rel="noreferrer">
              testnet.monadscan.com ↗
            </a>
            <a className="focus-ring rounded-[10px] border border-line-strong px-3 py-1.5 text-ink hover:bg-surface-2"
               href={`https://testnet.monadexplorer.com/tx/${hash}`} target="_blank" rel="noreferrer">
              testnet.monadexplorer.com ↗
            </a>
          </div>
        </>
      )}
    </div>
  );
}

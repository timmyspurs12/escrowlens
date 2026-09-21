
export function shortenAddress(a?: string | null, head = 6, tail = 4): string {
  if (!a) return "—";
  return `${a.slice(0, head)}…${a.slice(-tail)}`;
}

export function shortenHash(h?: string | null, head = 10, tail = 6): string {
  if (!h) return "—";
  return `${h.slice(0, head)}…${h.slice(-tail)}`;
}

const ZERO_HASH = /^0x0+$/;

export function isZeroHash(h?: string | null): boolean {
  return !h || ZERO_HASH.test(h);
}

/** Format a wei value as MON with sensible precision (no viem in this graph). */
export function formatEtherLite(wei: bigint): string {
  const neg = wei < 0n;
  const abs = (neg ? -wei : wei).toString().padStart(19, "0");
  const int = abs.slice(0, -18) || "0";
  const frac = abs.slice(-18).replace(/0+$/, "");
  return (neg ? "-" : "") + int + (frac ? "." + frac.slice(0, 8) : "");
}

export function fmtMon(wei?: bigint | null, maxFrac = 4): string {
  if (wei === undefined || wei === null) return "—";
  const full = formatEtherLite(wei);
  const n = Number(full);
  if (Number.isNaN(n)) return full;
  return n.toLocaleString("en-US", { maximumFractionDigits: maxFrac });
}

export function fmtDate(ts?: bigint | number | null): string {
  if (ts === undefined || ts === null) return "—";
  const n = Number(ts);
  if (!n) return "—";
  return new Date(n * 1000).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
  // displayed with explicit UTC marker by callers where relevant
}

export function fmtDateUTC(ts?: bigint | number | null): string {
  if (ts === undefined || ts === null) return "—";
  const n = Number(ts);
  if (!n) return "—";
  return `${fmtDate(ts)} UTC`;
}

export function timeLeft(ts?: bigint | number | null, now?: number): string {
  if (ts === undefined || ts === null || Number(ts) === 0) return "—";
  const diff = Number(ts) - (now ?? Date.now() / 1000);
  if (diff <= 0) return "elapsed";
  const d = Math.floor(diff / 86400);
  const h = Math.floor((diff % 86400) / 3600);
  const m = Math.floor((diff % 3600) / 60);
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${m}m left`;
}

export function bpsToPct(bps: number): string {
  return `${(bps / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`;
}

export const STATUS_META: Record<
  number,
  { label: string; tone: "neutral" | "signal" | "warn" | "risk" | "ok" }
> = {
  0: { label: "FUNDED", tone: "signal" },
  1: { label: "DELIVERED", tone: "warn" },
  2: { label: "DISPUTED", tone: "risk" },
  3: { label: "RULING PENDING", tone: "warn" },
  4: { label: "SETTLED", tone: "ok" },
};

export const RULING_LABEL_STR: Record<string, string> = {
  RELEASE_BUYER: "RELEASE BUYER",
  RELEASE_SELLER: "RELEASE SELLER",
  SPLIT: "SPLIT",
};

export const RULING_LABEL: Record<number, string> = {
  0: "RELEASE BUYER",
  1: "RELEASE SELLER",
  2: "SPLIT",
};

export const EXPLORER_TX = (tx: string) =>
  `https://testnet.monadexplorer.com/tx/${tx}`;
export const EXPLORER_ADDR = (a: string) =>
  `https://testnet.monadexplorer.com/address/${a}`;

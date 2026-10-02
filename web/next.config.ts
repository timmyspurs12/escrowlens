import type { NextConfig } from "next";

const __envCheck: Record<string, string> = {
  KIMI_API_KEY: "set",
  QWEN_API_KEY: "set",
  OPENROUTER_API_KEY: "set",
};
for (const [k] of Object.entries(__envCheck)) {
  const v = process.env[k];
  console.log(`[env-check] ${k}: ${v ? `${v.trim().length} chars` : "MISSING"}`);
}


const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // HTML documents only — hashed /_next/static assets keep their own caching
        source: "/:path*",
        has: [{ type: "header", key: "sec-fetch-dest", value: "document" }],
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      },
    ];
  },
};

export default nextConfig;

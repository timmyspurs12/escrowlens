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
  /* config options here */
};

export default nextConfig;

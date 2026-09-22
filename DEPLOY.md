# EscrowLens — Push to GitHub & Deploy Live

Two independent steps: **push the code to GitHub**, then **deploy the web app** (the
contract is already live on Monad testnet — nothing to redeploy on-chain).

**Security note (already verified):** `.env`, `.env.local` and all keys are gitignored and
untracked. `git ls-files | grep .env` returns nothing. The Privy App ID and contract
address are public-by-design values.

---

## 1. Push to GitHub

### Path A — I push for you from this workspace (fastest)

1. Go to https://github.com/new → create an **empty** repo named e.g. `escrowlens`
   (do **not** initialize with README/license — we already have history).
2. Create a **fine-grained Personal Access Token**: https://github.com/settings/personal-access-tokens/new
   - Repository access: **only** the new repo
   - Permissions: **Contents → Read and write** (nothing else)
   - Expiration: 7 days
3. Paste the token here. I will:
   - `git remote add origin https://<TOKEN>@github.com/<you>/escrowlens.git`
   - `git push -u origin master`
   - **immediately tell you to revoke the token** (Settings → Personal access tokens → Delete).
     After the initial push you can push updates yourself, or re-issue a token when needed.

### Path B — push it yourself (no token shared)

Download `escrowlens-source.tar.gz` from the workspace (a `git archive` of tracked files
only — physically cannot contain secrets), then:

```bash
tar xzf escrowlens-source.tar.gz -C escrowlens && cd escrowlens
git init -b main && git add -A
git commit -m "EscrowLens: P2P escrow + AI arbiter + ERC-8004 on Monad"
git remote add origin https://github.com/<you>/escrowlens.git
git push -u origin main
```

---

## 2. Deploy the app live (Vercel — natural fit for Next.js)

The app is one Next.js project in the **`web/` subfolder**, including one server API route
(`/api/arbiter/analyze`) — so it needs a Node host, not static hosting.

### Steps

1. https://vercel.com → sign in **with GitHub** → **Add New → Project** → import `escrowlens`.
2. **Root Directory: set to `web`** (important — the app is not at the repo root).
3. Framework Preset: Next.js (auto). Build command: default. Node: 20.x (default).
4. **Environment Variables** — add exactly these:

| Key | Value | Notes |
|---|---|---|
| `NEXT_PUBLIC_MONAD_RPC` | `https://testnet-rpc.monad.xyz` | public |
| `NEXT_PUBLIC_CHAIN_ID` | `10143` | public |
| `NEXT_PUBLIC_ESCROW_CONTRACT` | `0x11B24EC00A86069fBFbaC6ba20742acdff2B4cB7` | public, Sourcify-verified |
| `NEXT_PUBLIC_PRIVY_APP_ID` | `cmuaxrj5r02nt0cjm152ve7fq` | public by design |
| `NEXT_PUBLIC_EVENT_ANCHORS` | `64579825,64581260,64679448,64679465,64679651,64679682` | explorer event windows |
| `LLM_PROVIDER` | `kimi` | **server-only** |
| `KIMI_API_KEY` | *(your Kimi key)* | **server-only** — account needs balance |
| `QWEN_API_KEY` | *(add when you have the free key)* | **server-only** |
| `ARBITER_PRIVATE_KEY` | *(the arbiter signing key — ask in chat / already shared once)* | **server-only**, signs EIP-712 rulings; holds no fund-moving power |

5. **Deploy.** First build takes a couple of minutes. You get `https://<project>.vercel.app`.
6. **Privy:** open https://dashboard.privy.io → your app → settings → add
   `https://<project>.vercel.app` to the app's **domains/allowed origins** (and keep
   `localhost` for dev). Passkey login then works on the live URL.
7. Smoke test the live site: landing counters show real chain data → `/explorer` lists
   6 escrows → open `/escrow/6` (the full dispute record).

> Prod note: don't put the deployer key (or any funded key) on Vercel. Only the arbiter
> **signing** key belongs there — it can do nothing but sign recommendations.

### Alternatives (same env vars)
Railway / Render / Fly.io all work: Node 20, build `npm run build`, start `npm start`,
root dir `web`. Anything without a Node runtime (GitHub Pages, S3) will **not** work —
the arbiter API route is part of the product.

---

## 3. After deploying — 60-second acceptance check

- [ ] Landing shows live counters (escrows created = 6)
- [ ] `Continue securely` → passkey login works on the deployed domain
- [ ] `/explorer` lists escrows #1–#6 with correct states
- [ ] `/escrow/6` shows dispute → evidence → arbiter → settlement receipt
- [ ] `/agent` shows ERC-8004 agent **1918** with the registration tx
- [ ] `/arbiter` console loads (review actions need a live LLM key)

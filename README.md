# The Bioscope — Drop a Coin, Watch a Reel, Never Pay Twice

A Next.js web application that monetises digitised image reels using the **x402** payment protocol on **Base Sepolia** testnet. The first frame of every reel is free. Subsequent frames require a micro-payment. Returning users who have already paid can restore access by signing in with their wallet (SIWE).

## Architecture

```
┌─────────────┐    frame 0 (free)     ┌──────────────────┐
│  Browser UI  │ ──────────────────►  │  /api/reels/…    │
│  (Next.js)   │                      │  Route Handler   │
│              │    frame 1+ (paid)   │                  │
│              │ ──── X-PAYMENT ────► │  x402 verify →   │──► private_assets/
│              │                      │  SQLite record   │    (NEVER in public/)
│              │    restore access    │                  │
│              │ ──── SIWE cookie ──► │  DB lookup       │
└─────────────┘                      └──────────────────┘
```

## Quick Start

### Prerequisites
- Node.js 20+ (22 LTS recommended)
- A browser wallet (MetaMask) with Base Sepolia testnet configured
- Base Sepolia USDC in your wallet ([faucet](https://faucet.circle.com/))

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/devcon-6-p3.git
cd devcon-6-p3
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in:
- `RECEIVER_WALLET_ADDRESS` — the address that receives payments
- `RECEIVER_PRIVATE_KEY` — the private key for that wallet (testnet only!)
- `SESSION_SECRET` — any random 32+ character string
- `FACILITATOR_URL` — defaults to `https://x402.org/facilitator`

### 3. Seed the Database & Images

```bash
npx tsx scripts/seed.ts
```

This creates 12 placeholder PNG frames across 3 reels in `private_assets/reels/`.

### 4. Run the Dev Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

### 5. Try It Out

1. **Free preview** — Click any reel card. Frame 0 loads instantly, no wallet needed.
2. **Locked frames** — Navigate to Frame 1+. You'll see a 🔒 lock and payment options.
3. **Pay to unlock** — Use an x402-compatible client to pay the 402 response.
4. **Sign in to restore** — Click "Connect Wallet", sign the SIWE message, and your past purchases are restored from the database.

## Security Design

| Requirement | Implementation |
|---|---|
| **x402 gating** | Frame 1+ returns HTTP 402 with x402 payment requirements |
| **Free preview** | Frame 0 served without auth from the gated API route |
| **Zero leaked secrets** | All keys in `.env`; `.env.example` has placeholders only |
| **Server-side purchase records** | SQLite `purchases` table: `(wallet_address, reel_id)` |
| **Asset security** | All frames in `private_assets/` (outside `public/`), served as binary blobs |
| **Server-side access decisions** | DB query for `wallet_address + reel_id` — no client-side trust |
| **SIWE signature verification** | `siwe` library verifies EIP-4361 signatures server-side |
| **Replay protection** | Server-generated UUID nonce with 5-min TTL, single-use, stored in SQLite |
| **Scoped entitlements** | Purchase lookup requires BOTH `wallet_address` AND `reel_id` |

## Project Structure

```
private_assets/          ← Protected frames (OUTSIDE public/)
  reels/
    reel-1/frame-{0..3}.png
    reel-2/frame-{0..3}.png
    reel-3/frame-{0..3}.png
scripts/
  seed.ts                ← Generates placeholder frame images
src/
  app/
    api/
      auth/nonce/        ← GET: generate server nonce
      auth/verify/       ← POST: verify SIWE signature
      reels/[id]/frame/[frameIndex]/  ← GET: gated frame serving
    page.tsx             ← Gallery + Viewer UI
    layout.tsx           ← Root layout
    globals.css          ← Design system
  lib/
    db.ts                ← SQLite (better-sqlite3) + nonce/purchase helpers
    session.ts           ← JWT session management (jose)
    reels.ts             ← Reel metadata
.env.example             ← Environment variable template
.gitignore               ← Excludes .env, *.db, node_modules
```

## Tech Stack

- **Next.js 15** (App Router)
- **SQLite** via better-sqlite3
- **x402 Protocol** via @x402/core, @x402/evm
- **SIWE** (Sign-In with Ethereum) via siwe package
- **JWT Sessions** via jose
- **viem** for Ethereum interactions

## License

MIT

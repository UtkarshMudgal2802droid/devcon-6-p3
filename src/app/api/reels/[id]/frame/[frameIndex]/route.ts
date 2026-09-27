import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getReelById } from "@/lib/reels";
import { verifySession } from "@/lib/session";
import { hasPurchased, recordPurchase } from "@/lib/db";

/**
 * The private assets directory — OUTSIDE public/ (Rule 5).
 * Paid frames are NEVER statically served.
 */
const PRIVATE_ASSETS_DIR = path.join(process.cwd(), "private_assets", "reels");

function getFramePath(reelId: string, frameIndex: number): string {
  return path.join(PRIVATE_ASSETS_DIR, reelId, `frame-${frameIndex}.jpg`);
}

function serveImage(framePath: string): NextResponse {
  const buffer = fs.readFileSync(framePath);
  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, no-store",
    },
  });
}

/**
 * GET /api/reels/[id]/frame/[frameIndex]
 *
 * Frame 0 → free, no auth required (Rule 2)
 * Frame 1+ →
 *   1. Check SIWE session + DB purchase record → serve if found (Rules 6, 7, 9)
 *   2. Otherwise → return 402 with x402 payment requirements (Rule 1)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; frameIndex: string }> }
) {
  const { id: reelId, frameIndex: frameIndexStr } = await params;
  const frameIndex = parseInt(frameIndexStr, 10);

  // Validate reel exists
  const reel = getReelById(reelId);
  if (!reel) {
    return NextResponse.json({ error: "Reel not found" }, { status: 404 });
  }

  // Validate frame index
  if (isNaN(frameIndex) || frameIndex < 0 || frameIndex >= reel.totalFrames) {
    return NextResponse.json({ error: "Invalid frame index" }, { status: 400 });
  }

  // Verify file exists on disk
  const framePath = getFramePath(reelId, frameIndex);
  if (!fs.existsSync(framePath)) {
    return NextResponse.json({ error: "Frame not found on disk" }, { status: 404 });
  }

  // ── Rule 2: Frame 0 is always free ──
  if (frameIndex === 0) {
    return serveImage(framePath);
  }

  // ── Rule 6/7/9: Check SIWE session + scoped DB purchase ──
  const session = await verifySession();
  if (session) {
    // Rule 9: purchase lookup requires BOTH wallet_address AND reel_id
    const purchased = hasPurchased(session.walletAddress, reelId);
    if (purchased) {
      return serveImage(framePath);
    }
  }

  // ── Rule 1: Return 402 Payment Required with x402 requirements ──
  const receiverAddress = process.env.RECEIVER_WALLET_ADDRESS;
  if (!receiverAddress) {
    return NextResponse.json({ error: "Server misconfigured: missing RECEIVER_WALLET_ADDRESS" }, { status: 500 });
  }

  // x402 standard 402 response — the client's x402 wrapper handles payment flow
  const paymentRequirements = {
    x402Version: 1,
    accepts: [
      {
        scheme: "exact",
        network: "eip155:84532",
        maxAmountRequired: "10000", // $0.01 USDC (6 decimals)
        resource: request.url,
        description: `Unlock all frames of "${reel.title}"`,
        payTo: receiverAddress,
        maxTimeoutSeconds: 300,
        asset: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia USDC
        extra: {},
      },
    ],
  };

  return NextResponse.json(paymentRequirements, {
    status: 402,
    headers: {
      "X-Payment-Required": "true",
    },
  });
}

/**
 * POST /api/reels/[id]/frame/[frameIndex]
 *
 * Payment confirmation webhook — called after successful x402 payment.
 * Records the purchase in SQLite (Rule 4).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; frameIndex: string }> }
) {
  const { id: reelId } = await params;

  const reel = getReelById(reelId);
  if (!reel) {
    return NextResponse.json({ error: "Reel not found" }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { walletAddress, txHash } = body;

    if (!walletAddress) {
      return NextResponse.json({ error: "Missing walletAddress" }, { status: 400 });
    }

    // Rule 4: Record purchase in SQLite
    recordPurchase(walletAddress, reelId, txHash);

    return NextResponse.json({ ok: true, reelId, walletAddress: walletAddress.toLowerCase() });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

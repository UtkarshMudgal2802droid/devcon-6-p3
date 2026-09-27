import { createNonce } from "@/lib/db";
import { NextResponse } from "next/server";

/**
 * GET /api/auth/nonce
 *
 * Generates a server-side, time-bound nonce for SIWE signing.
 * The nonce is stored in SQLite with a 5-minute TTL and is single-use.
 */
export async function GET() {
  const nonce = createNonce();
  return NextResponse.json({ nonce });
}

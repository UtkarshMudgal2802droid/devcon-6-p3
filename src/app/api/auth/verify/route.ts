import { consumeNonce } from "@/lib/db";
import { createSession, SESSION_COOKIE } from "@/lib/session";
import { NextRequest, NextResponse } from "next/server";
import { SiweMessage } from "siwe";

/**
 * POST /api/auth/verify
 *
 * Accepts { message, signature } from the client.
 * 1. Parses the SIWE message
 * 2. Cryptographically verifies the signature
 * 3. Validates the server-generated nonce (single-use, time-bound)
 * 4. Sets an HTTP-only session cookie with a signed JWT
 */
export async function POST(request: NextRequest) {
  try {
    const { message, signature } = await request.json();

    if (!message || !signature) {
      return NextResponse.json({ error: "Missing message or signature" }, { status: 400 });
    }

    const siweMessage = new SiweMessage(message);

    // Cryptographically verify the signature (Rule 7)
    const result = await siweMessage.verify({ signature });

    if (!result.success) {
      return NextResponse.json({ error: "Signature verification failed" }, { status: 401 });
    }

    // Validate and consume the server-generated nonce (Rule 8 — replay protection)
    const nonceValid = consumeNonce(siweMessage.nonce);
    if (!nonceValid) {
      return NextResponse.json({ error: "Invalid or expired nonce" }, { status: 401 });
    }

    // Create session JWT
    const walletAddress = result.data.address.toLowerCase();
    const token = await createSession(walletAddress);

    const response = NextResponse.json({ ok: true, address: walletAddress });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

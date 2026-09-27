import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SESSION_COOKIE = "bioscope_session";

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is missing in environment");
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  walletAddress: string;
}

export async function createSession(walletAddress: string): Promise<string> {
  const token = await new SignJWT({ walletAddress: walletAddress.toLowerCase() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(getSecret());
  return token;
}

export async function verifySession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.walletAddress || typeof payload.walletAddress !== "string") return null;

    return { walletAddress: payload.walletAddress as string };
  } catch {
    return null;
  }
}

export { SESSION_COOKIE };

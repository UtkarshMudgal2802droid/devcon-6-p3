import Database from "better-sqlite3";
import path from "path";
import crypto from "crypto";

const DB_PATH = path.join(process.cwd(), "bioscope.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.exec(`
      CREATE TABLE IF NOT EXISTS nonces (
        id TEXT PRIMARY KEY,
        nonce TEXT NOT NULL UNIQUE,
        expires_at INTEGER NOT NULL,
        used INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS purchases (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        wallet_address TEXT NOT NULL,
        reel_id TEXT NOT NULL,
        tx_hash TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(wallet_address, reel_id)
      );
    `);
  }
  return _db;
}

// ── Nonce helpers ──

export function createNonce(): string {
  const db = getDb();
  const nonce = crypto.randomUUID();
  const id = crypto.randomUUID();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes TTL
  db.prepare("INSERT INTO nonces (id, nonce, expires_at, used) VALUES (?, ?, ?, 0)").run(id, nonce, expiresAt);
  return nonce;
}

export function consumeNonce(nonce: string): boolean {
  const db = getDb();
  const row = db.prepare("SELECT * FROM nonces WHERE nonce = ? AND used = 0").get(nonce) as
    | { id: string; nonce: string; expires_at: number; used: number }
    | undefined;

  if (!row) return false;
  if (Date.now() > row.expires_at) {
    db.prepare("DELETE FROM nonces WHERE nonce = ?").run(nonce);
    return false;
  }

  db.prepare("UPDATE nonces SET used = 1 WHERE nonce = ?").run(nonce);
  return true;
}

// ── Purchase helpers ──

export function recordPurchase(walletAddress: string, reelId: string, txHash?: string): void {
  const db = getDb();
  db.prepare(
    "INSERT OR IGNORE INTO purchases (wallet_address, reel_id, tx_hash) VALUES (?, ?, ?)"
  ).run(walletAddress.toLowerCase(), reelId, txHash ?? null);
}

export function hasPurchased(walletAddress: string, reelId: string): boolean {
  const db = getDb();
  const row = db.prepare(
    "SELECT 1 FROM purchases WHERE wallet_address = ? AND reel_id = ?"
  ).get(walletAddress.toLowerCase(), reelId);
  return !!row;
}

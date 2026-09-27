"use client";

import { useState, useCallback } from "react";

/* ── Reel metadata (mirrored from server for display) ── */
interface ReelMeta {
  id: string;
  title: string;
  description: string;
  totalFrames: number;
  price: string;
}

const REELS: ReelMeta[] = [
  { id: "reel-1", title: "Sunrise over the Ghats", description: "A digitised reel capturing dawn light on ancient stone steps.", totalFrames: 4, price: "$0.01" },
  { id: "reel-2", title: "Monsoon in Munnar", description: "Tea plantations wrapped in rolling fog after the first rains.", totalFrames: 4, price: "$0.01" },
  { id: "reel-3", title: "Festival of Lights", description: "Diyas and lanterns illuminating a crowded market lane.", totalFrames: 4, price: "$0.01" },
];

export default function HomePage() {
  const [selectedReel, setSelectedReel] = useState<ReelMeta | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [unlocked, setUnlocked] = useState<Record<string, boolean>>({});
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: "success" | "error" | "info"; msg: string } | null>(null);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // ── Load a frame via the gated API ──
  const loadFrame = useCallback(async (reelId: string, frameIdx: number) => {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/reels/${reelId}/frame/${frameIdx}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setFrameUrl(url);
        if (frameIdx > 0) {
          setUnlocked((prev) => ({ ...prev, [reelId]: true }));
        }
      } else if (res.status === 402) {
        setFrameUrl(null);
        setStatus({ type: "info", msg: "This frame requires payment. Click 'Pay to Unlock' or sign in to restore purchases." });
      } else {
        const data = await res.json();
        setStatus({ type: "error", msg: data.error || "Failed to load frame" });
      }
    } catch {
      setStatus({ type: "error", msg: "Network error" });
    }
    setLoading(false);
  }, []);

  // ── Open reel viewer (always loads frame 0 first) ──
  const openReel = (reel: ReelMeta) => {
    setSelectedReel(reel);
    setCurrentFrame(0);
    setStatus(null);
    loadFrame(reel.id, 0);
  };

  const closeViewer = () => {
    setSelectedReel(null);
    setFrameUrl(null);
    setStatus(null);
  };

  // ── Navigate frames ──
  const goToFrame = (frameIdx: number) => {
    if (!selectedReel) return;
    setCurrentFrame(frameIdx);
    loadFrame(selectedReel.id, frameIdx);
  };

  // ── SIWE sign-in flow ──
  const signIn = async () => {
    if (typeof window === "undefined" || !(window as unknown as { ethereum?: unknown }).ethereum) {
      setStatus({ type: "error", msg: "No wallet detected. Install MetaMask." });
      return;
    }
    setLoading(true);
    try {
      const ethereum = (window as unknown as { ethereum: { request: (args: { method: string; params?: unknown[] }) => Promise<string[]> } }).ethereum;

      // 1. Request accounts
      const accounts = await ethereum.request({ method: "eth_requestAccounts" });
      const address = accounts[0]!;

      // 2. Get server nonce
      const nonceRes = await fetch("/api/auth/nonce");
      const { nonce } = await nonceRes.json();

      // 3. Construct SIWE message
      const domain = window.location.host;
      const origin = window.location.origin;
      const message = [
        `${domain} wants you to sign in with your Ethereum account:`,
        address,
        "",
        "Sign in to The Bioscope to restore your reel purchases.",
        "",
        `URI: ${origin}`,
        `Version: 1`,
        `Chain ID: 84532`,
        `Nonce: ${nonce}`,
        `Issued At: ${new Date().toISOString()}`,
      ].join("\n");

      // 4. Sign
      const signature = await ethereum.request({
        method: "personal_sign",
        params: [message, address],
      });

      // 5. Verify with server
      const verifyRes = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });

      if (verifyRes.ok) {
        const data = await verifyRes.json();
        setWalletAddress(data.address);
        setStatus({ type: "success", msg: `Signed in as ${data.address.slice(0, 6)}…${data.address.slice(-4)}` });

        // Reload current frame to check restored purchases
        if (selectedReel && currentFrame > 0) {
          loadFrame(selectedReel.id, currentFrame);
        }
      } else {
        const data = await verifyRes.json();
        setStatus({ type: "error", msg: data.error || "Sign-in failed" });
      }
    } catch (err: unknown) {
      setStatus({ type: "error", msg: err instanceof Error ? err.message : "Sign-in failed" });
    }
    setLoading(false);
  };

  // ── x402 payment placeholder ──
  const payForReel = async () => {
    if (!selectedReel) return;
    setStatus({ type: "info", msg: "Payment flow: Use an x402-compatible client to pay. The server will return 402 with payment requirements." });
  };

  return (
    <>
      {/* Header */}
      <header className="header">
        <div className="logo">The Bioscope</div>
        <button className={`wallet-btn ${walletAddress ? "connected" : ""}`} onClick={signIn}>
          {walletAddress ? `${walletAddress.slice(0, 6)}…${walletAddress.slice(-4)}` : "Connect Wallet"}
        </button>
      </header>

      {/* Gallery */}
      <main className="gallery">
        <h2>Reel Collection</h2>
        <p className="gallery-subtitle">Drop a coin, watch a reel — first frame always free</p>

        <div className="reel-grid">
          {REELS.map((reel) => (
            <div key={reel.id} className="reel-card" onClick={() => openReel(reel)}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/reels/${reel.id}/frame/0`}
                alt={reel.title}
                className="reel-preview"
              />
              <div className="reel-info">
                <div className="reel-title">{reel.title}</div>
                <div className="reel-desc">{reel.description}</div>
                <div className="reel-meta">
                  <span className="reel-frames">{reel.totalFrames} frames</span>
                  <span className="reel-badge-free">Frame 1 Free</span>
                  <span className="reel-price">{reel.price}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Viewer Modal */}
      {selectedReel && (
        <div className="viewer-overlay" onClick={(e) => e.target === e.currentTarget && closeViewer()}>
          <div className="viewer">
            <div className="viewer-header">
              <h3>{selectedReel.title}</h3>
              <button className="close-btn" onClick={closeViewer}>×</button>
            </div>

            {frameUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={frameUrl} alt={`Frame ${currentFrame}`} className="viewer-frame" />
            ) : (
              <div className="locked-msg">
                <span className="lock-icon">🔒</span>
                {loading ? "Loading..." : "This frame is locked. Pay or sign in to view."}
              </div>
            )}

            {status && <div className={`status-msg ${status.type}`}>{status.msg}</div>}

            <div className="viewer-controls">
              <div className="frame-nav">
                <button className="nav-btn" disabled={currentFrame === 0} onClick={() => goToFrame(currentFrame - 1)}>
                  ← Prev
                </button>
                <button className="nav-btn" disabled={currentFrame >= selectedReel.totalFrames - 1} onClick={() => goToFrame(currentFrame + 1)}>
                  Next →
                </button>
              </div>
              <span className="frame-counter">
                Frame {currentFrame + 1} / {selectedReel.totalFrames}
              </span>
            </div>

            {currentFrame > 0 && !unlocked[selectedReel.id] && !frameUrl && (
              <div style={{ padding: "0 1.2rem 1.2rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <button className="pay-btn" onClick={payForReel} disabled={loading}>
                  💰 Pay {selectedReel.price} to Unlock Reel
                </button>
                {!walletAddress && (
                  <button className="sign-in-btn" onClick={signIn} disabled={loading}>
                    🔑 Sign in to Restore Purchases
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Bioscope — Drop a Coin, Watch a Reel",
  description: "Digitised reels monetised with x402 payments on Base Sepolia. First frame free, unlock the rest with testnet USDC.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

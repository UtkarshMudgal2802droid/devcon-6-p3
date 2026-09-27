/**
 * Seed script — generates placeholder PNG frames in private_assets/reels/.
 * Run with: npx tsx scripts/seed.ts
 *
 * Creates 4 frames (frame-0 through frame-3) for each of the 3 reels.
 * Each frame is a simple colored PNG so the app can demonstrate the gating flow.
 */
import fs from "fs";
import path from "path";

// Minimal valid PNG generator — creates a 64x64 solid-colour PNG
function createMinimalPNG(r: number, g: number, b: number): Buffer {
  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  // IHDR chunk
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(64, 0);  // width
  ihdrData.writeUInt32BE(64, 4);  // height
  ihdrData.writeUInt8(8, 8);      // bit depth
  ihdrData.writeUInt8(2, 9);      // color type (RGB)
  ihdrData.writeUInt8(0, 10);     // compression
  ihdrData.writeUInt8(0, 11);     // filter
  ihdrData.writeUInt8(0, 12);     // interlace

  const ihdr = makeChunk("IHDR", ihdrData);

  // IDAT chunk — raw image data (uncompressed using zlib stored blocks)
  const rowBytes = 1 + 64 * 3; // filter byte + RGB pixels
  const rawData = Buffer.alloc(rowBytes * 64);
  for (let y = 0; y < 64; y++) {
    const offset = y * rowBytes;
    rawData[offset] = 0; // no filter
    for (let x = 0; x < 64; x++) {
      const px = offset + 1 + x * 3;
      rawData[px] = r;
      rawData[px + 1] = g;
      rawData[px + 2] = b;
    }
  }

  // Compress with zlib (using Node built-in)
  const zlib = require("zlib");
  const compressed = zlib.deflateSync(rawData);
  const idat = makeChunk("IDAT", compressed);

  // IEND chunk
  const iend = makeChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function makeChunk(type: string, data: Buffer): Buffer {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const crcInput = Buffer.concat([typeBuffer, data]);
  const crc = crc32(crcInput);
  const crcBuffer = Buffer.alloc(4);
  crcBuffer.writeUInt32BE(crc, 0);

  return Buffer.concat([length, typeBuffer, data, crcBuffer]);
}

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]!;
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Colour palettes for each reel
const reels = [
  {
    id: "reel-1",
    colors: [
      [255, 200, 100],  // frame-0: warm sunrise
      [255, 150, 50],   // frame-1: deeper orange
      [200, 80, 30],    // frame-2: burning amber
      [120, 40, 20],    // frame-3: dusky red
    ],
  },
  {
    id: "reel-2",
    colors: [
      [100, 180, 100],  // frame-0: green hills
      [80, 150, 120],   // frame-1: foggy tea
      [60, 120, 140],   // frame-2: misty blue
      [40, 80, 100],    // frame-3: deep monsoon
    ],
  },
  {
    id: "reel-3",
    colors: [
      [255, 220, 80],   // frame-0: golden diya
      [255, 140, 60],   // frame-1: warm flame
      [200, 80, 120],   // frame-2: festive magenta
      [80, 40, 120],    // frame-3: night purple
    ],
  },
];

const outDir = path.join(process.cwd(), "private_assets", "reels");

for (const reel of reels) {
  const reelDir = path.join(outDir, reel.id);
  fs.mkdirSync(reelDir, { recursive: true });

  for (let i = 0; i < reel.colors.length; i++) {
    const [r, g, b] = reel.colors[i]!;
    const png = createMinimalPNG(r!, g!, b!);
    const filePath = path.join(reelDir, `frame-${i}.png`);
    fs.writeFileSync(filePath, png);
    console.log(`  ✓ ${filePath}`);
  }
}

console.log("\n✅ Seed complete — 12 frames created in private_assets/reels/");

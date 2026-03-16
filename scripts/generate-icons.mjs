/**
 * generate-icons.mjs — Convert master SVG logo into all required icon formats.
 *
 * Usage:  node scripts/generate-icons.mjs
 * Deps:   sharp (npm install --save-dev sharp)
 *
 * Generates:
 *   public/favicon.ico               (multi-size ICO: 16+32+48)
 *   public/favicon-32x32.png         (32px)
 *   public/apple-touch-icon.png      (180px)
 *   public/og-image.png              (1200x630 social card)
 *   flowstral-desktop/assets/icon-{16..1024}.png
 *   flowstral-desktop/assets/icon.png (512px default)
 *   flowstral-desktop/assets/icon.ico (multi-size ICO)
 *   flowstral-desktop/assets/tray-icon.png (32px)
 *   flowstral-extension/icons/icon{16,48,128}.png
 */

import sharp from 'sharp';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SVG_PATH = join(ROOT, 'public', 'flowstral-logo.svg');
const svgBuffer = readFileSync(SVG_PATH);

// Ensure output directories exist
const dirs = [
  join(ROOT, 'public'),
  join(ROOT, 'flowstral-desktop', 'assets'),
  join(ROOT, 'flowstral-extension', 'icons'),
];
dirs.forEach(d => mkdirSync(d, { recursive: true }));

// ── Helper: SVG → PNG at given size ──────────────────────────────────────

async function svgToPng(size) {
  return sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toBuffer();
}

// ── Helper: Create multi-size ICO from PNG buffers ───────────────────────
// ICO format: 6-byte header + N directory entries (16 bytes each) + image data

function createIco(pngBuffers, sizes) {
  const numImages = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dirSize = dirEntrySize * numImages;
  let dataOffset = headerSize + dirSize;

  // ICO header: reserved(2) + type(2, 1=icon) + count(2)
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);        // Reserved
  header.writeUInt16LE(1, 2);        // Type: 1 = ICO
  header.writeUInt16LE(numImages, 4); // Number of images

  const dirEntries = [];
  const imageDataParts = [];

  for (let i = 0; i < numImages; i++) {
    const pngBuf = pngBuffers[i];
    const size = sizes[i];
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);  // Width (0 means 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1);  // Height
    entry.writeUInt8(0, 2);                         // Color palette
    entry.writeUInt8(0, 3);                         // Reserved
    entry.writeUInt16LE(1, 4);                      // Color planes
    entry.writeUInt16LE(32, 6);                     // Bits per pixel
    entry.writeUInt32LE(pngBuf.length, 8);          // Image data size
    entry.writeUInt32LE(dataOffset, 12);            // Offset to image data
    dirEntries.push(entry);
    imageDataParts.push(pngBuf);
    dataOffset += pngBuf.length;
  }

  return Buffer.concat([header, ...dirEntries, ...imageDataParts]);
}

// ── Helper: Create OG image (1200x630) with logo centered on gradient ───

async function createOgImage() {
  // Render logo at 300px
  const logoPng = await svgToPng(300);

  // Create gradient background SVG
  const bgSvg = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="ogBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0B0E14"/>
        <stop offset="50%" stop-color="#111827"/>
        <stop offset="100%" stop-color="#0B0E14"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#ogBg)"/>
    <text x="600" y="520" text-anchor="middle" fill="white" font-family="system-ui, -apple-system, sans-serif" font-size="48" font-weight="700">
      <tspan fill="#ffffff">Flow</tspan><tspan fill="#06B6D4">stral</tspan>
    </text>
    <text x="600" y="570" text-anchor="middle" fill="#94A3B8" font-family="system-ui, sans-serif" font-size="22">
      Unified QA Automation Platform
    </text>
  </svg>`);

  const bg = await sharp(bgSvg).png().toBuffer();

  return sharp(bg)
    .composite([{
      input: logoPng,
      top: 100,
      left: 450,
    }])
    .png()
    .toBuffer();
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  console.log('Generating icons from', SVG_PATH);

  // 1. Desktop icons — all standard sizes
  const desktopSizes = [16, 32, 48, 64, 128, 256, 512, 1024];
  for (const size of desktopSizes) {
    const buf = await svgToPng(size);
    const outPath = join(ROOT, 'flowstral-desktop', 'assets', `icon-${size}.png`);
    writeFileSync(outPath, buf);
    console.log(`  Desktop icon-${size}.png`);
  }

  // 2. Desktop default icon.png (512)
  const icon512 = await svgToPng(512);
  writeFileSync(join(ROOT, 'flowstral-desktop', 'assets', 'icon.png'), icon512);
  console.log('  Desktop icon.png (512)');

  // 3. Desktop tray icon (32)
  const tray32 = await svgToPng(32);
  writeFileSync(join(ROOT, 'flowstral-desktop', 'assets', 'tray-icon.png'), tray32);
  console.log('  Desktop tray-icon.png (32)');

  // 4. Desktop ICO
  const icoSizes = [16, 32, 48, 256];
  const icoPngs = await Promise.all(icoSizes.map(s => svgToPng(s)));
  const desktopIco = createIco(icoPngs, icoSizes);
  writeFileSync(join(ROOT, 'flowstral-desktop', 'assets', 'icon.ico'), desktopIco);
  console.log('  Desktop icon.ico');

  // 5. Public favicon.ico
  const favicoSizes = [16, 32, 48];
  const favicoPngs = await Promise.all(favicoSizes.map(s => svgToPng(s)));
  const faviconIco = createIco(favicoPngs, favicoSizes);
  writeFileSync(join(ROOT, 'public', 'favicon.ico'), faviconIco);
  console.log('  Public favicon.ico');

  // 6. Public favicon-32x32.png
  const fav32 = await svgToPng(32);
  writeFileSync(join(ROOT, 'public', 'favicon-32x32.png'), fav32);
  console.log('  Public favicon-32x32.png');

  // 7. Apple touch icon (180)
  const apple180 = await svgToPng(180);
  writeFileSync(join(ROOT, 'public', 'apple-touch-icon.png'), apple180);
  console.log('  Public apple-touch-icon.png');

  // 8. OG image (1200x630)
  const ogImage = await createOgImage();
  writeFileSync(join(ROOT, 'public', 'og-image.png'), ogImage);
  console.log('  Public og-image.png (1200x630)');

  // 9. Chrome extension icons
  const extSizes = [16, 48, 128];
  for (const size of extSizes) {
    const buf = await svgToPng(size);
    writeFileSync(join(ROOT, 'flowstral-extension', 'icons', `icon${size}.png`), buf);
    console.log(`  Extension icon${size}.png`);
  }

  console.log('\nDone! All icons generated successfully.');
}

main().catch(err => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});

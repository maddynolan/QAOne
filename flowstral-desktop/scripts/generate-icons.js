/**
 * Icon Generator Script
 * 
 * Generates app icons in various sizes for different platforms.
 * Requires: sharp, png-to-ico (npm install sharp png-to-ico)
 * 
 * Usage: node scripts/generate-icons.js
 */

const fs = require('fs');
const path = require('path');

// Try to use sharp if available, otherwise provide instructions
async function generateIcons() {
  const assetsDir = path.join(__dirname, '..', 'assets');
  
  // Ensure assets directory exists
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  // Create a simple SVG icon as placeholder
  const svgIcon = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#00D9FF;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#7C3AED;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="80" fill="#0a0a0f"/>
  <g transform="translate(100, 100)">
    <path d="M156 0L0 90L156 180L312 90L156 0Z" fill="url(#grad)"/>
    <path d="M0 270L156 360L312 270" stroke="url(#grad)" stroke-width="24" fill="none"/>
    <path d="M0 180L156 270L312 180" stroke="url(#grad)" stroke-width="24" fill="none"/>
  </g>
</svg>`;

  // Save SVG icon
  fs.writeFileSync(path.join(assetsDir, 'icon.svg'), svgIcon);
  console.log('Created: icon.svg');

  // Create a smaller tray icon SVG
  const trayIcon = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#00D9FF;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#7C3AED;stop-opacity:1" />
    </linearGradient>
  </defs>
  <g transform="translate(4, 6)">
    <path d="M12 0L0 7L12 14L24 7L12 0Z" fill="url(#grad)"/>
    <path d="M0 21L12 28L24 21" stroke="url(#grad)" stroke-width="2" fill="none"/>
    <path d="M0 14L12 21L24 14" stroke="url(#grad)" stroke-width="2" fill="none"/>
  </g>
</svg>`;

  fs.writeFileSync(path.join(assetsDir, 'tray-icon.svg'), trayIcon);
  console.log('Created: tray-icon.svg');

  // Check if sharp is available
  try {
    const sharp = require('sharp');
    
    // Generate PNG icons in various sizes
    const sizes = [16, 32, 48, 64, 128, 256, 512, 1024];
    
    for (const size of sizes) {
      await sharp(Buffer.from(svgIcon))
        .resize(size, size)
        .png()
        .toFile(path.join(assetsDir, `icon-${size}.png`));
      console.log(`Created: icon-${size}.png`);
    }
    
    // Create main icon.png (256x256)
    await sharp(Buffer.from(svgIcon))
      .resize(256, 256)
      .png()
      .toFile(path.join(assetsDir, 'icon.png'));
    console.log('Created: icon.png');
    
    // Create tray icon
    await sharp(Buffer.from(trayIcon))
      .resize(32, 32)
      .png()
      .toFile(path.join(assetsDir, 'tray-icon.png'));
    console.log('Created: tray-icon.png');
    
    // Try to create ICO file for Windows
    try {
      const pngToIco = require('png-to-ico');
      const icoBuffer = await pngToIco([
        path.join(assetsDir, 'icon-16.png'),
        path.join(assetsDir, 'icon-32.png'),
        path.join(assetsDir, 'icon-48.png'),
        path.join(assetsDir, 'icon-256.png')
      ]);
      fs.writeFileSync(path.join(assetsDir, 'icon.ico'), icoBuffer);
      console.log('Created: icon.ico');
    } catch (e) {
      console.log('Skipping ICO (install png-to-ico for Windows icons)');
    }
    
    console.log('\nAll icons generated successfully!');
    
  } catch (e) {
    console.log('\nNote: Install sharp for PNG/ICO generation:');
    console.log('  npm install sharp png-to-ico');
    console.log('\nSVG icons created. Convert manually or use online tools.');
  }
}

generateIcons().catch(console.error);


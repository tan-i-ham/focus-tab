// Simple icon generator using ASCII art as placeholder icons
// These are placeholder icons - you can replace with proper PNG files later

const fs = require('fs');
const path = require('path');

// Create simple SVG icons that can be used as placeholders
function createSVGIcon(size) {
  return `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#667eea;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#764ba2;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background circle -->
  <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="url(#grad)"/>
  
  <!-- Folder icon -->
  <rect x="${size * 0.2}" y="${size * 0.35}" width="${size * 0.6}" height="${size * 0.4}" fill="white" rx="2"/>
  <rect x="${size * 0.2}" y="${size * 0.25}" width="${size * 0.3}" height="${size * 0.15}" fill="white" rx="2"/>
  
  <!-- Close X -->
  <g stroke="#ff6b6b" stroke-width="${size * 0.06}" stroke-linecap="round">
    <line x1="${size * 0.65}" y1="${size * 0.45}" x2="${size * 0.75}" y2="${size * 0.55}"/>
    <line x1="${size * 0.75}" y1="${size * 0.45}" x2="${size * 0.65}" y2="${size * 0.55}"/>
  </g>
</svg>`;
}

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir);
}

// Generate SVG files for each size
const sizes = [16, 32, 48, 128];

sizes.forEach(size => {
  const svgContent = createSVGIcon(size);
  const filename = `icon${size}.svg`;
  const filepath = path.join(iconsDir, filename);
  
  fs.writeFileSync(filepath, svgContent);
  console.log(`Created ${filename}`);
});

console.log('\\nIcon generation complete!');
console.log('To convert to PNG format, you can:');
console.log('1. Open the SVG files in a browser and save as PNG');
console.log('2. Use an online SVG to PNG converter');
console.log('3. Use a tool like Inkscape or GIMP');
console.log('4. Install a package like "sharp" or "canvas" for programmatic conversion');
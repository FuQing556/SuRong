// Post-install: Patch app-builder to use -snl- instead of -snld
// Required because Windows symlink creation requires elevated privileges
const fs = require('fs');
const path = require('path');

const binaryPath = path.join(__dirname, '..', 'node_modules', 'app-builder-bin', 'win', 'x64', 'app-builder.exe');

if (!fs.existsSync(binaryPath)) {
  console.log('[patch] app-builder.exe not found, skipping');
  process.exit(0);
}

const content = fs.readFileSync(binaryPath);
const flag = Buffer.from('-snld');
const replacement = Buffer.from('-snl-');

// Check if already patched
if (content.includes(replacement) && !content.includes(flag)) {
  console.log('[patch] app-builder already patched');
  process.exit(0);
}

// Find and replace
const idx = content.indexOf(flag);
if (idx === -1) {
  console.log('[patch] -snld flag not found in binary');
  process.exit(0);
}

// Apply patch
content.set(replacement, idx);
fs.writeFileSync(binaryPath, content);
console.log('[patch] app-builder.exe patched: -snld → -snl-');

const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'privacy.html');
const dest = path.join(__dirname, '..', 'dist', 'privacy.html');

if (fs.existsSync(src)) {
  fs.copyFileSync(src, dest);
  console.log('✅ Privacy policy copied to dist/privacy.html');
} else {
  console.error('❌ privacy.html not found in project root.');
  process.exit(1);
}
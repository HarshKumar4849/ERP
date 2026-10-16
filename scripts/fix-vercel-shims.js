const fs = require('fs');
const path = require('path');

const virtualDir = path.join(__dirname, '..', '.vercel', 'output', 'services', 'backend', 'functions', 'index.func', '_virtual');

if (fs.existsSync(virtualDir)) {
  const files = fs.readdirSync(virtualDir);
  let patchedCount = 0;
  for (const file of files) {
    if (file.endsWith('.cjs')) {
      const filePath = path.join(virtualDir, file);
      let content = fs.readFileSync(filePath, 'utf8');
      if (content.includes('..\\backendpackage.json')) {
        content = content.split('..\\backendpackage.json').join('../backend/package.json');
        fs.writeFileSync(filePath, content, 'utf8');
        patchedCount++;
      }
    }
  }
  console.log(`[fix-vercel-shims] Patched ${patchedCount} Vercel shims to use Linux-compatible path '../backend/package.json'.`);
} else {
  console.log('[fix-vercel-shims] No .vercel output virtual directory found; skipping.');
}

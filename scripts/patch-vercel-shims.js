const fs = require('fs');
const path = require('path');

const virtualDir = path.resolve(__dirname, '../.vercel/output/services/backend/functions/index.func/_virtual');

if (fs.existsSync(virtualDir)) {
  const files = fs.readdirSync(virtualDir);
  let count = 0;
  for (const file of files) {
    if (file.endsWith('.cjs')) {
      const fullPath = path.join(virtualDir, file);
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('ackendpackage.json') || content.includes('backendpackage.json')) {
        content = content.replace(/["'][^"']*ackendpackage\.json["']/g, '"../backend/package.json"');
        fs.writeFileSync(fullPath, content, 'utf8');
        count++;
      }
    }
  }
  console.log(`[PATCH] Successfully repaired ${count} corrupted Windows shims in _virtual.`);
} else {
  console.log('[PATCH] _virtual directory not found, skipping.');
}

const frontendConfigPath = path.resolve(__dirname, '../.vercel/output/services/frontend/config.json');
if (fs.existsSync(frontendConfigPath)) {
  try {
    const cfg = JSON.parse(fs.readFileSync(frontendConfigPath, 'utf8'));
    cfg.routes = [
      { handle: 'filesystem' },
      { src: '/(.*)', dest: '/index.html' },
    ];
    fs.writeFileSync(frontendConfigPath, JSON.stringify(cfg, null, 2), 'utf8');
    console.log('[PATCH] Added SPA fallback routing to frontend service config.json.');
  } catch (e) {
    console.error('[PATCH] Failed to patch frontend service config.json:', e);
  }
}

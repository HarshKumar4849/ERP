function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

function sanitizeText(str, maxLength = 1000) {
  if (typeof str !== 'string') return '';
  // Strip dangerous control characters while preserving newlines
  const stripped = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return escapeHtml(stripped.trim()).substring(0, maxLength);
}

function redactSecrets(text) {
  if (typeof text !== 'string') return '';
  let cleaned = text;
  if (process.env.GITHUB_TOKEN) {
    cleaned = cleaned.replace(new RegExp(process.env.GITHUB_TOKEN, 'gi'), '[REDACTED_TOKEN]');
  }
  if (process.env.GITHUB_WEBHOOK_SECRET) {
    cleaned = cleaned.replace(new RegExp(process.env.GITHUB_WEBHOOK_SECRET, 'gi'), '[REDACTED_SECRET]');
  }
  cleaned = cleaned.replace(/ghp_[a-zA-Z0-9]{36}/g, '[REDACTED_TOKEN]');
  cleaned = cleaned.replace(/github_pat_[a-zA-Z0-9_]{82}/g, '[REDACTED_TOKEN]');
  cleaned = cleaned.replace(/Bearer\s+[a-zA-Z0-9_\-.]+/gi, 'Bearer [REDACTED]');
  return cleaned;
}

module.exports = {
  escapeHtml,
  sanitizeText,
  redactSecrets,
};

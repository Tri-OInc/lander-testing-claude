const crypto = require('crypto');
const path = require('path');
const { URL } = require('url');

/**
 * Generate a hash from a string (for creating deterministic filenames)
 * @param {string} str - Input string to hash
 * @returns {string} - Short hash
 */
function hashString(str) {
  return crypto.createHash('md5').update(str).digest('hex').substring(0, 12);
}

/**
 * Normalize and validate a URL
 * @param {string} urlString - URL to normalize
 * @returns {{ valid: boolean, url: string|null, error: string|null }}
 */
function normalizeUrl(urlString) {
  try {
    // Add protocol if missing
    let normalized = urlString.trim();
    if (!normalized.match(/^https?:\/\//i)) {
      normalized = 'https://' + normalized;
    }

    const parsed = new URL(normalized);

    // Only allow http/https
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return { valid: false, url: null, error: 'Only HTTP/HTTPS URLs are supported' };
    }

    return { valid: true, url: parsed.href, error: null };
  } catch (e) {
    return { valid: false, url: null, error: 'Invalid URL format' };
  }
}

/**
 * Create a safe folder name from a URL
 * @param {string} urlString - URL to convert
 * @returns {string} - Safe folder name
 */
function safeHostname(urlString) {
  try {
    const parsed = new URL(urlString);
    // Remove special chars, keep alphanumeric and dashes
    return parsed.hostname.replace(/[^a-zA-Z0-9-]/g, '_');
  } catch (e) {
    return 'unknown';
  }
}

/**
 * Generate output folder name with timestamp
 * @param {string} urlString - URL being cloned
 * @returns {string} - Folder name
 */
function generateOutputFolder(urlString) {
  const hostname = safeHostname(urlString);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  return `${hostname}_${timestamp}`;
}

/**
 * Get file extension from URL
 * @param {string} urlString - URL to extract extension from
 * @returns {string} - Extension including dot, or empty string
 */
function getExtension(urlString) {
  try {
    const parsed = new URL(urlString);
    const pathname = parsed.pathname;
    const ext = path.extname(pathname);
    // Only return common web extensions
    const validExts = ['.html', '.htm', '.css', '.js', '.json', '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.otf', '.mp4', '.webm', '.mp3', '.wav'];
    if (validExts.includes(ext.toLowerCase())) {
      return ext;
    }
    return '';
  } catch (e) {
    return '';
  }
}

/**
 * Generate a deterministic filename for an asset
 * @param {string} assetUrl - URL of the asset
 * @returns {string} - Safe filename
 */
function assetFilename(assetUrl) {
  const hash = hashString(assetUrl);
  const ext = getExtension(assetUrl) || '';
  return `${hash}${ext}`;
}

/**
 * Resolve a potentially relative URL against a base URL
 * @param {string} relativeUrl - URL to resolve
 * @param {string} baseUrl - Base URL to resolve against
 * @returns {string|null} - Absolute URL or null if invalid
 */
function resolveUrl(relativeUrl, baseUrl) {
  try {
    // Handle data URLs - return as-is
    if (relativeUrl.startsWith('data:')) {
      return null;
    }
    // Handle protocol-relative URLs
    if (relativeUrl.startsWith('//')) {
      const base = new URL(baseUrl);
      return base.protocol + relativeUrl;
    }
    return new URL(relativeUrl, baseUrl).href;
  } catch (e) {
    return null;
  }
}

/**
 * Determine asset type from URL for folder organization
 * @param {string} url - Asset URL
 * @returns {string} - Asset type folder name
 */
function getAssetType(url) {
  const ext = getExtension(url).toLowerCase();

  if (['.css'].includes(ext)) return 'css';
  if (['.js'].includes(ext)) return 'js';
  if (['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico'].includes(ext)) return 'images';
  if (['.woff', '.woff2', '.ttf', '.eot', '.otf'].includes(ext)) return 'fonts';
  if (['.mp4', '.webm'].includes(ext)) return 'video';
  if (['.mp3', '.wav'].includes(ext)) return 'audio';
  return 'other';
}

/**
 * Sleep for a given number of milliseconds
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  hashString,
  normalizeUrl,
  safeHostname,
  generateOutputFolder,
  getExtension,
  assetFilename,
  resolveUrl,
  getAssetType,
  sleep
};

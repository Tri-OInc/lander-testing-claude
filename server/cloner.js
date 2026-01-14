const { chromium } = require('playwright');
const { parse } = require('node-html-parser');
const path = require('path');
const fs = require('fs').promises;
const { existsSync, mkdirSync } = require('fs');
const {
  normalizeUrl,
  generateOutputFolder,
  assetFilename,
  resolveUrl,
  getAssetType,
  sleep
} = require('./utils');

/**
 * Main website cloner class
 */
class WebsiteCloner {
  constructor(options = {}) {
    this.headless = options.headless !== false;
    this.outputDir = options.outputDir || path.join(process.cwd(), 'output');
    this.viewport = options.viewport || { width: 1366, height: 768 };
    this.timeout = options.timeout || 60000;
    this.emit = options.emit || (() => {}); // Event emitter callback
  }

  /**
   * Log a message and emit it
   */
  log(type, message, data = {}) {
    const logEntry = {
      type,
      message,
      timestamp: new Date().toISOString(),
      ...data
    };
    this.emit('log', logEntry);
    console.log(`[${type}] ${message}`);
  }

  /**
   * Clone a website
   * @param {string} urlString - URL to clone
   * @returns {Promise<{success: boolean, outputPath: string, openUrl: string, error?: string}>}
   */
  async clone(urlString) {
    // Validate URL
    const { valid, url, error } = normalizeUrl(urlString);
    if (!valid) {
      this.log('error', `Invalid URL: ${error}`);
      return { success: false, outputPath: null, openUrl: null, error };
    }

    this.log('pipeline', `Starting clone of: ${url}`);

    // Create output folder
    const folderName = generateOutputFolder(url);
    const outputPath = path.join(this.outputDir, folderName);
    const assetsPath = path.join(outputPath, 'assets');

    // Ensure directories exist
    if (!existsSync(outputPath)) {
      mkdirSync(outputPath, { recursive: true });
    }
    if (!existsSync(assetsPath)) {
      mkdirSync(assetsPath, { recursive: true });
    }

    let browser = null;
    let page = null;

    try {
      // Launch browser
      this.log('pipeline', 'Launching browser...');
      browser = await chromium.launch({
        headless: this.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const context = await browser.newContext({
        viewport: this.viewport,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });

      page = await context.newPage();

      // Attach console listener
      page.on('console', msg => {
        this.log('console', `[${msg.type()}] ${msg.text()}`);
      });

      // Attach page error listener
      page.on('pageerror', err => {
        this.log('console', `[error] ${err.message}`);
      });

      // Track network requests
      const networkLogs = [];
      page.on('request', request => {
        const logEntry = {
          url: request.url(),
          method: request.method(),
          resourceType: request.resourceType()
        };
        networkLogs.push(logEntry);
        this.log('network', `>> ${request.method()} ${request.resourceType()} ${request.url().substring(0, 100)}...`);
      });

      page.on('response', response => {
        this.log('network', `<< ${response.status()} ${response.url().substring(0, 100)}...`);
      });

      // Navigate to page
      this.log('pipeline', 'Navigating to page...');
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: this.timeout
      });

      // Wait for initial hydration
      this.log('pipeline', 'Waiting for initial content load...');
      await sleep(2000);

      // Auto-scroll to load lazy content
      this.log('pipeline', 'Auto-scrolling to load lazy content...');
      await this.autoScroll(page);

      // Wait for network idle
      this.log('pipeline', 'Waiting for network idle...');
      await this.waitForNetworkIdle(page, 5000);

      // Extract rendered HTML
      this.log('pipeline', 'Extracting rendered HTML...');
      const html = await page.content();
      const finalUrl = page.url(); // In case of redirects

      // Parse HTML and collect assets
      this.log('pipeline', 'Parsing HTML and collecting assets...');
      const root = parse(html);
      const assets = this.collectAssets(root, finalUrl);

      this.log('pipeline', `Found ${assets.length} assets to download`);

      // Download assets
      this.log('pipeline', 'Downloading assets...');
      const assetMap = await this.downloadAssets(assets, assetsPath, context);

      // Also process CSS files to extract font references
      this.log('pipeline', 'Processing CSS files for font references...');
      await this.processCssFiles(assetMap, assetsPath, context, finalUrl);

      // Rewrite HTML with local paths
      this.log('pipeline', 'Rewriting HTML references...');
      const rewrittenHtml = this.rewriteHtml(html, assetMap, finalUrl);

      // Save output
      this.log('pipeline', 'Saving output...');
      const indexPath = path.join(outputPath, 'index.html');
      await fs.writeFile(indexPath, rewrittenHtml, 'utf-8');

      // Close browser
      await browser.close();
      browser = null;

      const openUrl = `/clone/${folderName}/index.html`;
      this.log('pipeline', `Clone complete! Output: ${outputPath}`);
      this.log('pipeline', `Open URL: ${openUrl}`);

      return {
        success: true,
        outputPath,
        openUrl,
        folderName
      };

    } catch (err) {
      this.log('error', `Clone failed: ${err.message}`);
      if (browser) {
        await browser.close();
      }
      return {
        success: false,
        outputPath: null,
        openUrl: null,
        error: err.message
      };
    }
  }

  /**
   * Auto-scroll to bottom of page to trigger lazy loading
   */
  async autoScroll(page) {
    let previousHeight = 0;
    let currentHeight = await page.evaluate(() => document.body.scrollHeight);
    let iterations = 0;
    const maxIterations = 20;

    while (currentHeight !== previousHeight && iterations < maxIterations) {
      previousHeight = currentHeight;

      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });

      await sleep(500);

      currentHeight = await page.evaluate(() => document.body.scrollHeight);
      iterations++;

      this.log('pipeline', `Scroll iteration ${iterations}: height=${currentHeight}`);
    }

    // Scroll back to top
    await page.evaluate(() => window.scrollTo(0, 0));
  }

  /**
   * Wait for network to become idle
   */
  async waitForNetworkIdle(page, timeout = 5000) {
    try {
      await page.waitForLoadState('networkidle', { timeout });
    } catch (e) {
      this.log('pipeline', 'Network idle timeout - continuing anyway');
    }
  }

  /**
   * Collect all asset URLs from parsed HTML
   */
  collectAssets(root, baseUrl) {
    const assets = new Set();

    // Images
    root.querySelectorAll('img[src]').forEach(el => {
      const src = el.getAttribute('src');
      if (src && !src.startsWith('data:')) {
        const resolved = resolveUrl(src, baseUrl);
        if (resolved) assets.add(resolved);
      }
    });

    // Srcset handling
    root.querySelectorAll('[srcset]').forEach(el => {
      const srcset = el.getAttribute('srcset');
      if (srcset) {
        srcset.split(',').forEach(part => {
          const [url] = part.trim().split(/\s+/);
          if (url && !url.startsWith('data:')) {
            const resolved = resolveUrl(url, baseUrl);
            if (resolved) assets.add(resolved);
          }
        });
      }
    });

    // CSS stylesheets
    root.querySelectorAll('link[rel="stylesheet"][href]').forEach(el => {
      const href = el.getAttribute('href');
      if (href && !href.startsWith('data:')) {
        const resolved = resolveUrl(href, baseUrl);
        if (resolved) assets.add(resolved);
      }
    });

    // Preload/prefetch links
    root.querySelectorAll('link[href]').forEach(el => {
      const href = el.getAttribute('href');
      const rel = el.getAttribute('rel') || '';
      if (href && !href.startsWith('data:') && (rel.includes('preload') || rel.includes('icon'))) {
        const resolved = resolveUrl(href, baseUrl);
        if (resolved) assets.add(resolved);
      }
    });

    // Scripts
    root.querySelectorAll('script[src]').forEach(el => {
      const src = el.getAttribute('src');
      if (src && !src.startsWith('data:')) {
        const resolved = resolveUrl(src, baseUrl);
        if (resolved) assets.add(resolved);
      }
    });

    // Video sources
    root.querySelectorAll('video[src], video source[src]').forEach(el => {
      const src = el.getAttribute('src');
      if (src && !src.startsWith('data:')) {
        const resolved = resolveUrl(src, baseUrl);
        if (resolved) assets.add(resolved);
      }
    });

    // Audio sources
    root.querySelectorAll('audio[src], audio source[src]').forEach(el => {
      const src = el.getAttribute('src');
      if (src && !src.startsWith('data:')) {
        const resolved = resolveUrl(src, baseUrl);
        if (resolved) assets.add(resolved);
      }
    });

    // Background images in inline styles (best effort)
    root.querySelectorAll('[style]').forEach(el => {
      const style = el.getAttribute('style');
      if (style) {
        const urlMatches = style.match(/url\(['"]?([^'")\s]+)['"]?\)/g);
        if (urlMatches) {
          urlMatches.forEach(match => {
            const urlMatch = match.match(/url\(['"]?([^'")\s]+)['"]?\)/);
            if (urlMatch && urlMatch[1] && !urlMatch[1].startsWith('data:')) {
              const resolved = resolveUrl(urlMatch[1], baseUrl);
              if (resolved) assets.add(resolved);
            }
          });
        }
      }
    });

    return Array.from(assets);
  }

  /**
   * Download all assets and return a map of original URL -> local path
   */
  async downloadAssets(assets, assetsPath, context) {
    const assetMap = new Map();

    for (const assetUrl of assets) {
      try {
        const assetType = getAssetType(assetUrl);
        const filename = assetFilename(assetUrl);
        const typeDir = path.join(assetsPath, assetType);

        if (!existsSync(typeDir)) {
          mkdirSync(typeDir, { recursive: true });
        }

        const localPath = path.join(typeDir, filename);
        const relativePath = `assets/${assetType}/${filename}`;

        // Download the asset
        const response = await context.request.get(assetUrl, { timeout: 10000 });

        if (response.ok()) {
          const buffer = await response.body();
          await fs.writeFile(localPath, buffer);
          assetMap.set(assetUrl, relativePath);
          this.log('pipeline', `Downloaded: ${filename} (${buffer.length} bytes)`);
        } else {
          this.log('warning', `Failed to download (${response.status()}): ${assetUrl.substring(0, 80)}...`);
          // Keep original URL on failure
        }
      } catch (err) {
        this.log('warning', `Error downloading asset: ${err.message} - ${assetUrl.substring(0, 80)}...`);
        // Keep original URL on failure
      }
    }

    return assetMap;
  }

  /**
   * Process downloaded CSS files to extract and download font references
   */
  async processCssFiles(assetMap, assetsPath, context, baseUrl) {
    const cssFiles = Array.from(assetMap.entries()).filter(([url]) => url.endsWith('.css'));

    for (const [cssUrl, localPath] of cssFiles) {
      try {
        const fullPath = path.join(path.dirname(assetsPath), localPath);
        const cssContent = await fs.readFile(fullPath, 'utf-8');

        // Find url() references
        const urlMatches = cssContent.match(/url\(['"]?([^'")\s]+)['"]?\)/g);
        if (!urlMatches) continue;

        let updatedCss = cssContent;

        for (const match of urlMatches) {
          const urlMatch = match.match(/url\(['"]?([^'")\s]+)['"]?\)/);
          if (!urlMatch || !urlMatch[1]) continue;

          const resourceUrl = urlMatch[1];
          if (resourceUrl.startsWith('data:')) continue;

          // Resolve relative to CSS file URL
          const resolvedUrl = resolveUrl(resourceUrl, cssUrl);
          if (!resolvedUrl) continue;

          // Check if already downloaded
          if (assetMap.has(resolvedUrl)) {
            const relativePath = assetMap.get(resolvedUrl);
            // Calculate relative path from CSS file to asset
            const cssDir = path.dirname(localPath);
            const relativeFromCss = path.relative(cssDir, relativePath).replace(/\\/g, '/');
            updatedCss = updatedCss.replace(match, `url('${relativeFromCss}')`);
            continue;
          }

          // Download the resource
          try {
            const assetType = getAssetType(resolvedUrl);
            const filename = assetFilename(resolvedUrl);
            const typeDir = path.join(assetsPath, assetType);

            if (!existsSync(typeDir)) {
              mkdirSync(typeDir, { recursive: true });
            }

            const assetLocalPath = path.join(typeDir, filename);
            const relativePath = `assets/${assetType}/${filename}`;

            const response = await context.request.get(resolvedUrl, { timeout: 10000 });
            if (response.ok()) {
              const buffer = await response.body();
              await fs.writeFile(assetLocalPath, buffer);
              assetMap.set(resolvedUrl, relativePath);
              this.log('pipeline', `Downloaded CSS resource: ${filename}`);

              // Update CSS with local path
              const cssDir = path.dirname(localPath);
              const relativeFromCss = path.relative(cssDir, relativePath).replace(/\\/g, '/');
              updatedCss = updatedCss.replace(match, `url('${relativeFromCss}')`);
            }
          } catch (err) {
            this.log('warning', `Failed to download CSS resource: ${resourceUrl}`);
          }
        }

        // Save updated CSS
        await fs.writeFile(fullPath, updatedCss, 'utf-8');

      } catch (err) {
        this.log('warning', `Error processing CSS file: ${err.message}`);
      }
    }
  }

  /**
   * Rewrite HTML to use local asset paths
   */
  rewriteHtml(html, assetMap, baseUrl) {
    let rewritten = html;

    // Sort by URL length (longest first) to avoid partial replacements
    const sortedAssets = Array.from(assetMap.entries()).sort((a, b) => b[0].length - a[0].length);

    for (const [originalUrl, localPath] of sortedAssets) {
      // Escape special regex characters in URL
      const escapedUrl = originalUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Replace in various attribute formats
      // src="url" or href="url" or url('...')
      const patterns = [
        new RegExp(`(src|href|srcset)=["']${escapedUrl}["']`, 'g'),
        new RegExp(`(src|href|srcset)=${escapedUrl}(?=[\\s>])`, 'g'),
        new RegExp(`url\\(['"]?${escapedUrl}['"]?\\)`, 'g')
      ];

      for (const pattern of patterns) {
        rewritten = rewritten.replace(pattern, (match) => {
          if (match.startsWith('url(')) {
            return `url('${localPath}')`;
          }
          const attr = match.match(/^(src|href|srcset)/)[0];
          return `${attr}="${localPath}"`;
        });
      }

      // Also handle srcset with multiple URLs
      // This is trickier - srcset can have "url 1x, url2 2x" format
      try {
        const parsedOriginal = new URL(originalUrl);
        const simpleUrl = parsedOriginal.pathname + parsedOriginal.search;
        // Replace both absolute and relative versions
        rewritten = rewritten.replace(new RegExp(escapedUrl, 'g'), localPath);
      } catch (e) {
        // URL parsing failed, skip
      }
    }

    return rewritten;
  }
}

module.exports = { WebsiteCloner };

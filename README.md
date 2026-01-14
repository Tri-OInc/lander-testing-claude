# GEEKOUT VEGAS 2026

```
 ██████╗ ███████╗███████╗██╗  ██╗ ██████╗ ██╗   ██╗████████╗
██╔════╝ ██╔════╝██╔════╝██║ ██╔╝██╔═══██╗██║   ██║╚══██╔══╝
██║  ███╗█████╗  █████╗  █████╔╝ ██║   ██║██║   ██║   ██║
██║   ██║██╔══╝  ██╔══╝  ██╔═██╗ ██║   ██║██║   ██║   ██║
╚██████╔╝███████╗███████╗██║  ██╗╚██████╔╝╚██████╔╝   ██║
 ╚═════╝ ╚══════╝╚══════╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝    ╚═╝

██╗   ██╗███████╗ ██████╗  █████╗ ███████╗    ██████╗  ██████╗ ██████╗  ██████╗
██║   ██║██╔════╝██╔════╝ ██╔══██╗██╔════╝    ╚════██╗██╔═████╗╚════██╗██╔════╝
██║   ██║█████╗  ██║  ███╗███████║███████╗     █████╔╝██║██╔██║ █████╔╝███████╗
╚██╗ ██╔╝██╔══╝  ██║   ██║██╔══██║╚════██║    ██╔═══╝ ████╔╝██║██╔═══╝ ██╔═══██╗
 ╚████╔╝ ███████╗╚██████╔╝██║  ██║███████║    ███████╗╚██████╔╝███████╗╚██████╔╝
  ╚═══╝  ╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚══════╝    ╚══════╝ ╚═════╝ ╚══════╝ ╚═════╝
```

## Website Cloner Workshop

> **Build a pixel-perfect website cloner with Claude Code in 45 minutes**

---

## Quick Start (One-Click!)

[![Open in GitHub Codespaces](https://github.com/codespaces/badge.svg)](https://codespaces.new/phc-global/GeekoutVegas2026)

---

## Setup

### 1. Start Claude Code

```bash
claude
```

### 2. Paste The Prompt Below!

Copy and paste the prompt into Claude Code and watch it build the entire app.

---

## The Prompt

> **How we made this prompt:** [View the ChatGPT conversation](https://chatgpt.com/share/6956cfff-7e08-800d-b1ab-e7b64f71d60d)

...............................................................................

```
YOU ARE CLAUDE CODE.
Build a working MVP "Website Cloner" that produces an EXACT static clone of a landing page (including VERY long pages), hosted locally by the same app (backend serves frontend). The app must be simple enough to build in a 45-minute workshop, but cloning quality must be high.

NON-NEGOTIABLE REQUIREMENTS
1) Backend serves frontend:
   - Single Node.js app (Express) that serves a UI and also runs the cloning pipeline.
2) Must use a real browser:
   - Use Playwright with Chromium. (No "requests + cheerio only" clone; it must render and capture a real DOM.)
3) Must have visible Chrome console logs:
   - Capture page console logs from Playwright and stream them to the web UI in real-time (WebSocket or SSE).
   - Also capture network request/response logs (URL, status, resource type).
4) Must clone ENTIRE page even if super long:
   - Scroll to bottom to trigger lazy-loading.
   - Wait for network idle.
   - Capture full HTML after render.
   - Download and rewrite assets locally (images, CSS, JS, fonts when possible).
5) Must produce a "viewable clone":
   - Output to ./output/<safe-hostname>_<timestamp>/
   - Provide a link in the UI to open the cloned page in a new tab.
6) MVP scope:
   - Only supports public pages without login.
   - Focus on "best possible static clone" (not a perfect JS app rehost).
7) Style requirement:
   - The APP UI itself should be "ultra-futuristic Willy Wonka" (neon candy-factory vibe), but the CLONED PAGE must remain identical. Do NOT restyle the clone. Only style the app UI.

TECH STACK
- Node 20+
- Express
- Playwright (Chromium)
- Minimal frontend: vanilla HTML + Tailwind via CDN OR a small bundled CSS. Keep it fast and workshop-friendly.
- Use WebSocket (ws) OR Server-Sent Events for streaming logs to UI.

USER FLOW (WEB UI)
- Home page: input for URL + "Clone" button.
- On submit:
  - Show live log console (like devtools) streaming:
    - [console] page console logs
    - [network] requests and responses
    - [pipeline] steps
  - Show progress:
    - Launch browser
    - Navigate
    - Auto-scroll
    - Snapshot DOM
    - Download assets
    - Rewrite references
    - Save output
    - Done
- When complete:
  - Display "Open Clone" link and output folder path.

CLONING PIPELINE (HIGH-QUALITY MVP)
Implement a pipeline that does:
A) Validate URL and normalize it.
B) Launch Playwright Chromium with sensible args:
   - headless true by default, but allow UI toggle in settings for debugging.
   - set viewport 1366x768.
C) Attach listeners:
   - page.on("console", ...)
   - page.on("pageerror", ...)
   - page.on("request", ...)
   - page.on("response", ...)
   - Emit these logs to the UI stream.
D) Navigate:
   - goto(url, { waitUntil: "domcontentloaded", timeout: 60000 })
   - wait a bit for hydration
   - auto-scroll to bottom to trigger lazy content (loop: scroll, wait, until height stabilizes or max iterations)
   - waitUntil network idle with a safety timeout
E) Extract rendered HTML:
   - const html = await page.content()
   - Also collect <base href> if present
F) Collect asset URLs from the rendered HTML:
   - Parse HTML (use jsdom or node-html-parser).
   - Extract src/href from:
     - img[src], source[srcset], link[rel=stylesheet][href], script[src], video[src], audio[src]
     - also handle srcset: download each URL, rewrite to local
     - inline styles with url(...) (best effort)
   - Also collect fonts referenced in CSS (best effort):
     - For each downloaded CSS file, parse url(...) references and download them too.
G) Download assets:
   - Use Playwright's request context OR node fetch with proper headers.
   - Save assets into ./output/.../assets/<type>/...
   - Use deterministic filenames:
     - hash(url) + original extension if any
   - Respect relative URLs (resolve against final page URL).
H) Rewrite HTML references:
   - Replace remote URLs with local relative paths.
   - Preserve querystrings only if needed for extension detection; otherwise ignore.
   - Ensure output index.html references local assets.
I) Save output:
   - index.html in output folder
   - assets subfolders
J) Serve clone:
   - Express should statically serve ./output so the user can open the clone from the UI:
     /clone/<folder>/index.html

IMPORTANT EDGE CASES (DO BEST EFFORT, NOT PERFECT)
- Relative URLs must resolve correctly.
- Data URLs should be left as-is.
- If a resource fails to download, keep original URL and log a warning.
- If the page uses heavy JS to load content after idle, the autoscroll + wait should still capture most of it.

PROJECT STRUCTURE
- /server
  - index.js (Express server, routes, websocket/SSE)
  - cloner.js (core pipeline)
  - utils.js (hashing, url normalize, safe folder names)
- /public
  - index.html (UI)
  - app.js (UI logic to call clone endpoint + subscribe to logs)
  - styles.css (optional)
- /output (generated clones)

API
- POST /api/clone
  Body: { url: string }
  Returns: { jobId, outputPath, openUrl }
- GET /api/jobs/:jobId (optional, can be in-memory only)
- Logs streamed:
  - WS: /ws?jobId=...
  - or SSE: /api/stream/:jobId

WORKSHOP FRIENDLY
- Provide a single command to run:
  - npm install
  - npx playwright install chromium (or include in postinstall)
  - npm run dev
- Include a README with:
  - prerequisites
  - how to run
  - how to clone a URL
  - troubleshooting (mac/windows)
- Keep code small and readable.

QUALITY CHECKS
After implementing, add a "self-test" function:
- Clone a known simple page (example.com) and verify:
  - output folder created
  - index.html exists
  - at least 1 asset downloaded
  - clone opens in browser route

DELIVERABLES
1) Full working code in the repo
2) README.md with steps
3) The UI with "ultra-futuristic Willy Wonka" vibe:
   - neon gradients, candy glow, playful futuristic typography
   - BUT do not affect the clone output styling.

NOW BUILD IT.
- Create all files.
- Implement the server, UI, cloning pipeline, streaming logs.
- Ensure it runs end-to-end.
- Make sensible engineering choices to finish fast.
- Use design skill for frontend design and use MCPs we have to test it.
```

...............................................................................

---

## Push to Your Own GitHub

After building, save your work to your own repo:

```bash
# 1. Create a new repo on GitHub (github.com/new)
#    Name it: website-cloner (or whatever you want)
#    Do NOT initialize with README

# 2. Change the remote to your repo
git remote set-url origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# 3. Push your code
git add -A
git commit -m "My website cloner from Geekout Vegas 2026"
git push -u origin main
```

---

## Pre-Installed Dependencies

| Package | Purpose |
|---------|---------|
| **Node.js 20** | Runtime |
| **Playwright** | Browser automation & cloning |
| **Express** | Web server |
| **WebSocket (ws)** | Real-time log streaming |

---

## Running the Completed App

Once Claude Code has built the app, run it:

```bash
# Install dependencies (if not already done)
npm install

# Start the server
npm run dev
```

The app will start at **http://localhost:3000**

### How to Clone a Website

1. Open http://localhost:3000 in your browser
2. Enter a URL (e.g., `example.com` or `https://stripe.com`)
3. Click the **Clone** button
4. Watch the real-time logs stream in the console
5. When complete, click **Open Cloned Page** to view your clone

### Running the Self-Test

```bash
npm test
```

This clones `example.com` and verifies the output is correct.

---

## Project Structure (After Build)

```
├── server/
│   ├── index.js      # Express server + WebSocket
│   ├── cloner.js     # Core cloning pipeline
│   ├── utils.js      # Helper utilities
│   └── self-test.js  # Self-test script
├── public/
│   ├── index.html    # UI (Willy Wonka themed!)
│   └── app.js        # Frontend JavaScript
├── output/           # Generated clones go here
│   └── example_com_2026-.../
│       ├── index.html
│       └── assets/
└── package.json
```

---

## Troubleshooting

### Browser Won't Install

```bash
npx playwright install chromium --with-deps
```

### Permission Errors on Linux

```bash
chmod -R 755 ./output
```

### Port Already in Use

```bash
PORT=3001 npm run dev
```

### Clone Looks Broken

Some sites use JavaScript to render content dynamically. The cloner captures the DOM after auto-scrolling, but heavy SPAs may not clone perfectly. This is expected for an MVP!

---

## Need Help?

Raise your hand or ask in the workshop chat!

---

**Workshop by [Samar Hussain](https://github.com/samarhussain90)**

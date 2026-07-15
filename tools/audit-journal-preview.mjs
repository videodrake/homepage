#!/usr/bin/env node
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const baseUrl = process.argv[2] || 'http://127.0.0.1:4173';
const outputDir = path.resolve(process.argv[3] || 'artifacts/onroad-journal-v4-preview');
const widths = [390, 768, 1024, 1440];
const journalSlugs = ['journal-01-a', 'journal-01-b', 'journal-02-a', 'journal-02-b', 'journal-04-a', 'journal-04-b'];
const pages = [
  { name: 'home-journal', path: '/', fullPage: false, selector: '.ov3-journal' },
  { name: 'journal-index', path: '/journal/index.html', fullPage: true },
  ...journalSlugs.map((slug) => ({ name: slug, path: `/journal/${slug}.html`, fullPage: false, type: 'journal-post' })),
];

let previewProcess = null;
try {
  await fetch(`${baseUrl}/journal/index.html`);
} catch {
  const previewPort = new URL(baseUrl).port || '4173';
  previewProcess = spawn(process.execPath, ['tools/preview-cafe24-skin.mjs', 'skin9', previewPort], { cwd: process.cwd(), stdio: 'ignore' });
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/journal/index.html`);
      if (response.ok) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

await fs.mkdir(outputDir, { recursive: true });
const browserCandidates = [
  process.env.PLAYWRIGHT_CHROME_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
].filter(Boolean);
const executablePath = browserCandidates.find((candidate) => fssync.existsSync(candidate));
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const reports = [];

for (const target of pages) {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
    const errors = [];
    page.on('console', (message) => { if (message.type() === 'error') errors.push(`console: ${message.text()}`); });
    page.on('pageerror', (error) => errors.push(`page: ${error.message}`));
    await page.goto(`${baseUrl}${target.path}`, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      const images = Array.from(document.images).filter((image) => image.src.startsWith(window.location.origin));
      images.forEach((image) => { image.loading = 'eager'; });
      await Promise.all(images.map((image) => image.decode().catch(() => undefined)));
    });
    await page.evaluate(() => document.fonts && document.fonts.ready);
    const metrics = await page.evaluate(() => ({
      title: document.title,
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      brokenImages: Array.from(document.images).filter((image) => image.src.startsWith(window.location.origin) && (!image.complete || image.naturalWidth === 0)).map((image) => image.src),
      h1Lines: (() => {
        const h1 = document.querySelector('main h1');
        if (!h1) return 0;
        const range = document.createRange();
        range.selectNodeContents(h1);
        return new Set(Array.from(range.getClientRects()).map((rect) => Math.round(rect.top))).size;
      })(),
    }));
    for (let i = errors.length - 1; i >= 0; i -= 1) {
      if (/ERR_NETWORK_ACCESS_DENIED|404 \(Not Found\)/.test(errors[i])) errors.splice(i, 1);
    }

    if (target.name === 'journal-index' && width === 390) {
      await page.fill('[data-journal-search]', '테이퍼링');
      const visibleAfterSearch = await page.locator('[data-journal-card]:visible').count();
      if (visibleAfterSearch !== 1) errors.push(`search expected 1 result, got ${visibleAfterSearch}`);
      await page.fill('[data-journal-search]', '');
      await page.click('[data-journal-filter="계절 러닝"]');
      const visibleAfterFilter = await page.locator('[data-journal-card]:visible').count();
      if (visibleAfterFilter !== 2) errors.push(`filter expected 2 results, got ${visibleAfterFilter}`);
      await page.click('[data-journal-filter="전체"]');
    }

    const screenshot = path.join(outputDir, `${target.name}-${width}.png`);
    if (target.selector) await page.locator(target.selector).screenshot({ path: screenshot });
    else await page.screenshot({ path: screenshot, fullPage: target.fullPage });
    if (target.name === 'journal-04-b' && (width === 390 || width === 1440)) {
      await page.locator('.jv4-post-bridge').screenshot({ path: path.join(outputDir, `${target.name}-bridge-${width}.png`) });
      await page.locator('.jv4-reading > :is(p, .jp-quote):first-child').screenshot({ path: path.join(outputDir, `${target.name}-answer-${width}.png`) });
      const table = page.locator('.jv4-reading .jp-table-wrap').first();
      if (await table.count()) await table.screenshot({ path: path.join(outputDir, `${target.name}-table-${width}.png`) });
    }
    for (let i = errors.length - 1; i >= 0; i -= 1) {
      if (/ERR_NETWORK_ACCESS_DENIED|404 \(Not Found\)/.test(errors[i])) errors.splice(i, 1);
    }
    reports.push({ page: target.name, width, ...metrics, overflow: metrics.scrollWidth > metrics.clientWidth + 1, errors, screenshot: path.relative(process.cwd(), screenshot) });
    await page.close();
  }
}

await browser.close();
if (previewProcess) previewProcess.kill();
await fs.writeFile(path.join(outputDir, 'report.json'), `${JSON.stringify(reports, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(reports, null, 2));
if (reports.some((report) => report.overflow || report.brokenImages.length || report.errors.length)) process.exit(1);

import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const outDir = path.resolve('tmp/live-audit');
const pages = [
  { name: 'home', url: 'https://zenera.kr/' },
  { name: 'product', url: 'https://zenera.kr/product/detail.html?product_no=11' },
  { name: 'journal', url: 'https://zenera.kr/journal/index.html' },
  { name: 'journal-post', url: 'https://zenera.kr/journal/post.html' },
  { name: 'company', url: 'https://zenera.kr/shopinfo/company.html' },
  { name: 'guide', url: 'https://zenera.kr/shopinfo/guide.html' },
];

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

const ignoreUrlPatterns = [
  /google-analytics/i,
  /googletagmanager/i,
  /facebook/i,
  /kakao/i,
  /naver/i,
  /criteo/i,
  /wcs\.naver/i,
  /lambda-url\.ap-northeast-2\.on\.aws/i,
  /js-error-tracer-api\.cafe24\.com/i,
];

function shouldIgnoreFailure(url) {
  return ignoreUrlPatterns.some((pattern) => pattern.test(url));
}

async function visibleText(page, selector) {
  const locator = page.locator(selector).first();
  if ((await locator.count()) === 0) return null;
  return (await locator.innerText().catch(() => null))?.trim() ?? null;
}

async function auditPage(browser, pageSpec, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    locale: 'ko-KR',
  });
  const page = await context.newPage();
  const consoleMessages = [];
  const pageErrors = [];
  const failedRequests = [];
  const badResponses = [];

  page.on('console', (msg) => {
    if (['error', 'warning'].includes(msg.type())) {
      consoleMessages.push({ type: msg.type(), text: msg.text().slice(0, 500) });
    }
  });
  page.on('pageerror', (error) => {
    pageErrors.push(error.message);
  });
  page.on('requestfailed', (request) => {
    const url = request.url();
    if (!shouldIgnoreFailure(url)) {
      failedRequests.push({ url, failure: request.failure()?.errorText ?? 'unknown' });
    }
  });
  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();
    if (status >= 400 && !shouldIgnoreFailure(url)) {
      badResponses.push({ status, url });
    }
  });

  const response = await page.goto(pageSpec.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
  await page.waitForLoadState('networkidle', { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1200);

  const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = Math.max(300, Math.round(viewport.height * 0.75));
  for (let y = 0; y < scrollHeight; y += step) {
    await page.evaluate((nextY) => window.scrollTo(0, nextY), y);
    await page.waitForTimeout(80);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);

  const screenshot = path.join(outDir, `${pageSpec.name}-${viewport.name}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });

  const metrics = await page.evaluate(() => {
    const body = document.body;
    const html = document.documentElement;
    const vw = window.innerWidth;
    const overflowEls = [];
    document.querySelectorAll('body *').forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.right > vw + 2) {
        overflowEls.push({
          tag: el.tagName.toLowerCase(),
          className: String(el.className || '').slice(0, 140),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        });
      }
    });
    const firstImage = document.querySelector('main img, #contents img, body img');
    return {
      title: document.title,
      bodyTextLength: body?.innerText?.trim().length ?? 0,
      scrollWidth: html.scrollWidth,
      clientWidth: html.clientWidth,
      scrollHeight: html.scrollHeight,
      h1: document.querySelector('h1')?.innerText?.trim() ?? null,
      visibleImages: Array.from(document.images).filter((img) => {
        const rect = img.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < window.innerHeight;
      }).length,
      firstImageComplete: firstImage ? firstImage.complete : null,
      overflowEls: overflowEls.slice(0, 12),
    };
  });

  const result = {
    page: pageSpec.name,
    viewport: viewport.name,
    url: pageSpec.url,
    status: response?.status() ?? null,
    screenshot,
    metrics,
    text: {
      header: await visibleText(page, '.site-header, #header'),
      primaryCta: await visibleText(page, '.btn--primary, .action_button .btnSubmit, a[href*="/product"]'),
    },
    consoleMessages,
    pageErrors,
    failedRequests,
    badResponses,
  };

  await context.close();
  return result;
}

await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

try {
  for (const pageSpec of pages) {
    for (const viewport of viewports) {
      results.push(await auditPage(browser, pageSpec, viewport));
    }
  }
} finally {
  await browser.close();
}

const reportPath = path.join(outDir, 'report.json');
await fs.writeFile(reportPath, JSON.stringify(results, null, 2));

const summary = results.map((result) => ({
  page: result.page,
  viewport: result.viewport,
  status: result.status,
  h1: result.metrics.h1,
  width: `${result.metrics.clientWidth}/${result.metrics.scrollWidth}`,
  height: result.metrics.scrollHeight,
  images: result.metrics.visibleImages,
  console: result.consoleMessages.length,
  failed: result.failedRequests.length,
  bad: result.badResponses.length,
  overflow: result.metrics.overflowEls.length,
  screenshot: path.relative(process.cwd(), result.screenshot),
}));

console.table(summary);
console.log(`report=${path.relative(process.cwd(), reportPath)}`);

const hardFailures = results.filter((result) => (
  result.status >= 400 ||
  result.pageErrors.length > 0 ||
  result.failedRequests.length > 0 ||
  result.badResponses.some((item) => item.status >= 500) ||
  (result.viewport === 'mobile' && result.metrics.scrollWidth > result.metrics.clientWidth + 2)
));

if (hardFailures.length > 0) {
  console.error(JSON.stringify(hardFailures.map((result) => ({
    page: result.page,
    viewport: result.viewport,
    status: result.status,
    pageErrors: result.pageErrors,
    failedRequests: result.failedRequests,
    badResponses: result.badResponses,
    overflowEls: result.metrics.overflowEls,
  })), null, 2));
  process.exitCode = 1;
}

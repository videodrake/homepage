// Onroad redesign — local screenshot harness.
// Renders each art-direction mockup with REAL local Noto (CJK serif/sans) since
// fonts.gstatic.com is blocked by the egress proxy. Desktop + mobile, full page.
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXE = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const targets = (process.env.SHOOT_TARGETS
  ? process.env.SHOOT_TARGETS.split(',').map(s => ({ id: s.replace(/\.html$/, ''), file: s.endsWith('.html') ? s : s + '.html' }))
  : [
      { id: 'welcome-runner', file: 'welcome-runner.html' },
      { id: 'welcome-general', file: 'welcome-general.html' },
      { id: 'product', file: 'product.html' },
      { id: 'journal', file: 'journal.html' },
    ]);

const viewports = [
  { name: 'desktop', width: 1440, height: 960, dsf: 1 },
  { name: 'mobile', width: 390, height: 844, dsf: 2 },
];

const browser = await chromium.launch({ executablePath: EXE });
for (const t of targets) {
  const fileUrl = 'file://' + path.join(HERE, t.file);
  for (const vp of viewports) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: vp.dsf,
      locale: 'ko-KR',
    });
    const page = await ctx.newPage();
    try {
      await page.goto(fileUrl, { waitUntil: 'load', timeout: 30000 });
      await page.evaluate(() => document.fonts && document.fonts.ready);
      // step-scroll through the page so IntersectionObserver reveals fire for
      // every section (a single jump skips mid-page intersection frames).
      await page.evaluate(async () => {
        const vh = window.innerHeight;
        const max = document.body.scrollHeight;
        for (let y = 0; y <= max; y += Math.round(vh * 0.6)) {
          window.scrollTo(0, y);
          await new Promise(r => setTimeout(r, 120));
        }
        window.scrollTo(0, max);
        await new Promise(r => setTimeout(r, 300));
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(500);
      const out = path.join(HERE, 'shots', `${t.id}-${vp.name}.png`);
      await page.screenshot({ path: out, fullPage: true });
      // Above-the-fold crop too (hero only)
      const fold = path.join(HERE, 'shots', `${t.id}-${vp.name}-fold.png`);
      await page.screenshot({ path: fold, fullPage: false });
      console.log('OK', t.id, vp.name);
    } catch (e) {
      console.error('FAIL', t.id, vp.name, e.message);
    } finally {
      await ctx.close();
    }
  }
}
await browser.close();
console.log('all done');

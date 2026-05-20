#!/usr/bin/env node
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const DEFAULT_REGULATION_CHECK = path.resolve('tools', 'regulation_check.py');
const DEFAULT_AUTOMATION_ROOT = process.cwd();
const DEFAULT_PUBLISHED_DIR = path.join(DEFAULT_AUTOMATION_ROOT, 'content', 'published');
const DEFAULT_LEDGER = path.join(DEFAULT_AUTOMATION_ROOT, 'content', 'CONTENT_STATE.md');
const PENDING_STATUS = 'published_md_ready';
const DISCLAIMER_PATTERN = new RegExp('\\uC81C\\uD488\\uC815\\uBCF4\\uC640 \\uAD00\\uB828 \\uC5C6\\uB294|\\uD559\\uC220 \\uC790\\uB8CC\\uC5D0 \\uADFC\\uAC70\\uD55C|\\uC77C\\uBC18 \\uAC74\\uAC15\\uC815\\uBCF4');
const KOREAN_KEY_RE = /^([^:]+):\s*(.*)$/;

function usage(exitCode = 0) {
  console.log(`Usage: node tools/build-journal-cafe24.mjs <published.md> --slug <slug> [options]\n\nOptions:\n  --slug <slug>                 Optional output slug. Default: markdown filename\n  --write-cafe24                Write cafe24/journal/<slug>.html and copy assets into cafe24/SkinImg/img/journal/<slug>/\n  --latest                      Use latest markdown in content/published. Default selects the published_md_ready row from content/CONTENT_STATE.md
  --out-dir <dir>               Dry-run output directory. Default: tmp/journal-build/<slug>\n  --regulation-check <path>     regulation_check.py path\n  --automation-root <path>      Repo root for resolving /assets paths
  --published-dir <path>        Directory used by --latest\n  --date <YYYY / MM / DD>       Hero date text. Default: today in Asia/Seoul\n  --category <text>             Hero category. Default: Pace Science\n  --number <text>               Hero issue label. Default: slug\n  --author <text>               Author name. Default: ONROAD Journal\n  --read-time <text>            Read time. Default: 7 min read\n  --site-url <url>              Absolute site URL for BlogPosting JSON-LD. Default: https://zenera.kr\n  --allow-missing-assets        Do not fail when referenced image files are missing\n  --no-regulation-check         For local debugging only; do not use for publishing\n`);
  process.exit(exitCode);
}

function latestMarkdown(dir) {
  if (!fssync.existsSync(dir)) throw new Error(`Published directory not found: ${dir}`);
  const files = fssync.readdirSync(dir)
    .filter((name) => name.toLowerCase().endsWith('.md'))
    .map((name) => {
      const fullPath = path.join(dir, name);
      return { fullPath, mtimeMs: fssync.statSync(fullPath).mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);
  if (!files.length) throw new Error(`No published markdown files found in: ${dir}`);
  return files[0].fullPath;
}

function deriveSlug(inputPath) {
  return path.basename(inputPath).replace(/\.md$/i, '');
}

// Selects the markdown to stage from the Git ledger (content/CONTENT_STATE.md):
// the single row whose status is `published_md_ready` is the next journal to deploy.
// Falls back to the most recent markdown when the ledger is absent.
function pendingFromLedger(publishedDir, ledgerPath = DEFAULT_LEDGER) {
  if (!fssync.existsSync(ledgerPath)) return latestMarkdown(publishedDir);
  const pending = [];
  for (const line of fssync.readFileSync(ledgerPath, 'utf8').split(/\r?\n/)) {
    if (!line.trim().startsWith('|')) continue;
    const cells = line.split('|').map((cell) => cell.replace(/`/g, '').trim());
    const slug = cells[1] || '';
    const status = cells[5] || '';
    if (status === PENDING_STATUS && /^journal-/.test(slug)) pending.push(slug);
  }
  if (pending.length === 0) {
    throw new Error(`No journal marked \`${PENDING_STATUS}\` in ${path.relative(DEFAULT_AUTOMATION_ROOT, ledgerPath)}. Pass a markdown path explicitly or use --latest.`);
  }
  if (pending.length > 1) {
    throw new Error(`Multiple journals are pending deploy (${pending.join(', ')}). Pass the target explicitly, e.g. content/published/${pending[0]}.md --slug ${pending[0]}.`);
  }
  const file = path.join(publishedDir, `${pending[0]}.md`);
  if (!fssync.existsSync(file)) {
    throw new Error(`Ledger marks ${pending[0]} as ${PENDING_STATUS} but ${path.relative(DEFAULT_AUTOMATION_ROOT, file)} is missing.`);
  }
  return file;
}

function parseArgs(argv) {
  const args = { input: null, writeCafe24: false, allowMissingAssets: false, regulation: DEFAULT_REGULATION_CHECK, automationRoot: DEFAULT_AUTOMATION_ROOT, siteUrl: 'https://zenera.kr' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!args.input && !arg.startsWith('--')) { args.input = arg; continue; }
    if (arg === '--help' || arg === '-h') usage(0);
    if (arg === '--latest') { args.latest = true; continue; }
    if (arg === '--write-cafe24') { args.writeCafe24 = true; continue; }
    if (arg === '--allow-missing-assets') { args.allowMissingAssets = true; continue; }
    if (arg === '--no-regulation-check') { args.noRegulationCheck = true; continue; }
    const valueFlags = new Set(['--slug', '--out-dir', '--regulation-check', '--automation-root', '--published-dir', '--date', '--category', '--number', '--author', '--read-time', '--site-url']);
    if (valueFlags.has(arg)) {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      i += 1;
      const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      if (key === 'regulationCheck') args.regulation = value;
      else args[key] = value;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  if (!args.input) {
    const publishedDir = args.publishedDir || DEFAULT_PUBLISHED_DIR;
    args.input = args.latest ? latestMarkdown(publishedDir) : pendingFromLedger(publishedDir);
  }
  if (!args.slug) args.slug = deriveSlug(args.input);
  return args;
}

function todayKst() {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' });
  const parts = Object.fromEntries(formatter.formatToParts(new Date()).map((part) => [part.type, part.value]));
  return `${parts.year} / ${parts.month} / ${parts.day}`;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function inlineMarkdown(text) {
  let out = escapeHtml(text);
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  out = out.replace(/`([^`]+)`/g, '<code>$1</code>');
  return out;
}

function splitFrontmatter(raw) {
  raw = raw.replace(/^\uFEFF/, '');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { meta: {}, body: raw };
  const meta = {};
  for (const line of match[1].trim().split(/\r?\n/)) {
    const item = line.match(KOREAN_KEY_RE);
    if (!item) continue;
    meta[item[1]] = item[2].replace(/^['"]|['"]$/g, '');
  }
  return { meta, body: raw.slice(match[0].length).trim() };
}

function stripTitle(body) {
  const lines = body.split(/\r?\n/);
  const firstH1 = lines.findIndex((line) => line.startsWith('# '));
  if (firstH1 === -1) return { title: null, body };
  const title = lines[firstH1].replace(/^#\s+/, '').trim();
  lines.splice(firstH1, 1);
  return { title, body: lines.join('\n').trim() };
}

function remapAsset(src, slug) {
  if (src.startsWith(`/assets/${slug}/`)) return src.replace(`/assets/${slug}/`, `/SkinImg/img/journal/${slug}/`);
  if (src.startsWith('/assets/')) return `/SkinImg/img/journal/${slug}/${path.posix.basename(src)}`;
  return src;
}

function markdownToHtml(body, slug) {
  const lines = body.split(/\r?\n/);
  const html = [];
  const images = [];
  let paragraph = [];
  let blockquote = [];
  let list = [];
  let table = [];

  const flushParagraph = () => {
    if (!paragraph.length) return;
    const text = paragraph.join(' ').trim();
    const cls = DISCLAIMER_PATTERN.test(text) ? ' class="jp-disclaimer"' : '';
    html.push(`<p${cls}>${inlineMarkdown(text)}</p>`);
    paragraph = [];
  };
  const flushBlockquote = () => {
    if (!blockquote.length) return;
    html.push('<figure class="jp-quote">');
    html.push(`<p>${inlineMarkdown(blockquote.join(' '))}</p>`);
    html.push('</figure>');
    blockquote = [];
  };
  const flushList = () => {
    if (!list.length) return;
    html.push('<ul class="jp-list">');
    for (const item of list) html.push(`<li>${inlineMarkdown(item)}</li>`);
    html.push('</ul>');
    list = [];
  };
  const flushTable = () => {
    if (table.length < 2) { table = []; return; }
    const rows = table.map((line) => line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()));
    const header = rows[0];
    const bodyRows = rows.slice(2);
    html.push('<div class="jp-table-wrap"><table class="jp-table"><thead><tr>');
    for (const cell of header) html.push(`<th>${inlineMarkdown(cell)}</th>`);
    html.push('</tr></thead><tbody>');
    for (const row of bodyRows) {
      html.push('<tr>');
      for (const cell of row) html.push(`<td>${inlineMarkdown(cell)}</td>`);
      html.push('</tr>');
    }
    html.push('</tbody></table></div>');
    table = [];
  };
  const flushAll = () => { flushParagraph(); flushBlockquote(); flushList(); flushTable(); };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) { flushAll(); continue; }
    if (/^[-\u2500]{3,}$/.test(line)) { flushAll(); continue; }
    if (/^\|.+\|$/.test(line)) { flushParagraph(); flushBlockquote(); flushList(); table.push(line); continue; }
    if (line.startsWith('>')) { flushParagraph(); flushList(); flushTable(); blockquote.push(line.replace(/^>\s?/, '').trim()); continue; }
    if (/^-\s+/.test(line)) { flushParagraph(); flushBlockquote(); flushTable(); list.push(line.replace(/^-\s+/, '').trim()); continue; }
    const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      flushAll();
      const alt = image[1];
      const originalSrc = image[2];
      const src = remapAsset(originalSrc, slug);
      let caption = '';
      const next = (lines[i + 1] || '').trim();
      if (/^\*.*\*$/.test(next)) { caption = next.replace(/^\*/, '').replace(/\*$/, '').trim(); i += 1; }
      images.push({ originalSrc, src });
      html.push('<figure class="jp-figure">');
      html.push(`<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" loading="lazy">`);
      if (caption) html.push(`<figcaption>${inlineMarkdown(caption)}</figcaption>`);
      html.push('</figure>');
      continue;
    }
    if (line.startsWith('## ')) { flushAll(); html.push(`<h2>${inlineMarkdown(line.replace(/^##\s+/, '').trim())}</h2>`); continue; }
    if (line.startsWith('### ')) { flushAll(); html.push(`<h3>${inlineMarkdown(line.replace(/^###\s+/, '').trim())}</h3>`); continue; }
    if (line.startsWith('#### ')) { flushAll(); html.push(`<h4>${inlineMarkdown(line.replace(/^####\s+/, '').trim())}</h4>`); continue; }
    if (line === '\uCD9C\uCC98:') { flushAll(); html.push('<h3>\uCD9C\uCC98</h3>'); continue; }
    paragraph.push(line);
  }
  flushAll();
  return { articleHtml: html.join('\n        '), images };
}

function plainDeck(body) {
  const line = body.split(/\r?\n/).find((item) => {
    const text = item.trim();
    return text && !text.startsWith('!') && !text.startsWith('#') && !text.startsWith('>') && !text.startsWith('|') && !text.startsWith('-') && !/^\*.*\*$/.test(text) && !/^[-\u2500]{3,}$/.test(text);
  });
  return (line || '').replace(/\*\*/g, '').replace(/\*/g, '').slice(0, 140);
}

function renderPage({ title, deck, articleHtml, heroImage, args, meta = {} }) {
  const category = args.category || 'Pace Science';
  const number = args.number || args.slug;
  const date = args.date || normalizeDate(meta.date_drafted) || todayKst();
  const structuredData = renderStructuredData({ title, deck, heroImage, args, date });
  return `<!--@layout(/layout/basic/layout.html)-->
<main class="onroad-page journal-post journal-post--generated">
  ${structuredData}
  <section class="jp-hero" data-header-light>
    <div class="jp-hero__inner">
      <div class="jp-topline">
        <a href="/journal/index.html">All Journal</a>
        <span>${escapeHtml(date)}</span>
      </div>
      <div class="eyebrow">${escapeHtml(category)} / ${escapeHtml(number)}</div>
      <h1>${inlineMarkdown(title)}</h1>
      <p class="jp-deck">${escapeHtml(deck)}</p>
    </div>
  </section>

  <section class="jp-body" data-header-light>
    <div class="jp-layout">
      <article class="jp-article">
        ${articleHtml}
      </article>
    </div>
  </section>
</main>
`;
}

function absoluteUrl(base, pathname) {
  try {
    return new URL(pathname, base.endsWith('/') ? base : `${base}/`).toString();
  } catch {
    return pathname;
  }
}

function normalizeDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[1]} / ${match[2]} / ${match[3]}`;
  return null;
}

function renderStructuredData({ title, deck, heroImage, args, date }) {
  const pageUrl = absoluteUrl(args.siteUrl, `/journal/${args.slug}.html`);
  const imageUrl = heroImage ? absoluteUrl(args.siteUrl, heroImage) : undefined;
  const published = date.replace(/\s*\/\s*/g, '-');
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: title,
    description: deck,
    url: pageUrl,
    mainEntityOfPage: pageUrl,
    datePublished: published,
    dateModified: published,
    author: {
      '@type': 'Organization',
      name: args.author || 'ONROAD Journal',
    },
    publisher: {
      '@type': 'Organization',
      name: 'ONROAD',
    },
  };
  if (imageUrl) data.image = [imageUrl];
  return `<script type="application/ld+json">${JSON.stringify(data).replaceAll('<', '\\u003c')}</script>`;
}

function decodeEntities(value = '') {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}

function truncateText(value, limit) {
  const text = String(value).trim().replace(/\s+/g, ' ');
  if (text.length <= limit) return text;
  return `${text.slice(0, limit).trim()}\u2026`;
}

function collectJournalEntries(dir) {
  return fssync.readdirSync(dir)
    .filter((name) => /^journal-.+\.html$/i.test(name))
    .map((name) => {
      const slug = name.replace(/\.html$/i, '');
      const html = fssync.readFileSync(path.join(dir, name), 'utf8').replace(/^\uFEFF/, '');
      const h1 = (html.match(/<h1>([\s\S]*?)<\/h1>/) || [])[1] || slug;
      const fullTitle = decodeEntities(h1.replace(/<[^>]+>/g, '')).replace(/\.\s*$/, '').trim();
      const [headline, ...rest] = fullTitle.split(/\s*[\u2014\u2013-]\s+/);
      const deckRaw = (html.match(/<p class="jp-deck">([\s\S]*?)<\/p>/) || [])[1] || '';
      const deck = decodeEntities(deckRaw.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
      const eyebrow = (html.match(/<div class="eyebrow">([^<]*?)\s*\//) || [])[1] || 'Pace Science';
      const date = (html.match(/"datePublished":"([^"]+)"/) || [])[1] || '';
      const articleText = ((html.match(/<article[^>]*>([\s\S]*?)<\/article>/) || [])[1] || '').replace(/<[^>]+>/g, '');
      const minutes = Math.max(3, Math.round(articleText.replace(/\s+/g, '').length / 600));
      return {
        slug,
        title: headline.trim() || fullTitle,
        subtitle: rest.join(' \u2014 ').trim(),
        fullTitle,
        deck,
        category: eyebrow.trim() || 'Pace Science',
        date,
        readTime: `${minutes} min`,
        hero: `/SkinImg/img/journal/${slug}/img-1.png`,
        label: slug.replace(/^journal-/, '').toUpperCase(),
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug, undefined, { numeric: true }));
}

function renderJournalIndex(entries) {
  const ordered = [...entries].reverse();
  const feature = ordered[0];
  const cards = ordered.slice(1);
  const picks = ordered.slice(0, 3);
  const categories = [...new Set(entries.map((entry) => entry.category))];
  const latestYear = ordered.map((entry) => (entry.date || '').slice(0, 4)).find(Boolean)
    || String(new Date().getFullYear());
  const excerpt = (entry) => escapeHtml(entry.subtitle ? truncateText(entry.subtitle, 90) : truncateText(entry.deck, 90));

  const featureBlock = feature ? `  <section class="jr-feature" data-header-light>
    <a class="jr-feature__link" href="/journal/${feature.slug}.html">
      <div class="jr-feature__media" style="background-image:url('${feature.hero}');">
        <span class="content-card__tag">Feature / ${escapeHtml(feature.label)}</span>
      </div>
      <div>
        <div class="eyebrow"><span style="color:var(--c-signal);">${escapeHtml(feature.category)}</span> / ${escapeHtml(feature.readTime)}</div>
        <h2>${escapeHtml(feature.title)}</h2>
        <p>${excerpt(feature)}</p>
        <span class="btn btn--solid-ink">\uC804\uBB38 \uC77D\uAE30 <span class="btn__arrow"></span></span>
      </div>
    </a>
  </section>\n` : '';

  const cardBlocks = cards.map((entry) => `        <a href="/journal/${entry.slug}.html" class="content-card">
          <div class="content-card__media" style="background-image:url('${entry.hero}');"><span class="content-card__tag">Journal / ${escapeHtml(entry.label)}</span></div>
          <div class="content-card__body">
            <div class="content-card__meta"><em>${escapeHtml(entry.category)}</em><span>/ ${escapeHtml(entry.readTime)}</span></div>
            <h3 class="content-card__title">${escapeHtml(entry.title)}</h3>
            <p class="content-card__excerpt">${excerpt(entry)}</p>
          </div>
        </a>`).join('\n');

  const pickBlocks = picks.map((entry, idx) => `          <li><span>${String(idx + 1).padStart(2, '0')}</span><a href="/journal/${entry.slug}.html"><small>${escapeHtml(entry.category)}</small><strong>${escapeHtml(entry.title)}.</strong></a></li>`).join('\n');

  const filterBlocks = ['All', ...categories]
    .map((name, idx) => `      <a${idx === 0 ? ' class="is-active"' : ''} href="/journal/index.html">${escapeHtml(name)}</a>`)
    .join('\n');

  return `<!--@layout(/layout/basic/layout.html)-->
<main class="onroad-page journal-page">
  <section class="jr-masthead" data-header-light>
    <div class="jr-masthead__inner">
      <div>
        <div class="eyebrow">Running Journal / Vol. 01 / ${escapeHtml(latestYear)}</div>
        <h1>\uB7EC\uB108\uC758 <span class="italic">\uAE30\uB85D</span>,<br><span class="italic">\uD68C\uBCF5</span>, \uADF8\uB9AC\uACE0 \uB2E4\uC74C \uAC78\uC74C.</h1>
      </div>
      <aside class="jr-editor-note">
        <b>[ Editor's Note ]</b>
        <p>\uB9E4\uC8FC \uAE08\uC694\uC77C \uBC1C\uAC04.<br>\uB7EC\uB2DD \uD504\uB85C\uD1A0\uCF5C\uC5D0\uC11C \uC801\uC5B4 \uBCF4\uB0B4\uB294<br>\uB7EC\uB108\uB97C \uC704\uD55C \uD78C\uD2B8.</p>
        <small>${entries.length} entries / ${escapeHtml(latestYear)}</small>
      </aside>
    </div>
    <div class="jr-filter" aria-label="Journal categories">
${filterBlocks}
    </div>
  </section>

${featureBlock}
  <section class="jr-grid-section" data-header-light>
    <div class="jr-layout">
      <div class="jr-cards">
${cardBlocks}
      </div>

      <aside class="jr-sidebar">
        <div class="eyebrow">Editor's Pick</div>
        <ol class="jr-pick-list">
${pickBlocks}
        </ol>

        <div class="jr-newsletter">
          <div class="eyebrow eyebrow--light">Newsletter</div>
          <h3>\uB9E4\uC8FC \uAE08\uC694\uC77C,<br>\uBC1B\uC544\uBCF4\uB294 <span class="italic">\uB7EC\uB2DD \uD78C\uD2B8</span>.</h3>
          <p>\uAD11\uACE0 \uC5C6\uC774 \uB7EC\uB108\uC5D0\uAC8C \uD544\uC694\uD55C \uB178\uD2B8\uB9CC \uC804\uD569\uB2C8\uB2E4.</p>
          <form><input placeholder="you@email.com" aria-label="Email"><button type="submit">OK</button></form>
        </div>
      </aside>
    </div>
  </section>
</main>
`;
}

function updateJournalIndex({ args }) {
  if (!args.writeCafe24) return null;
  const journalDir = path.resolve('cafe24', 'journal');
  const indexPath = path.join(journalDir, 'index.html');
  if (!fssync.existsSync(indexPath)) return null;
  const entries = collectJournalEntries(journalDir);
  if (!entries.length) return null;
  fssync.writeFileSync(indexPath, renderJournalIndex(entries), 'utf8');
  return indexPath;
}

function runRegulationCheck(mdPath, checkerPath) {
  const python = process.platform === 'win32' ? 'python' : 'python3';
  const result = spawnSync(python, [checkerPath, mdPath], { encoding: 'utf8' });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) throw new Error(`regulation_check failed with exit code ${result.status}`);
}

function resolveImageSource(image, inputPath, args) {
  return image.originalSrc.startsWith('/assets/')
    ? path.resolve(args.automationRoot, image.originalSrc.slice(1))
    : path.resolve(path.dirname(inputPath), image.originalSrc);
}

function findMissingAssets(images, inputPath, args) {
  if (!args.writeCafe24) return [];
  return images
    .map((image) => resolveImageSource(image, inputPath, args))
    .filter((source) => !fssync.existsSync(source));
}

async function copyAssets(images, inputPath, args) {
  const copied = [];
  const missing = findMissingAssets(images, inputPath, args);
  if (!args.writeCafe24) return { copied, missing };
  if (missing.length && !args.allowMissingAssets) throw new Error(`Missing image assets:\n${missing.map((item) => `- ${item}`).join('\n')}`);
  const targetDir = path.resolve('cafe24', 'SkinImg', 'img', 'journal', args.slug);
  await fs.mkdir(targetDir, { recursive: true });
  for (const image of images) {
    const source = resolveImageSource(image, inputPath, args);
    if (!fssync.existsSync(source)) continue;
    const target = path.join(targetDir, path.basename(image.originalSrc));
    await fs.copyFile(source, target);
    copied.push(target);
  }
  return { copied, missing };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = path.resolve(args.input);
  if (!fssync.existsSync(inputPath)) throw new Error(`Input not found: ${inputPath}`);
  if (!args.noRegulationCheck) runRegulationCheck(inputPath, args.regulation);

  const raw = await fs.readFile(inputPath, 'utf8');
  const { meta, body: withTitle } = splitFrontmatter(raw);
  const { title: h1Title, body } = stripTitle(withTitle);
  const title = h1Title || meta.title || args.slug;
  const { articleHtml, images } = markdownToHtml(body, args.slug);
  const html = renderPage({ title, deck: plainDeck(body), articleHtml, heroImage: images[0]?.src || '', args, meta });

  const outputPath = args.writeCafe24
    ? path.resolve('cafe24', 'journal', `${args.slug}.html`)
    : path.join(path.resolve(args.outDir || path.join('tmp', 'journal-build', args.slug)), `${args.slug}.html`);
  const missingBeforeWrite = findMissingAssets(images, inputPath, args);
  if (missingBeforeWrite.length && !args.allowMissingAssets) {
    throw new Error(`Missing image assets:\n${missingBeforeWrite.map((item) => `- ${item}`).join('\n')}`);
  }
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const assetResult = await copyAssets(images, inputPath, args);
  await fs.writeFile(outputPath, html, 'utf8');
  const indexPath = updateJournalIndex({ args });

  console.log(JSON.stringify({
    ok: true,
    output: path.relative(process.cwd(), outputPath),
    index: indexPath ? path.relative(process.cwd(), indexPath) : null,
    mode: args.writeCafe24 ? 'cafe24-write' : 'dry-run',
    imagesReferenced: images.length,
    imagesCopied: assetResult.copied.length,
    missingImages: assetResult.missing,
  }, null, 2));
}

main().catch((error) => {
  console.error(`[build-journal-cafe24] ${error.message}`);
  process.exit(1);
});

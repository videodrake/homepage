#!/usr/bin/env node
import fs from 'node:fs/promises';
import fssync from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const DEFAULT_REGULATION_CHECK = path.resolve('tools', 'regulation_check.py');
const DEFAULT_AUTOMATION_ROOT = process.cwd();
const DEFAULT_PUBLISHED_DIR = path.join(DEFAULT_AUTOMATION_ROOT, 'content', 'published');
const DEFAULT_LEDGER = path.join(DEFAULT_AUTOMATION_ROOT, 'content', 'CONTENT_STATE.md');
const DEFAULT_SKIN_DIR = path.resolve('skin9');
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
  const args = { input: null, writeCafe24: false, allowMissingAssets: false, regulation: DEFAULT_REGULATION_CHECK, automationRoot: DEFAULT_AUTOMATION_ROOT, siteUrl: 'https://zenera.kr', skinDir: DEFAULT_SKIN_DIR };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!args.input && !arg.startsWith('--')) { args.input = arg; continue; }
    if (arg === '--help' || arg === '-h') usage(0);
    if (arg === '--latest') { args.latest = true; continue; }
    if (arg === '--write-cafe24') { args.writeCafe24 = true; continue; }
    if (arg === '--allow-missing-assets') { args.allowMissingAssets = true; continue; }
    if (arg === '--no-regulation-check') { args.noRegulationCheck = true; continue; }
    const valueFlags = new Set(['--slug', '--out-dir', '--regulation-check', '--automation-root', '--published-dir', '--skin-dir', '--date', '--category', '--number', '--author', '--read-time', '--site-url']);
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
  args.skinDir = path.resolve(args.skinDir);
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
  out = out.replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^)\s]+)\)/g, (_match, label, href) => {
    const external = href.startsWith('http');
    return `<a href="${href}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${label}</a>`;
  });
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
  let listTag = 'ul';
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
    html.push(`<${listTag} class="jp-list">`);
    for (const item of list) html.push(`<li>${inlineMarkdown(item)}</li>`);
    html.push(`</${listTag}>`);
    list = [];
    listTag = 'ul';
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
    if (/^-\s+/.test(line)) {
      flushParagraph(); flushBlockquote(); flushTable();
      if (list.length && listTag !== 'ul') flushList();
      listTag = 'ul';
      list.push(line.replace(/^-\s+/, '').trim());
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      flushParagraph(); flushBlockquote(); flushTable();
      if (list.length && listTag !== 'ol') flushList();
      listTag = 'ol';
      list.push(line.replace(/^\d+\.\s+/, '').trim());
      continue;
    }
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

function plainMarkdown(value = '') {
  return String(value)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`>#]/g, '')
    .replace(/^\s*[-+]\s+/, '')
    .replace(/^\s*\d+\.\s+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFaqItems(body) {
  const lines = body.split(/\r?\n/);
  const items = [];
  let inFaq = false;
  let question = '';
  let answer = [];

  const flush = () => {
    const name = plainMarkdown(question);
    const text = plainMarkdown(answer.join(' '));
    if (name && text) items.push({ name, text });
    question = '';
    answer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (/^##\s+/.test(line)) {
      if (inFaq) {
        flush();
        break;
      }
      inFaq = plainMarkdown(line.replace(/^##\s+/, '')) === '자주 묻는 질문';
      continue;
    }
    if (!inFaq) continue;
    if (/^###\s+/.test(line)) {
      flush();
      question = line.replace(/^###\s+/, '').trim();
      continue;
    }
    if (!question || !line || line.startsWith('![') || /^[-─]{3,}$/.test(line)) continue;
    answer.push(line);
  }
  if (inFaq) flush();
  return items;
}

function renderPage({ title, deck, articleHtml, heroImage, faqItems, args, meta = {} }) {
  const category = args.category || meta.category || '러닝 과학';
  const number = args.number || args.slug;
  const date = args.date || normalizeDate(meta.date_drafted) || todayKst();
  const modifiedDate = normalizeDate(meta.date_modified) || date;
  const readTime = args.readTime || meta.read_time || '7분 읽기';
  const structuredData = renderStructuredData({ title, deck, heroImage, faqItems, args, date, modifiedDate });
  return `<!--@layout(/layout/basic/layout.html)-->
<!--@css(/layout/basic/css/onroad-v4-journal.css)-->
<!--@js(/layout/basic/js/onroad-v4-journal.js)-->
<main class="onroad-page jv4-post" data-seo-title="${escapeHtml(title)} | 온로드 러닝 노트" data-seo-description="${escapeHtml(deck)}" data-seo-canonical="${escapeHtml(absoluteUrl(args.siteUrl, `/journal/${args.slug}.html`))}">
  ${structuredData}
  <div class="jv4-progress" data-reading-progress aria-hidden="true"></div>
  <header class="jv4-post-hero">
    <div class="jv4-post-hero__blue" aria-hidden="true"></div>
    <div class="jv4-post-hero__inner">
      <nav class="jv4-breadcrumb" aria-label="현재 위치"><a href="/">홈</a><span>/</span><a href="/journal/index.html">러닝 노트</a><span>/</span><span>${escapeHtml(category)}</span></nav>
      <div class="jv4-post-hero__meta"><span>${escapeHtml(category)}</span><span>${escapeHtml(number)}</span><span>${escapeHtml(date)}</span><span>${escapeHtml(readTime)}</span></div>
      <h1>${inlineMarkdown(title)}</h1>
      <p class="jv4-post-hero__deck">${escapeHtml(deck)}</p>
      <div class="jv4-post-tools"><button class="jv4-share" type="button" data-journal-share>글 공유하기</button></div>
    </div>
  </header>

  <section class="jv4-post-body">
    <div class="jv4-post-layout">
      <aside class="jv4-toc" aria-label="글 목차"><strong>CONTENTS</strong><nav data-journal-toc></nav></aside>
      <article class="jv4-reading" data-journal-article>
        ${articleHtml}
        <aside class="jv4-post-bridge" aria-label="온로드 지구력코어 안내">
          <p class="jv4-eyebrow">FROM READING TO ROUTINE</p>
          <h2>지구력 관리,<br><em>이제 일상에서부터.</em></h2>
          <p>온로드 지구력코어는 달리는 사람이 평소 하루 1정으로 챙기는 지구력 관리 건강기능식품입니다.</p>
          <ul class="jv4-post-bridge__proof"><li>옥타코사놀 40mg 함유</li><li>지구력 증진에 도움을 줄 수 있음</li><li>비타민B군 기능성 원료 5종</li><li>하루 1정 · 60정</li></ul>
          <a class="jv4-button jv4-button--orange" href="/product/detail.html?product_no=11">제품 기준 확인하기 →</a>
          <small>이 글의 일반 러닝 정보는 제품의 기능성이나 개인의 운동 성과를 의미하지 않습니다.</small>
        </aside>
      </article>
    </div>
  </section>
  <nav class="jv4-post-nav" aria-label="러닝 노트 탐색"><div class="jv4-post-nav__inner"><a href="/journal/index.html">← 러닝 노트 전체 보기</a><a href="/product/detail.html?product_no=11">지구력코어 확인하기 →</a></div></nav>
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

function renderStructuredData({ title, deck, heroImage, faqItems = [], args, date, modifiedDate }) {
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
    dateModified: modifiedDate.replace(/\s*\/\s*/g, '-'),
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
  const scripts = [`<script type="application/ld+json">${JSON.stringify(data).replaceAll('<', '\\u003c')}</script>`];
  if (faqItems.length) {
    const faqData = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqItems.map((item) => ({
        '@type': 'Question',
        name: item.name,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.text,
        },
      })),
    };
    scripts.push(`<script type="application/ld+json">${JSON.stringify(faqData).replaceAll('<', '\\u003c')}</script>`);
  }
  return scripts.join('\n  ');
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
      const deckRaw = (html.match(/<p class="(?:jv4-post-hero__deck|jp-deck)">([\s\S]*?)<\/p>/) || [])[1] || '';
      const deck = decodeEntities(deckRaw.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
      const postMeta = (html.match(/<div class="jv4-post-hero__meta">([\s\S]*?)<\/div>/) || [])[1] || '';
      const metaParts = [...postMeta.matchAll(/<span>([\s\S]*?)<\/span>/g)].map((match) => decodeEntities(match[1].replace(/<[^>]+>/g, '')).trim());
      const eyebrow = metaParts[0] || (html.match(/<div class="eyebrow">([^<]*?)\s*\//) || [])[1] || '러닝 과학';
      const date = (html.match(/"datePublished":"([^"]+)"/) || [])[1] || '';
      const articleText = ((html.match(/<article[^>]*>([\s\S]*?)<\/article>/) || [])[1] || '').replace(/<[^>]+>/g, '');
      const searchTerms = [...html.matchAll(/<h[23]>([\s\S]*?)<\/h[23]>/g)]
        .map((match) => decodeEntities(match[1].replace(/<[^>]+>/g, '')).trim())
        .filter(Boolean)
        .join(' ');
      const minutes = Math.max(3, Math.round(articleText.replace(/\s+/g, '').length / 600));
      return {
        slug,
        title: headline.trim() || fullTitle,
        subtitle: rest.join(' \u2014 ').trim(),
        fullTitle,
        deck,
        category: eyebrow.trim() || 'Pace Science',
        date,
        readTime: metaParts[3] || `${minutes}분 읽기`,
        hero: `/SkinImg/img/journal/${slug}/img-1.png`,
        label: slug.replace(/^journal-/, '').toUpperCase(),
        searchTerms,
      };
    })
    .sort((a, b) => a.slug.localeCompare(b.slug, undefined, { numeric: true }));
}

function renderJournalIndex(entries) {
  const ordered = [...entries].reverse();
  const categories = [...new Set(entries.map((entry) => entry.category))];
  const excerpt = (entry) => escapeHtml(entry.subtitle ? truncateText(entry.subtitle, 90) : truncateText(entry.deck, 90));
  const filterBlocks = ['전체', ...categories]
    .map((name, idx) => `          <button class="jv4-filter${idx === 0 ? ' is-active' : ''}" type="button" data-journal-filter="${escapeHtml(name)}" aria-pressed="${idx === 0 ? 'true' : 'false'}">${escapeHtml(name)}</button>`)
    .join('\n');

  const cardBlocks = ordered.map((entry, index) => `        <a class="jv4-card${index === 0 ? ' jv4-card--featured' : ''}" href="/journal/${entry.slug}.html" data-journal-card data-category="${escapeHtml(entry.category)}" data-keywords="${escapeHtml(`${entry.fullTitle} ${entry.deck} ${entry.category} ${entry.searchTerms}`)}">
          <div class="jv4-card__body">${index === 0 ? '<span class="jv4-card__featured-label">이번 주 질문</span>' : ''}<div class="jv4-card__meta"><span>${escapeHtml(entry.category)}</span><span>${escapeHtml(entry.date || 'ONROAD NOTE')} · ${escapeHtml(entry.readTime)}</span></div><span class="jv4-card__question" aria-hidden="true">Q.</span><h3>${escapeHtml(entry.fullTitle)}</h3><p>${excerpt(entry)}</p><span class="jv4-card__read">답 확인하기 →</span></div>
          <div class="jv4-card__media" aria-hidden="true"><img src="${escapeHtml(entry.hero)}" alt="" loading="lazy"></div>
        </a>`).join('\n');

  const collectionData = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: '온로드 러닝 노트',
    description: '마라톤 보급, 테이퍼링, 대회 준비, 여름 러닝처럼 러너가 실제로 겪는 문제에 답하는 온로드 러닝 가이드',
    url: 'https://zenera.kr/journal/index.html',
    mainEntity: ordered.map((entry) => ({ '@type': 'Article', headline: entry.fullTitle, url: `https://zenera.kr/journal/${entry.slug}.html` })),
  };

  return `<!--@layout(/layout/basic/layout.html)-->
<!--@css(/layout/basic/css/onroad-v4-journal.css)-->
<!--@js(/layout/basic/js/onroad-v4-journal.js)-->
<main class="onroad-page jv4-index" data-seo-title="온로드 러닝 노트 | 러너의 실제 질문에 답합니다" data-seo-description="마라톤 보급, 테이퍼링, 대회 준비, 여름 러닝처럼 러너가 실제로 겪는 문제에 답하는 온로드 러닝 가이드" data-seo-canonical="https://zenera.kr/journal/index.html">
  <script type="application/ld+json">${JSON.stringify(collectionData).replaceAll('<', '\\u003c')}</script>
  <section class="jv4-index-hero">
    <div class="jv4-shell jv4-index-hero__grid"><div><p class="jv4-eyebrow jv4-eyebrow--light">ONROAD RUNNING NOTE</p><h1><span>러닝 질문,</span><span><em>답부터</em> 확인하세요.</span></h1></div><aside class="jv4-index-hero__aside"><p>마라톤 보급, 테이퍼링, 대회 전 준비, 여름 심박처럼 러너가 실제로 겪는 문제를 근거와 체크리스트로 정리합니다.</p><div class="jv4-index-hero__stats"><div><strong>${entries.length}</strong><span>PUBLISHED NOTES</span></div><div><strong>${categories.length}</strong><span>RUNNING TOPICS</span></div></div></aside></div>
  </section>

  <section class="jv4-discovery" aria-label="러닝 노트 검색"><div class="jv4-shell jv4-discovery__panel"><label class="jv4-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="m20 20-4-4"></path></svg><input type="search" data-journal-search placeholder="예: 마라톤 30km, 테이퍼링, 여름 러닝" aria-label="러닝 노트 검색"></label><div class="jv4-filters" aria-label="주제별 보기">
${filterBlocks}
        </div></div></section>

  <section class="jv4-paths"><div class="jv4-shell"><div class="jv4-section-head"><div><p class="jv4-eyebrow">START WITH YOUR QUESTION</p><h2>지금 궁금한 것부터<br><em>바로 확인하세요.</em></h2></div><p>길게 돌려 말하지 않고, 러너가 실제로 겪는 상황에 먼저 답합니다.</p></div><div class="jv4-path-grid">
    <button class="jv4-path-card" type="button" data-journal-filter="마라톤 준비" data-journal-path><span>01 / MARATHON</span><h3>젤을 언제 먹어야 할까?</h3><p>예상 완주 시간으로 보급 간격을 계산합니다.</p><strong>마라톤 준비 답변 보기 →</strong></button>
    <button class="jv4-path-card" type="button" data-journal-filter="훈련 루틴" data-journal-path><span>02 / TRAINING</span><h3>2주 전, 얼마나 줄일까?</h3><p>테이퍼링 기간과 훈련량 조절을 정리합니다.</p><strong>훈련 루틴 답변 보기 →</strong></button>
    <button class="jv4-path-card" type="button" data-journal-filter="계절 러닝" data-journal-path><span>03 / SEASON</span><h3>여름엔 왜 심박이 높을까?</h3><p>기온, 습도, 페이스와 수분을 함께 봅니다.</p><strong>계절 러닝 답변 보기 →</strong></button>
    <button class="jv4-path-card" type="button" data-journal-filter="러닝 과학" data-journal-path><span>04 / SCIENCE</span><h3>30km부터 왜 무거울까?</h3><p>페이스·보급·날씨·훈련을 차례로 확인합니다.</p><strong>러닝 과학 답변 보기 →</strong></button>
  </div></div></section>

  <section class="jv4-library" id="journalLibrary"><div class="jv4-shell"><div class="jv4-library__bar"><div><p class="jv4-eyebrow">CHOOSE YOUR QUESTION</p><h2>지금 해결하고 싶은<br><em>질문을 골라보세요.</em></h2></div><span class="jv4-result" data-journal-count>${entries.length}개의 질문</span></div><div class="jv4-card-grid">
${cardBlocks}
      </div><p class="jv4-empty" data-journal-empty>검색 결과가 없습니다. 다른 키워드나 주제를 선택해 주세요.</p></div></section>

  <section class="jv4-product-bridge"><div class="jv4-shell jv4-product-bridge__grid"><div class="jv4-product-bridge__copy"><p class="jv4-eyebrow jv4-eyebrow--light">READ. RUN. REPEAT.</p><h2>읽는 데서 끝나지 않게.<br><em>지구력 관리, 이제 일상에서부터.</em></h2><p>온로드 지구력코어는 달리는 사람이 평소 하루 1정으로 챙기는 지구력 관리 건강기능식품입니다.</p><div class="jv4-product-bridge__facts"><span>옥타코사놀 40mg</span><span>비타민B군 기능성 원료 5종</span><span>하루 1정 · 60정</span></div></div><aside class="jv4-product-bridge__card"><span>ENDURANCE CORE</span><h3>러너의 매일 관리 루틴</h3><p>옥타코사놀은 지구력 증진에 도움을 줄 수 있습니다.</p><a class="jv4-button jv4-button--orange" href="/product/detail.html?product_no=11">제품 기준 확인하기 →</a><small>콘텐츠의 일반 러닝 정보는 제품의 기능성이나 개인의 운동 성과를 의미하지 않습니다.</small></aside></div></section>
</main>
`;
}

function updateJournalIndex({ args }) {
  if (!args.writeCafe24) return null;
  const journalDir = path.join(args.skinDir, 'journal');
  const indexPath = path.join(journalDir, 'index.html');
  if (!fssync.existsSync(indexPath)) return null;
  const entries = collectJournalEntries(journalDir);
  if (!entries.length) return null;
  fssync.writeFileSync(indexPath, renderJournalIndex(entries), 'utf8');
  return indexPath;
}

function updateSitemap({ args }) {
  if (!args.writeCafe24) return null;
  const journalDir = path.join(args.skinDir, 'journal');
  if (!fssync.existsSync(journalDir)) return null;
  const entries = collectJournalEntries(journalDir);
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
  const staticUrls = [
    '/',
    '/product/detail.html?product_no=11',
    '/shopinfo/ingredient-science.html',
    '/shopinfo/intake-guide.html',
    '/journal/index.html',
    '/shopinfo/company.html',
  ];
  const rows = staticUrls.map((pathname) => ({ pathname, date: today }))
    .concat(entries.map((entry) => ({ pathname: `/journal/${entry.slug}.html`, date: entry.date || today })));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.map((row) => `  <url>\n    <loc>${escapeHtml(absoluteUrl(args.siteUrl, row.pathname))}</loc>\n    <lastmod>${escapeHtml(row.date)}</lastmod>\n  </url>`).join('\n')}\n</urlset>\n`;
  const sitemapPath = path.join(args.skinDir, 'sitemap.xml');
  fssync.writeFileSync(sitemapPath, xml, 'utf8');
  return sitemapPath;
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
  const targetDir = path.join(args.skinDir, 'SkinImg', 'img', 'journal', args.slug);
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
  const deck = meta.meta_description || meta.description || plainDeck(body);
  const faqItems = extractFaqItems(body);
  const html = renderPage({ title, deck, articleHtml, heroImage: images[0]?.src || '', faqItems, args, meta });

  const outputPath = args.writeCafe24
    ? path.join(args.skinDir, 'journal', `${args.slug}.html`)
    : path.join(path.resolve(args.outDir || path.join('tmp', 'journal-build', args.slug)), `${args.slug}.html`);
  const missingBeforeWrite = findMissingAssets(images, inputPath, args);
  if (missingBeforeWrite.length && !args.allowMissingAssets) {
    throw new Error(`Missing image assets:\n${missingBeforeWrite.map((item) => `- ${item}`).join('\n')}`);
  }
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const assetResult = await copyAssets(images, inputPath, args);
  await fs.writeFile(outputPath, html, 'utf8');
  const indexPath = updateJournalIndex({ args });
  const sitemapPath = updateSitemap({ args });

  console.log(JSON.stringify({
    ok: true,
    output: path.relative(process.cwd(), outputPath),
    index: indexPath ? path.relative(process.cwd(), indexPath) : null,
    sitemap: sitemapPath ? path.relative(process.cwd(), sitemapPath) : null,
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

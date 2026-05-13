#!/usr/bin/env node
import fssync from 'node:fs';
import path from 'node:path';

function usage(exitCode = 0) {
  console.log(`Usage: node tools/validate-journal-content.mjs <markdown.md> [options]

Options:
  --type draft|published       Validation mode. Default: infer from path.
  --slug <slug>                Expected slug. Default: markdown filename.
  --assets-root <dir>          Assets root. Default: assets
`);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = { input: null, assetsRoot: 'assets' };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!args.input && !arg.startsWith('--')) {
      args.input = arg;
      continue;
    }
    if (arg === '--help' || arg === '-h') usage(0);
    if (['--type', '--slug', '--assets-root'].includes(arg)) {
      const value = argv[i + 1];
      if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      i += 1;
      if (arg === '--assets-root') args.assetsRoot = value;
      else args[arg.slice(2)] = value;
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }
  if (!args.input) usage(1);
  args.input = path.resolve(args.input);
  args.slug ||= path.basename(args.input).replace(/\.md$/i, '');
  args.type ||= args.input.includes(`${path.sep}published${path.sep}`) ? 'published' : 'draft';
  if (!['draft', 'published'].includes(args.type)) throw new Error(`Invalid --type: ${args.type}`);
  return args;
}

function frontmatter(raw) {
  if (raw.charCodeAt(0) === 0xfeff) {
    return { error: 'File starts with UTF-8 BOM. Save as UTF-8 without BOM.' };
  }
  if (!raw.startsWith('---\n') && !raw.startsWith('---\r\n')) {
    return { error: 'File must start with YAML frontmatter. Remove handoff notes before ---.' };
  }
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { error: 'YAML frontmatter is not closed with ---.' };
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const item = line.match(/^([^:#]+):\s*(.*)$/);
    if (item) meta[item[1].trim()] = item[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return { meta, body: raw.slice(match[0].length), frontmatterText: match[1] };
}

function collectImageMarkers(raw) {
  const markerLines = [];
  const specLines = [];
  const suspicious = [];
  raw.split(/\r?\n/).forEach((line, index) => {
    const lineNo = index + 1;
    if (/^\[IMG-\d+:\s*.+\]$/.test(line.trim())) markerLines.push({ lineNo, line: line.trim() });
    if (/^###\s+IMG-\d+\b/.test(line.trim())) specLines.push({ lineNo, line: line.trim() });
    if (/\[IMG-\d+/.test(line) && !/^\[IMG-\d+:\s*.+\]$/.test(line.trim())) {
      suspicious.push({ lineNo, line: line.trim() });
    }
  });
  return { markerLines, specLines, suspicious };
}

function uniqueNumbers(lines, pattern) {
  return lines.map(({ line }) => Number(line.match(pattern)?.[1])).filter(Number.isInteger);
}

function parseImageCount(meta) {
  const count = Number(String(meta.image_count || '').match(/\d+/)?.[0] || 0);
  return Number.isInteger(count) ? count : 0;
}

function validateDraft(raw, meta) {
  const errors = [];
  const { markerLines, specLines, suspicious } = collectImageMarkers(raw);
  const markers = uniqueNumbers(markerLines, /^\[IMG-(\d+):/);
  const specs = uniqueNumbers(specLines, /^###\s+IMG-(\d+)\b/);
  const imageCount = parseImageCount(meta);

  if (markers.length < 5 || markers.length > 8) errors.push(`Draft must contain 5-8 standalone image markers, found ${markers.length}.`);
  if (imageCount && imageCount !== markers.length) errors.push(`frontmatter image_count=${imageCount} but marker count=${markers.length}.`);
  if (markers.join(',') !== specs.join(',')) errors.push(`Image marker/spec mismatch. markers=[${markers.join(',')}] specs=[${specs.join(',')}]`);
  if (suspicious.length) {
    errors.push(`Suspicious IMG references outside standalone marker lines: ${suspicious.map((item) => `line ${item.lineNo}`).join(', ')}.`);
  }
  if (/^##\s*검증 리포트\b/m.test(raw) || /^##\s*자가 검증\b/m.test(raw)) {
    errors.push('Remove validation report sections before saving to content/draft. They can confuse image parsing.');
  }
  if (/선정 이유|Project Knowledge 로그 기준|인계 메모/.test(raw.slice(0, 1000))) {
    errors.push('Remove handoff/selection notes from the saved markdown body.');
  }
  return errors;
}

function validatePublished(raw, meta, args) {
  const errors = [];
  const imageCount = parseImageCount(meta);
  const imageLinks = [...raw.matchAll(/^!\[[^\]]*]\(([^)]+)\)$/gm)].map((match) => match[1]);
  if (/\[IMG-\d+/.test(raw)) errors.push('Published markdown must contain rendered image markdown, not [IMG-N] markers.');
  if (/^##\s*이미지 명세\b/m.test(raw) || /^###\s+IMG-\d+\b/m.test(raw)) errors.push('Published markdown must not contain the image specification section.');
  if (/^##\s*검증 리포트\b/m.test(raw) || /^##\s*자가 검증\b/m.test(raw)) errors.push('Published markdown must not contain validation report sections.');
  if (imageCount && imageLinks.length !== imageCount) errors.push(`frontmatter image_count=${imageCount} but rendered images=${imageLinks.length}.`);
  if (imageLinks.length < 5) errors.push(`Published markdown must contain at least 5 rendered images, found ${imageLinks.length}.`);
  for (const link of imageLinks) {
    if (!link.startsWith(`/assets/${args.slug}/`)) {
      errors.push(`Image path must start with /assets/${args.slug}/: ${link}`);
      continue;
    }
    const assetPath = path.resolve(args.assetsRoot, args.slug, path.posix.basename(link));
    if (!fssync.existsSync(assetPath)) errors.push(`Missing asset file: ${assetPath}`);
  }
  return errors;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!fssync.existsSync(args.input)) throw new Error(`Input not found: ${args.input}`);
  const raw = fssync.readFileSync(args.input, 'utf8');
  const parsed = frontmatter(raw);
  const errors = [];
  if (parsed.error) errors.push(parsed.error);
  else if (args.type === 'draft') errors.push(...validateDraft(raw, parsed.meta));
  else errors.push(...validatePublished(raw, parsed.meta, args));

  const report = {
    ok: errors.length === 0,
    type: args.type,
    file: path.relative(process.cwd(), args.input),
    slug: args.slug,
    errors,
  };
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) process.exit(1);
}

main();

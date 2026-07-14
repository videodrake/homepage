#!/usr/bin/env node
import http from 'node:http';
import fssync from 'node:fs';
import path from 'node:path';

const skinDir = path.resolve(process.argv[2] || 'skin9');
const port = Number(process.argv[3] || 4173);

const types = {
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
};

function insideSkin(requestPath) {
  const decoded = decodeURIComponent(requestPath.split('?')[0]);
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const resolved = path.resolve(skinDir, relative);
  return resolved === skinDir || resolved.startsWith(`${skinDir}${path.sep}`) ? resolved : null;
}

function readImport(importPath) {
  const file = insideSkin(importPath);
  if (!file || !fssync.existsSync(file)) return '';
  return fssync.readFileSync(file, 'utf8');
}

function expandImports(html) {
  let output = html;
  for (let i = 0; i < 8; i += 1) {
    const next = output.replace(/<!--@import\(([^)]+)\)-->/g, (_, importPath) => readImport(importPath));
    if (next === output) break;
    output = next;
  }
  return output;
}

function expandDirectives(html) {
  const output = html
    .replace(/<!--@css\(([^)]+)\)-->/g, '<link rel="stylesheet" href="$1">')
    .replace(/<!--@js\(([^)]+)\)-->/g, (_, scriptPath) => /onroad-(?:v2|v4-journal)\.js$/.test(scriptPath) ? `<script src="${scriptPath}" defer></script>` : '')
    .replace(/<!--#ez="[^"]*"-->/g, '');
  return output.replace('</head>', '<style>[module="Layout_multishopShipping"],#progressPaybar,#layoutDimmed,.layer_shadow,.RTMB{display:none!important}</style></head>');
}

function renderPage(pagePath) {
  const page = fssync.readFileSync(pagePath, 'utf8').replace(/^\uFEFF/, '');
  const layoutMatch = page.match(/<!--@layout\(([^)]+)\)-->/);
  if (!layoutMatch) return expandDirectives(expandImports(page));
  const body = page.replace(layoutMatch[0], '');
  const layoutPath = insideSkin(layoutMatch[1]);
  if (!layoutPath || !fssync.existsSync(layoutPath)) return expandDirectives(expandImports(body));
  const layout = fssync.readFileSync(layoutPath, 'utf8');
  return expandDirectives(expandImports(layout.replace('<!--@contents-->', body)));
}

const server = http.createServer((req, res) => {
  try {
    const target = insideSkin(req.url || '/');
    if (!target || !fssync.existsSync(target) || fssync.statSync(target).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    const ext = path.extname(target).toLowerCase();
    const content = ext === '.html' ? renderPage(target) : fssync.readFileSync(target);
    res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(content);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(error.stack || error.message);
  }
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Cafe24 skin preview: http://127.0.0.1:${port}/journal/index.html`);
});

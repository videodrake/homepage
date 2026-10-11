import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';

// Guard the existing commerce bindings while replacing presentation around them.
const base = process.argv[2] || '831ba1bd66b1e7cc572093b789e8015a83ce1af9';
const files = ['cafe24/index.html','cafe24/layout/basic/header.html','cafe24/product/detail.html'];
const extract = (source, pattern) => Array.from(source.matchAll(pattern), m => m[0]).sort();
for (const file of files) {
  const before = execFileSync('git',['show',`${base}:${file}`],{encoding:'utf8'});
  const after = fs.readFileSync(file,'utf8');
  for (const [name,pattern] of Object.entries({variables:/\{\$[^}]+\}/g,modules:/\bmodule="[^"]+"/g,directives:/<!--@[^>]+-->/g,actions:/\bonclick="[^"]*"/g})) {
    assert.deepEqual(extract(after,pattern),extract(before,pattern),`${file}: ${name} changed`);
  }
  assert.equal(after.split('\n')[0].replace(/\r$/,''),before.split('\n')[0].replace(/\r$/,''),`${file}: layout moved`);
}
const parts=['docs/redesign-global.css','docs/ux-editorial.css','docs/redesign-product.css'];
const expected=parts.map(file=>fs.readFileSync(file,'utf8').trim()).join('\n\n')+'\n';
const compiled=fs.readFileSync('cafe24/layout/basic/css/onroad.css','utf8');
assert.equal(compiled,expected,'Generated stylesheet is stale');
const css=compiled.replace(/\/\*[\s\S]*?\*\//g,'');
assert.equal((css.match(/\{/g)||[]).length,(css.match(/\}/g)||[]).length,'CSS braces unbalanced');
for (const file of files) {
  const html=fs.readFileSync(file,'utf8');
  assert.ok(!/<!--@css\([^)]*\?/.test(html),'Query string in Cafe24 directive');
  for (const match of html.matchAll(/(?:href|src|srcset)="(\/[^"?#]+)(?:[?#][^"]*)?"/g)) {
    const pathname=match[1];
    if(pathname.includes('{$') || pathname.startsWith('//')) continue;
    assert.ok(fs.existsSync('cafe24'+(pathname==='/'?'/index.html':pathname)),`${file}: missing ${pathname}`);
  }
}
console.log('Passed: native variables, modules, directives and actions preserved; generated CSS consistent; asset and page links exist.');

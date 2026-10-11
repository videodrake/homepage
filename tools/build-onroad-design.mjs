import fs from 'node:fs';
const sources = ['docs/redesign-global.css','docs/ux-editorial.css','docs/redesign-product.css'];
const css = sources.map(file => fs.readFileSync(file,'utf8').replace(/\r\n/g,'\n').trim()).join('\n\n') + '\n';
fs.writeFileSync('cafe24/layout/basic/css/onroad.css',css);
console.log(`Built onroad.css from ${sources.length} maintained sources (${Buffer.byteLength(css)} bytes).`);

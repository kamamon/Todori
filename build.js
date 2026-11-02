// src/ の各ファイルを1つの index.html（リポジトリ直下）にまとめる
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'src');
const js = fs.readdirSync(dir).filter(f => /^\d\d_.*\.js$/.test(f)).sort()
  .map(f => `/* ---- ${f} ---- */\n` + fs.readFileSync(path.join(dir, f), 'utf8').replace(/^'use strict';\n/, '')).join('\n');
const css = fs.readFileSync(path.join(dir, 'style.css'), 'utf8');
const tpl = fs.readFileSync(path.join(dir, 'template.html'), 'utf8');
const out = tpl.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => "'use strict';\n(function () {\n" + js + '\n})();');
fs.writeFileSync(path.join(__dirname, 'index.html'), out);
console.log('index.html', (out.length / 1024).toFixed(0) + ' KB');

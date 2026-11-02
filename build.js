// src/ の各ファイルを1つの index.html（リポジトリ直下）にまとめる
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'src');
const js = fs.readdirSync(dir).filter(f => /^\d\d_.*\.js$/.test(f)).sort()
  .map(f => `/* ---- ${f} ---- */\n` + fs.readFileSync(path.join(dir, f), 'utf8').replace(/^'use strict';\n/, '')).join('\n');
const css = fs.readFileSync(path.join(dir, 'style.css'), 'utf8');
// img/ にある場面の画像（Canvaで生成）を登録する。ファイル名（拡張子なし）がキー
const imgDir = path.join(__dirname, 'img');
const art = {};
if (fs.existsSync(imgDir)) for (const f of fs.readdirSync(imgDir).sort()) { const m = f.match(/^([a-z0-9_-]+)\.(webp|jpe?g|png)$/i); if (m) art[m[1]] = 'img/' + f; }
const artJs = `const ART_FILES = ${JSON.stringify(art)};\n`;
const tpl = fs.readFileSync(path.join(dir, 'template.html'), 'utf8');
const out = tpl.replace('/*__CSS__*/', () => css).replace('/*__JS__*/', () => "'use strict';\n(function () {\n" + artJs + js + '\n})();');
fs.writeFileSync(path.join(__dirname, 'index.html'), out);
console.log('index.html', (out.length / 1024).toFixed(0) + ' KB', '画像', Object.keys(art).length + '枚');

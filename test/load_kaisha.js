// 会社経営モードのエンジン（DOM非依存）を Node の vm で読み込む
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = path.join(__dirname, '..', 'src');
// ビルドと同じ、ファイル名の順。画面（DOM）を使うファイルは除く
const files = fs.readdirSync(src).filter(f => /^(00_util|01_data|01_terms|05_company|20_kaisha_data|20[a-z]_.*|21_kaisha_core|22_kaisha_ind|22[a-z]_.*|26_law_data|27_kaisha_law|29_kaisha_grow|29[a-z]_kaisha_(group|group2|hr|map|law2|evt|startgroup|org))\.js$/.test(f)).filter(f => !(process.env.NOLAW && /law/.test(f))).sort();
function loadKaisha() {
  const ctx = { console, Math, JSON, Date, Object, Array, Number, String, Set, Map, isFinite, isNaN, Infinity, NaN, parseInt, parseFloat, Error };
  vm.createContext(ctx);
  let code = 'var TERM_BY_NAME = {};\n' + files.map(f => fs.readFileSync(path.join(src, f), 'utf8')).join('\n;\n');
  code = code.replace(/^(const|let) /gm, 'var ');
  code += '\n;globalThis.__api = { get G(){return G;}, set G(v){G=v;} };';
  vm.runInContext(code, ctx, { filename: 'kaisha.js' });
  return ctx;
}
module.exports = { loadKaisha };

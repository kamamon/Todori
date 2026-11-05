// 会社経営モードのエンジン（DOM非依存）を Node の vm で読み込む
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const files = ['00_util.js', '01_data.js', '05_company.js', '20_kaisha_data.js', '21_kaisha_core.js', '22_kaisha_ind.js'];
function loadKaisha() {
  const ctx = { console, Math, JSON, Date, Object, Array, Number, String, Set, Map, isFinite, isNaN, Infinity, NaN, parseInt, parseFloat, Error };
  vm.createContext(ctx);
  let code = files.map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n;\n');
  code = code.replace(/^(const|let) /gm, 'var ');
  code += '\n;globalThis.__api = { get G(){return G;}, set G(v){G=v;} };';
  vm.runInContext(code, ctx, { filename: 'kaisha.js' });
  return ctx;
}
module.exports = { loadKaisha };

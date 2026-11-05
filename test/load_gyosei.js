// 行政モードのエンジン（DOM非依存）を Node の vm で読み込む
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const files = ['00_util.js', '01_data.js', '01_terms.js', '26_law_data.js', '30_gyosei_core.js'];
function loadGyosei() {
  const ctx = { console, Math, JSON, Date, Object, Array, Number, String, Set, Map, isFinite, isNaN, Infinity, NaN, parseInt, parseFloat, Error };
  vm.createContext(ctx);
  let code = 'var TERM_BY_NAME = {};\n' + files.map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n;\n');
  code = code.replace(/^(const|let) /gm, 'var ');
  code += '\n;globalThis.__api = { get G(){return G;}, set G(v){G=v;} };';
  vm.runInContext(code, ctx, { filename: 'gyosei.js' });
  return ctx;
}
module.exports = { loadGyosei };

// エンジン部分（DOM非依存）を Node の vm で読み込む
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const files = ['00_util.js', '01_data.js', '02_ledger.js', '03_economy.js', '04_city.js', '05_company.js', '06_loans.js', '07_bank.js', '08_events.js', '09_sim.js'];
function loadEngine() {
  const ctx = { console, Math, JSON, Date, Object, Array, Number, String, Set, Map, isFinite, isNaN, Infinity, NaN, parseInt, parseFloat, Error };
  vm.createContext(ctx);
  let code = files.map(f => fs.readFileSync(path.join(__dirname, '..', 'src', f), 'utf8')).join('\n;\n');
  code = code.replace(/^(const|let) /gm, 'var ');
  // let/const をコンテキスト外から参照できるよう公開
  code += '\n;globalThis.__api = { get G(){return G;}, set G(v){G=v;} };';
  vm.runInContext(code, ctx, { filename: 'engine.js' });
  return ctx;
}
module.exports = { loadEngine };

// 創業記モードのエンジン（DOM非依存）を Node の vm で読み込む
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const src = path.join(__dirname, '..', 'src');
const files = fs.readdirSync(src).filter(f => /^(00_util|4[012][a-z]?_fd_.*)\.js$/.test(f)).sort();
function loadFd() {
  const ctx = { console, Math, JSON, Date, Object, Array, Number, String, Set, Map, isFinite, isNaN, Infinity, NaN, parseInt, parseFloat, Error };
  vm.createContext(ctx);
  let code = files.map(f => fs.readFileSync(path.join(src, f), 'utf8')).join('\n;\n');
  code = code.replace(/^(const|let) /gm, 'var ');
  code += '\n;globalThis.__api = { get G(){return G;}, set G(v){G=v;} };';
  vm.runInContext(code, ctx, { filename: 'fd.js' });
  return ctx;
}
module.exports = { loadFd, files };

// ページ内でランダムにボタンを押す高速スモークテスト
const { chromium } = require('playwright');
const path = require('path');
const url = 'file://' + path.join(__dirname, '..', 'index.html');
const months = +(process.argv[2] || 36), seed = +(process.argv[3] || 1), preset = process.argv[4] || 'standard';
(async () => {
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/fonts|ERR_|net::/.test(m.text())) errors.push('console: ' + m.text()); });
  await page.route('**/fonts.g*/**', r => r.abort());
  await page.goto(url);
  if (preset !== 'standard') await page.click(`[data-act="stPreset"][data-v="${preset}"]`);
  await page.click('[data-act="startGame"]');
  const res = await page.evaluate(async ({ months, seed }) => {
    let s = seed;
    const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
    const skip = /^(newGameGo|newGameConfirm|importSave|exportSave|loadAuto|loadSlot|theme|advance|advanceNow|scrim|go)$/;
    const T = window.Toudori;
    let clicks = 0;
    const integ = [];
    const visible = el => el.offsetParent !== null && !el.disabled;
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    for (let m = 0; m < months; m++) {
      for (let k = 0; k < 60; k++) {
        const els = [...document.querySelectorAll('[data-act]')].filter(el => !skip.test(el.dataset.act) && visible(el));
        if (!els.length) break;
        els[Math.floor(rnd() * els.length)].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        clicks++;
        if (rnd() < 0.2) {
          const ins = [...document.querySelectorAll('input[type="number"][data-in], input[type="number"][data-ch], select[data-ch], input[type="range"][data-ch], input[type="checkbox"][data-ch]')].filter(visible);
          if (ins.length) {
            const el = ins[Math.floor(rnd() * ins.length)];
            if (el.tagName === 'SELECT') el.selectedIndex = Math.floor(rnd() * el.options.length);
            else if (el.type === 'checkbox') el.checked = !el.checked;
            else if (el.type === 'range') el.value = String(+el.min + Math.floor(rnd() * (+el.max - +el.min)));
            else el.value = String(Math.floor(rnd() * 60) - 5);
            el.dispatchEvent(new Event(el.dataset.in ? 'input' : 'change', { bubbles: true }));
          }
        }
        if (k % 20 === 19) await sleep(0);
      }
      if (T.G.over) return { clicks, m: T.G.m, over: T.G.over.kind, integ };
      const dg = document.querySelector('[data-act="divGo"]');
      if (dg) dg.click();
      if (!T.G.pendingDividend) T.advance();
      for (let k = 0; k < 8; k++) {
        const div = document.querySelector('[data-act="divGo"]');
        if (div) { div.click(); continue; }
        const c = document.querySelector('.modal .mf [data-act="closeModal"], .modal [data-act="closeModal"]');
        if (c) { c.click(); continue; }
        break;
      }
      const e = T.check();
      if (e.length) integ.push({ m: T.G.m, e });
      await sleep(0);
    }
    return { clicks, m: T.G.m, over: T.G.over && T.G.over.kind, integ };
  }, { months, seed });
  console.log('fuzz2', preset, 'seed', seed, JSON.stringify(res), 'errors', errors.length);
  errors.slice(0, 8).forEach(e => console.log(' -', e));
  await browser.close();
})();

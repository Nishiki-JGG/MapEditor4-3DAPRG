// 依存なしの最小のブラウザ操作（Chrome DevTools Protocol）。Playwright が無い環境で、エディターのページを開いて式を評価するための物。
//   const { withPage } = require('./cdp'); await withPage(url, async page => { const v = await page.eval('1+1'); })
// 環境変数 BROWSER に chrome.exe / msedge.exe のパス、無ければ既定の場所を探す。使い捨てのプロファイルは os.tmpdir() に作って終わりに消す。
const { spawn } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');

function findBrowser() {
  const c = [process.env.BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean);
  const b = c.find(p => fs.existsSync(p)); if (!b) throw new Error('chrome / edge が見つかりません（BROWSER で指定）'); return b;
}

async function withPage(url, fn, opts = {}) {
  const port = 9300 + Math.floor(Math.random() * 500), dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tdwater-cdp-'));
  const args = ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--no-first-run', '--no-default-browser-check', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--allow-file-access-from-files', `--window-size=${opts.w || 1000},${opts.h || 700}`, 'about:blank'];
  const proc = spawn(findBrowser(), args, { stdio: 'ignore' });
  try {
    let targets = null;
    for (let i = 0; i < 80 && !targets; i++) { try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await new Promise(r => setTimeout(r, 250)); } }
    if (!targets) throw new Error('ブラウザに接続できません');
    const t = targets.find(x => x.type === 'page'), ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0; const pending = new Map(), errors = [];
    ws.onmessage = m => {
      const d = JSON.parse(m.data);
      if (d.id && pending.has(d.id)) { const { res, rej } = pending.get(d.id); pending.delete(d.id); d.error ? rej(new Error(d.error.message)) : res(d.result); }
      else if (d.method === 'Runtime.exceptionThrown') errors.push(d.params.exceptionDetails.exception ? d.params.exceptionDetails.exception.description : d.params.exceptionDetails.text);
    };
    const send = (method, params = {}) => new Promise((res, rej) => { const i = ++id; pending.set(i, { res, rej }); ws.send(JSON.stringify({ id: i, method, params })); });
    await send('Runtime.enable'); await send('Page.enable');
    await send('Page.navigate', { url }); await new Promise(r => setTimeout(r, opts.wait || 4000));
    const page = {
      errors,
      async eval(expr) {
        const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true, timeout: 120000 });
        if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
        return r.result.value;
      },
      async screenshot(file) { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(file, Buffer.from(r.data, 'base64')); },
    };
    const out = await fn(page); ws.close(); return out;
  } finally {
    proc.kill(); await new Promise(r => setTimeout(r, 500)); try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* 使い捨て */ }
  }
}
module.exports = { withPage };

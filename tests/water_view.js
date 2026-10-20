// エディター画面の水の表示（流れの矢印・泡の帯）を、ヘッドレスのブラウザで開いて画像にする。
//   node tests/water_view.js <出力フォルダ>
const fs = require('fs'), path = require('path'); const { withPage } = require('./cdp');
(async () => {
  const out = path.resolve(process.argv[2] || path.join(__dirname, 'water_view_out')); fs.mkdirSync(out, { recursive: true });
  const url = 'file:///' + path.resolve(__dirname, '../index.html').split(path.sep).join('/') + '#size=64';
  const res = await withPage(url, async p => {
    await p.eval("window.__app.genSample(); window.__app.state.roomId = 'v'; window.__app.updateTerrain(); window.__app.refreshWaterData(); 1");
    await new Promise(r => setTimeout(r, 1500));
    const info = await p.eval("JSON.stringify({ hasInfo: !!window.__app.waterInfo, stats: window.__app.waterInfo && window.__app.waterInfo.stats, falls: window.__app.waterInfo && window.__app.waterInfo.falls.length, uFallCount: window.__app.WATERU.uFallCount.value, text: document.getElementById('waterInfo').textContent })");
    await p.screenshot(path.join(out, 'view_normal.png'));
    await p.eval("document.getElementById('waterShowFlow').checked = true; window.__app.syncWaterShow('flow'); 1"); await new Promise(r => setTimeout(r, 800)); await p.screenshot(path.join(out, 'view_flow.png'));
    await p.eval("document.getElementById('waterShowFoam').checked = true; window.__app.syncWaterShow('foam'); 1"); await new Promise(r => setTimeout(r, 800)); await p.screenshot(path.join(out, 'view_foam.png'));
    return { info: JSON.parse(info), errors: p.errors };
  }, { w: 1400, h: 850, wait: 6000 });
  console.log(JSON.stringify(res, null, 1));
})();

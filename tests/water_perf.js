// 128m（257²）の部屋で、画面の水の解析（refreshWaterData）にかかる時間をブラウザで測る。1秒を超えたら Worker 化を検討する。
const path = require('path'); const { withPage } = require('./cdp');
(async () => {
  const url = 'file:///' + path.resolve(__dirname, '../index.html').split(path.sep).join('/') + '#size=128';
  const r = await withPage(url, async p => p.eval(`(() => { const A = window.__app; A.state.water = 3.5; const N = Math.round(Math.sqrt(A.H.length)); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = (i - (N - 1) / 2) * 0.5, z = (j - (N - 1) / 2) * 0.5; A.H[j * N + i] = Math.abs(x - 8 * Math.sin(z * 0.08)) < 10 ? 1 - 0.01 * z : 9; }
    A.updateTerrain(); const t0 = performance.now(); A.refreshWaterData(); const ms = performance.now() - t0; return { size: A.SIZE, ms: Math.round(ms), stats: A.waterInfo.stats, warnings: A.waterInfo.warnings }; })()`), { wait: 6000 });
  console.log(JSON.stringify(r));
})();

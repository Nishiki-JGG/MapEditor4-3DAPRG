// 植物の揺れ（Revision 14）：歩くモードで主人公が茂みを通り抜けると、茂みが押しのけられ、離れると揺れながら戻ること。
//   PW=<playwright のパス> node tests/touch_sway.js
const { chromium } = require(process.env.PW || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html')); await p.waitForTimeout(6000);
  const r = await p.evaluate(() => {
    const A = window.__app, T = id => A.PROP.findIndex(t => t.id === id), o = {};
    A.genFlat(); A.updateTerrain();
    const ids = ['bush', 'fern', 'reed', 'flowers', 'rock'];
    ids.forEach((id, k) => A.props.push([T(id), k * 3 - 6, 0, 0, 1, 0])); A.rebuildProps();
    const attr = id => A.propMeshes[T(id)].geometry.attributes.touch;
    o.touchTypes = ids.filter(id => !!attr(id));
    const exp0 = JSON.stringify(A.serialize().props);
    A.setMode('play'); A.player.x = -6; A.player.z = -4; A.player.y = A.heightAt(-6, -4); A.keys.clear(); A.playCam.yaw = Math.PI;
    const log = [];
    const run = (n, key) => { for (let i = 0; i < n; i++) { if (key) A.keys.add(key); A.update(1 / 60); const a = attr('bush').array; log.push([A.player.z, Math.hypot(a[0], a[1]), a[1]]); } A.keys.clear(); };
    run(110, 'KeyW'); run(240, null);
    o.walkedThrough = A.player.z > 3;
    o.maxBend = Math.max(...log.map(l => l[2] === undefined ? 0 : l[1]));
    const after = log.filter(l => l[0] > 2.5);
    let flips = 0; for (let i = 1; i < after.length; i++) if (Math.sign(after[i][2]) !== Math.sign(after[i - 1][2]) && Math.abs(after[i][2]) > 1e-3) flips++;
    o.wobblesAfterLeaving = flips;
    o.settled = log[log.length - 1][1] === 0;
    o.untouchedStill = ['fern', 'reed', 'flowers'].every(id => { const a = attr(id).array; return a[0] === 0 && a[1] === 0; });
    run(0); A.setMode('edit'); o.resetInEdit = attr('bush').array[1] === 0;
    o.mapUnchanged = JSON.stringify(A.serialize().props) === exp0;
    return o;
  });
  const checks = [
    ['揺れる種類：茂み・シダ・葦・花（岩は揺れない）', JSON.stringify(r.touchTypes) === JSON.stringify(['bush', 'fern', 'reed', 'flowers'])],
    ['茂みを通り抜けられる', r.walkedThrough],
    ['触れると 0.2m 以上傾く', r.maxBend > .2],
    ['離れた後、揺れながら戻る（向きが 2 回以上反転）', r.wobblesAfterLeaving >= 2],
    ['4 秒で止まる', r.settled],
    ['触れていない植物は動かない', r.untouchedStill],
    ['編集モードでは元の形', r.resetInEdit],
    ['地図データは変わらない', r.mapUnchanged],
    ['ページのエラー 0', errs.length === 0],
  ];
  for (const [n, ok] of checks) console.log((ok ? 'PASS ' : 'FAIL ') + n);
  console.log(JSON.stringify(r), errs.join('\n'));
  await b.close(); process.exit(checks.every(c => c[1]) ? 0 : 1);
})();

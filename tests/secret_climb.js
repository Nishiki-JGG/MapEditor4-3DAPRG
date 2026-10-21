// 隠し通路から崖の上へ「ワープ」できないこと：通路のどこから、どの向きに歩いても、1 コマの床の高さの変化が段差（maxStep）以下。
//   PW=<playwright のパス> node tests/secret_climb.js
const { chromium } = require(process.env.PW || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html') + '#size=48'); await p.waitForTimeout(6000);
  const r = await p.evaluate(() => {
    const A = window.__app; A.genSample2(); A.updateTerrain(); A.rebuildProps(); A.setMode('play');
    const cells = []; for (let x = -23.5; x < 24; x += .5) for (let z = -23.5; z < 24; z += .5) if (A.overrideAt(x, z) === 3 && A.walkable(x, z)) cells.push([x, z]);
    const pick = cells.filter((_, i) => i % 7 === 0), keys = [['KeyW'], ['KeyS'], ['KeyA'], ['KeyD'], ['KeyW', 'KeyA'], ['KeyW', 'KeyD'], ['KeyS', 'KeyA'], ['KeyS', 'KeyD']];
    let worst = 0, runs = 0, endedHigh = 0;
    for (const [x, z] of pick) for (const ks of keys) {
      A.player.x = x; A.player.z = z; A.player.y = A.floorAt(x, z); const f0 = A.floorAt(x, z); let prev = f0;
      for (let i = 0; i < 90; i++) { A.keys.clear(); ks.forEach(k => A.keys.add(k)); A.update(1 / 60); const f = A.floorAt(A.player.x, A.player.z); worst = Math.max(worst, Math.abs(f - prev)); prev = f; }
      A.keys.clear(); runs++; if (prev - f0 > 1.5) endedHigh++;
    }
    return { passageCells: cells.length, runs, worstStep: +worst.toFixed(3), maxStep: A.state.agent.maxStep, endedOnCliff: endedHigh };
  });
  const ok = r.passageCells > 0 && r.worstStep <= r.maxStep + .05 && r.endedOnCliff === 0 && !errs.length;
  console.log((ok ? 'PASS' : 'FAIL') + ' 隠し通路から段差を越えて上がれない', JSON.stringify(r), errs.join('|'));
  await b.close(); process.exit(ok ? 0 : 1);
})();

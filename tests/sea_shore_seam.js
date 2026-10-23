// 海岸の境目（Revision 22）：陸の砂と水の中の砂が段にならずにつながること、水際に黒いにじみが出ないこと、
// 波の届かない浜では水面の板が何も描かないこと（スマホの奥行きの精度でも、砂と板がちらつかない）。
//   PW=<playwright のパス> node tests/sea_shore_seam.js [エディターのフォルダ]
const { chromium } = require(process.env.PW || 'playwright');
const path = require('path');
const dir = path.resolve(process.argv[2] || path.join(__dirname, '..'));
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 480, height: 480 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.join(dir, 'index.html') + '#size=48', { timeout: 180000 }); await p.waitForTimeout(6000);
  // a flat beach map with a coast along x (sea toward +x); the panels are hidden, so the canvas is the whole window
  await p.evaluate(() => {
    for (const id of ['panel', 'topbar', 'hud', 'brushSizePanel']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
    const A = window.__app; A.genFlat(); A.applyBiome('beach'); A.makeCoast({ x: -4, z: 0 }, { x: 14, z: 0 }); A.updateTerrain(); A.rebuildProps();
    window.dispatchEvent(new Event('resize'));
  });
  await p.waitForTimeout(1500);
  // straight down over the waterline; returns the luminance of each pixel along the middle row (x across the shore)
  const shot = (t, showWater, v = { yaw: 0, pitch: 1.5, dist: 9 }) => p.evaluate(([t, showWater, v]) => {
    const A = window.__app; let root = A.terrain; while (root.parent) root = root.parent;
    root.traverse(o => { if (o.material && o.material.uniforms && o.material.uniforms.uWaveH) o.visible = showWater; });
    for (const m of Object.values(A.propMeshes || {})) if (m && m.isObject3D) m.visible = false;
    let wx = 0; for (let x = -4; x < 20; x += .05) if (A.heightAt(x, 0) < A.state.water) { wx = x; break; }   // the still waterline on z = 0
    A.cam.yaw = v.yaw; A.cam.pitch = v.pitch; A.cam.dist = v.dist; A.cam.target.set(wx + (v.dx || 0), A.state.water, 0);
    A.setTime(t); A.update(0); A.setTime(t); A.render();
    const c = A.renderer.domElement, k = document.createElement('canvas'); k.width = c.width; k.height = c.height;
    const g = k.getContext('2d'); g.drawImage(c, 0, 0); const d = g.getImageData(0, 0, k.width, k.height).data;
    const row = [], dark = [];
    for (let y = 0; y < k.height; y++) for (let x = 0; x < k.width; x++) {
      const i = (y * k.width + x) * 4, l = (.2126 * d[i] + .7152 * d[i + 1] + .0722 * d[i + 2]) / 255;
      if (y === k.height >> 1) row.push(l);
      if (l < .16) dark.push(1);
    }
    return { row, dark: dark.length, w: k.width, h: k.height };
  }, [t, showWater, v]);
  const o = {};
  // 1) the sand without the water: no step at the still waterline (the old shader darkened only above it)
  const dry = await shot(20, false);
  // smooth the row a little (sand grain), then the biggest change over 6 px
  const sm = dry.row.map((_, i, r) => { let s = 0, n = 0; for (let k = -3; k <= 3; k++) if (r[i + k] !== undefined) { s += r[i + k]; n++; } return s / n; });
  let step = 0; for (let i = 6; i < sm.length; i++) step = Math.max(step, Math.abs(sm[i] - sm[i - 6]));
  o.sandStep = +step.toFixed(3);
  // 2) with the water, at several moments of the waves, seen low from the sea (as on the phone): no near-black pixels at the edge
  o.dark = [];
  for (const t of [14, 15.2, 16.4, 17.6, 18.8, 20]) o.dark.push((await shot(t, true, { yaw: 1.57, pitch: 1.0, dist: 6, dx: .5 })).dark);
  // 3) far up the beach (out of the run-up's reach) the sheet draws nothing: the same pixels with and without the water
  const far = { yaw: 0, pitch: 1.5, dist: 9, dx: -1.8 }, wet = await shot(20, true, far), bare = await shot(20, false, far);
  const n = wet.row.length, inland = [];
  for (let i = 0; i < n * .3; i++) inland.push(Math.abs(wet.row[i] - bare.row[i]));   // 2.8〜4.7 m inland: the sea still weighs there, but the run-up does not reach (sea toward +x)
  o.inlandDiff = +Math.max(...inland).toFixed(4);
  await b.close();
  const checks = [
    ['水を隠すと、砂の明るさは水際で段にならない（6 画素で 0.05 未満）', o.sandStep < .05],
    ['波のどの瞬間でも、水際に黒いにじみが無い', o.dark.every(v => v === 0)],
    ['波の届かない浜では、水面の板が何も描かない', o.inlandDiff < .004],
    ['ページのエラーなし', errs.length === 0],
  ];
  console.log(JSON.stringify(o)); if (errs.length) console.log(errs.slice(0, 5));
  let fail = 0; for (const [name, ok] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) fail++; }
  process.exit(fail ? 1 : 0);
})();

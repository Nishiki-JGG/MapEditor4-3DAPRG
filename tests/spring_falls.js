// 滝（Revision 29）：水源の小川が崖を落ちる所は、崖の面に水の板を貼らず、縁から滝つぼへ落ちる幕・泡・しぶき・波紋になり、
// 幕の通り道の崖石は片づく。置いた滝は、あとで地形を掘る・埋めると、着水点（と落ち口）が地面・水面に付き直す（宙に浮かない）。
//   PW=<playwright のパス> node tests/spring_falls.js
const { chromium } = require(process.env.PW || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html') + '#size=48', { timeout: 180000 }); await p.waitForTimeout(8000);
  // a plateau (cliff 2.2 m) on gently sloping ground, well above the water
  const setup = () => p.evaluate(() => {
    const A = window.__app; A.genFlat(); A.applyBiome('forest');
    for (let j = 0; j < 97; j++) for (let i = 0; i < 97; i++) { const x = -24 + i * .5, z = -24 + j * .5; A.H[j * 97 + i] = 3 + x * .03 + Math.sin(z * .4) * .1; }
    A.updateTerrain(); A.setTool('plateau'); A.state.radius = 9; A.state.strength = 1; A.stroke(14, 0, 30); A.updateTerrain(); A.rebuildProps();
  });
  await setup(); await p.waitForTimeout(4000);
  const o = await p.evaluate(() => {
    const A = window.__app, out = {};
    A.setTool('spring'); A.placeSpring(12, 2, 'spring'); A.refreshWaterData();
    const r = A.springRes, f = r.falls[0];
    out.fall = f && { top: f.top, bottom: f.bottom, lean: f.lean };
    // no water on the cliff face: every stream vertex in the fall's band is at its top or its foot
    let face = 0; for (let k = 0; k < r.kind.length; k++) { if (r.kind[k] !== 1) continue; const x = -24 + (k % 97) * .5, z = -24 + ((k / 97) | 0) * .5, ax = x - f.x, az = z - f.z, along = ax * f.dir[0] + az * f.dir[1], lat = Math.abs(ax * f.dir[1] - az * f.dir[0]); if (lat < f.width / 2 && along > .1 && along < f.lean - .1 && A.heightAt(x, z) < f.top - .2 && A.heightAt(x, z) > f.bottom + .2) face++; }
    out.face = face;
    // the sheet: stands in the plunge pool, reaches up to the lip's height, in front of the lip (not inside the rock)
    const sheet = A.springFallGroup.children.find(c => c.isMesh && c.geometry.type === 'PlaneGeometry' && c.geometry.parameters.height === 1);
    const bb = sheet && new THREE.Box3().setFromObject(sheet);
    out.sheet = bb && { minY: +bb.min.y.toFixed(2), maxY: +bb.max.y.toFixed(2) };
    out.parts = A.springFallGroup.children.length;
    out.rings = A.WATERU.uFallCount.value;
    // no cliff stone stands in the falling water
    const CLEAR = ['rock', 'cliff', 'cliff_split', 'cliff_shoulder', 'cliff_joint', 'cliff_slab', 'cliff_talus'];
    out.stonesInFall = A.props.filter(q => CLEAR.includes(A.PROP[q[0]].id) && (() => { const ax = q[1] - f.x, az = q[2] - f.z, along = ax * f.dir[0] + az * f.dir[1], lat = Math.abs(ax * f.dir[1] - az * f.dir[0]); return lat < f.width * .55 + .3 && along > -1 && along < f.lean + 1.2; })()).length;
    // removing the spring takes the fall away
    A.springs = []; A.applySprings(); out.afterRemove = A.springFallGroup.children.length;
    return out;
  });
  // a placed waterfall on dry ground, then the ground under it dug down to the water, then filled in again
  await setup(); await p.waitForTimeout(4000);
  const q = await p.evaluate(() => {
    const A = window.__app, W = A.state.water, out = {};
    let x = 9; while (x > 0 && A.heightAt(x, 0) > 4.5) x -= .25;   // the cliff face, west side of the plateau
    out.placed = A.placeFall(x + .25, 0, 2); const f = A.falls[0];
    out.before = { bottom: +f.bottom.toFixed(3), top: +f.top.toFixed(3), ground: +A.heightAt(f.x, f.z).toFixed(3) };
    const sheetY = () => { const m = A.fallGroup.children.find(c => c.isMesh && c.geometry.type === 'PlaneGeometry' && c.geometry.parameters.height === 1); return m ? +m.position.y.toFixed(3) : null; };
    out.before.sheetY = sheetY();
    A.setTool('lower'); A.state.radius = 3; A.state.strength = 1;
    for (let i = 0; i < 40 && A.heightAt(f.x, f.z) > W - .2; i++) A.stroke(f.x - .5, f.z, 6);
    out.dug = { bottom: +f.bottom.toFixed(3), water: W, ground: +A.heightAt(f.x, f.z).toFixed(3), sheetY: sheetY() };
    A.setTool('raise'); for (let i = 0; i < 40 && A.heightAt(f.x, f.z) < W + .6; i++) A.stroke(f.x - .5, f.z, 6);
    let lo = Infinity; const [ux, uz] = [-Math.sin(f.rot), -Math.cos(f.rot)]; for (let d = 0; d <= 3; d += .25) lo = Math.min(lo, A.heightAt(f.x + ux * (1 - d), f.z + uz * (1 - d)));
    out.filled = { bottom: +f.bottom.toFixed(3), lowest: +Math.max(lo, W).toFixed(3), sheetY: sheetY() };
    return out;
  });
  await b.close();
  const checks = [
    ['水源の滝：崖（2.2m）を越える所が滝になる', o.fall && o.fall.top - o.fall.bottom > 1.8],
    ['水源の滝：崖の面に水の板を貼らない', o.face === 0],
    ['水源の滝：幕は滝つぼから縁の高さまで（縁より上に出ない）', o.sheet && o.sheet.minY < o.fall.bottom && o.sheet.maxY <= o.fall.top + .02 && o.sheet.maxY > o.fall.top - .3],
    ['水源の滝：幕・泡・しぶきと、滝つぼの波紋', o.parts === 3 && o.rings >= 1],
    ['水源の滝：幕の通り道に崖石を残さない', o.stonesInFall === 0],
    ['水源を消すと滝も消える', o.afterRemove === 0],
    ['置いた滝：乾いた所に置ける', q.placed && q.before.bottom > q.dug.water + 1],
    ['置いた滝：着水点を水位まで掘ると、滝の下端も水面まで下がる（宙に浮かない）', Math.abs(q.dug.bottom - q.dug.water) < .01 && q.dug.ground < q.dug.water && Math.abs(q.dug.sheetY - q.dug.bottom) < .01],
    ['置いた滝：埋め戻すと、下端も地面まで上がる', q.filled.bottom > q.dug.bottom + .05 && Math.abs(q.filled.bottom - q.filled.lowest) < .04 && Math.abs(q.filled.sheetY - q.filled.bottom) < .01],
    ['ページのエラーなし', errs.length === 0],
  ];
  console.log(JSON.stringify({ o, q }));
  if (errs.length) console.log(errs.slice(0, 5));
  let fail = 0; for (const [name, ok] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) fail++; }
  process.exit(fail ? 1 : 0);
})();

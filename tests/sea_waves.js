// 海の波と海岸（Revision 18）：岸までの距離・向き・海かどうかの場、波が動くこと、打ち上がりが浜の奥まで行かないこと、湖は静かなこと。
//   PW=<playwright のパス> node tests/sea_waves.js
const { chromium } = require(process.env.PW || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html') + '#size=48', { timeout: 180000 }); await p.waitForTimeout(6000);
  // a flat map, a pond dug inland, then a coast to the east (+x)
  const o = await p.evaluate(() => {
    for (const id of ['panel', 'topbar', 'hud']) document.getElementById(id).style.display = 'none';
    const A = window.__app; A.genFlat(); A.applyBiome('beach');
    A.setTool('lower'); A.state.radius = 3; A.state.strength = 1; A.stroke(-14, 0, 60);
    A.makeCoast({ x: 2, z: 0 }, { x: 16, z: 0 }); A.updateTerrain(); A.rebuildProps();
    const sh = A.terrain.parent.children.find(c => c.geometry && c.geometry.attributes.shore).geometry.attributes.shore.array, N = Math.round(Math.sqrt(sh.length / 4));
    const at = (x, z) => { const i = Math.round((x + 24) * 2), j = Math.round((z + 24) * 2), k = (j * N + i) * 4; return { s: sh[k], dx: sh[k + 1], dz: sh[k + 2], sea: sh[k + 3], wet: A.heightAt(x, z) < A.state.water }; };
    return { sea: at(20, 0), beach: at(4, 0), inland: at(-6, 0), pond: at(-14, 0), pondWet: A.heightAt(-14, 0) < A.state.water };
  });
  // the surf moves: the shore strip differs between two moments; with the sea off it is still
  const shot = async t => { await p.evaluate(t => { const A = window.__app; A.cam.yaw = -1.5; A.cam.pitch = .9; A.cam.dist = 24; A.cam.target.set(8, A.state.water, 0); A.setTime(t); A.render(); }, t); return p.screenshot({ clip: { x: 150, y: 100, width: 600, height: 400 } }); };
  const diff = async (a, b2) => p.evaluate(async ([a, b2]) => {
    const load = async s => { const im = new Image(); im.src = 'data:image/png;base64,' + s; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
    const x = await load(a), y = await load(b2); let s = 0; for (let i = 0; i < x.length; i += 4) s += Math.abs(x[i] - y[i]) + Math.abs(x[i + 1] - y[i + 1]) + Math.abs(x[i + 2] - y[i + 2]); return s / (x.length / 4) / 3;
  }, [a.toString('base64'), b2.toString('base64')]);
  const s1 = await shot(10), s2 = await shot(12.2);
  o.moving = +(await diff(s1, s2)).toFixed(2);
  o.exportWaves = await p.evaluate(async () => { const A = window.__app, s = document.getElementById('weatherKind'); const get = async () => JSON.parse((await A.buildExport()).files.find(f => f.name === 'meta.json').data).water[0].waves;
    s.value = 'none'; s.dispatchEvent(new Event('change')); const calm = await get(); s.value = 'gale'; s.dispatchEvent(new Event('change')); const gale = await get(); s.value = 'none'; s.dispatchEvent(new Event('change')); return { calm: calm && calm.height, gale: gale && gale.height }; });
  // a forest map has no sea: the field stays empty and the export has no waves
  o.noSea = await p.evaluate(async () => { const A = window.__app; A.genFlat(); A.applyBiome('forest'); A.updateTerrain();
    const sh = A.terrain.parent.children.find(c => c.geometry && c.geometry.attributes.shore).geometry.attributes.shore.array; let m = 0; for (let k = 3; k < sh.length; k += 4) m = Math.max(m, sh[k]);
    return { maxSea: m, waves: JSON.parse((await A.buildExport()).files.find(f => f.name === 'meta.json').data).water[0].waves }; });
  const checks = [
    ['沖は海（距離 +、海 1）、向きは岸（西）へ', o.sea.wet && o.sea.s > 3 && o.sea.sea > .99 && o.sea.dx < -.8],
    ['浜は陸（距離 −）で、海の波打ち際から数 m なら海に含める', !o.beach.wet && o.beach.s < 0 && o.beach.sea > .5],
    ['浜の奥（波打ち際から遠い陸）は海に含めない', !o.inland.wet && o.inland.sea < .01],
    ['内陸の池は海ではない（静か）', o.pondWet && o.pond.sea < .01],
    ['波が動く（2.2 秒で波打ち際の絵が変わる）', o.moving > 1.5],
    ['風（強風）で波が高くなり、書き出しの meta.json に波の数値が入る', o.exportWaves.calm > .3 && o.exportWaves.gale > o.exportWaves.calm],
    ['海の無い地図では、場は空で、書き出しに波は無い', o.noSea.maxSea === 0 && o.noSea.waves === null],
    ['ページのエラー 0', errs.length === 0],
  ];
  for (const [n, ok] of checks) console.log((ok ? 'PASS ' : 'FAIL ') + n);
  console.log(JSON.stringify(o), errs.join('\n'));
  await b.close(); process.exit(checks.every(c => c[1]) ? 0 : 1);
})();

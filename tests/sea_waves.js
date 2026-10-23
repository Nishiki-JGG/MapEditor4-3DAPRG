// 海の波と海岸（Revision 18・19・24）：岸までの距離・向き・海かどうかの場、波が動くこと、湖は静かなこと、Unity 用の sea_field.png がエディターの場と一致すること。
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
  // the export carries the field for Unity: read sea_field.png and heightmap_r16.raw the way MapWaterBuilder.BuildSea (C#) does
  // and compare with the editor's own field and depth at the same places
  const ex = await p.evaluate(async () => {
    const A = window.__app, { files } = await A.buildExport(), f = n => files.find(x => x.name === n), meta = JSON.parse(f('meta.json').data);
    const b64 = u8 => { let s = ''; for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); return btoa(s); };
    const ga = A.terrain.parent.children.find(c => c.geometry && c.geometry.attributes.shore).geometry.attributes, sh = ga.shore.array, s2 = ga.shore2.array, N = Math.round(Math.sqrt(sh.length / 4));
    const pts = [[19.5, 0], [10.5, 3], [6, -1.5], [4.5, 0], [3, 4.5], [0, 0], [-6, 0], [-13.5, 0], [12, -9]]   // on both grids (editor 0.5 m, export 0.375 m on a 48 m map)
      .map(([x, z]) => { const i = Math.round((x + 24) * 2), j = Math.round((z + 24) * 2), k = (j * N + i) * 4; return [x, z, sh[k], sh[k + 1], sh[k + 2], sh[k + 3], A.state.water - A.heightAt(x, z), s2[k / 2], s2[k / 2 + 1]]; });
    return { sea: meta.sea, level: meta.water[0].level, size: meta.terrain.size[0], TN: meta.terrain.heightmapResolution, rangeY: meta.terrain.heightRange, png: b64(f('sea_field.png').data), png2: b64(f('sea_field2.png').data), raw: b64(f('heightmap_r16.raw').data), pts };
  });
  {
    const zlib = require('zlib'), raw = Buffer.from(ex.raw, 'base64'), TN = ex.TN;
    const decode = b64 => {   // the stored (unfiltered) PNG the exporter writes
      const png = Buffer.from(b64, 'base64'), idat = []; let w = 0, h = 0;
      for (let o = 8; o < png.length;) { const len = png.readUInt32BE(o), type = png.toString('ascii', o + 4, o + 8); if (type === 'IHDR') { w = png.readUInt32BE(o + 8); h = png.readUInt32BE(o + 12); } if (type === 'IDAT') idat.push(png.subarray(o + 8, o + 8 + len)); o += 12 + len; }
      const data = zlib.inflateSync(Buffer.concat(idat)), row = 1 + w * 4;
      return { w, h, px: (r, c) => { if (data[r * row] !== 0) throw new Error('PNG filter ' + data[r * row]); const o = r * row + 1 + c * 4; return [data[o], data[o + 1], data[o + 2], data[o + 3]]; } };
    };
    const im = decode(ex.png), im2 = decode(ex.png2), w = im.w, h = im.h, px = im.px;
    const cell = ex.size / (TN - 1), half = ex.size / 2;
    ex.cmp = ex.pts.map(([x, z, s, dx, dz, sea, depth, ov, jv]) => {
      const i = Math.round((x + half) / cell), rb = Math.round((half - z) / cell), [R, G, B, A] = px(TN - 1 - rb, i), k = rb * TN + i;   // C#: GetPixels32 row 0 = image bottom = Unity z 0
      const su = (R * 256 + G) / 65535 * 80 - 20, a = B / 256 * Math.PI * 2, du = [Math.cos(a), -Math.sin(a)], wu = A / 255, dep = ex.level - (raw[k * 2] | (raw[k * 2 + 1] << 8)) / 65535 * ex.rangeY;
      const [R2, G2, B2] = im2.px(TN - 1 - rb, i), ou = (R2 * 256 + G2) / 65535 * 80 - 40, ju = B2 / 255;   // MapWaterBuilder.BuildSea: Riv(k)
      return { x, z, ds: +Math.abs(su - s).toFixed(4), dw: +Math.abs(wu - sea).toFixed(4), dirDot: Math.hypot(dx, dz) > .5 ? +(du[0] * dx + du[1] * dz).toFixed(4) : 1, dDepth: +Math.abs(dep - depth).toFixed(4), dO: +Math.abs(ou - ov).toFixed(4), dJ: +Math.abs(ju - jv).toFixed(4) };
    });
    ex.size2 = [w, h];
    ex.size2b = [im2.w, im2.h]; delete ex.png; delete ex.png2; delete ex.raw;
  }
  o.export = { fieldSize: ex.size2, field2Size: ex.size2b, field2: ex.sea && ex.sea.field2, TN: ex.TN, version: ex.sea && ex.sea.version, waves: ex.sea && ex.sea.waves, worst: ['ds', 'dw', 'dDepth', 'dO', 'dJ'].map(k => Math.max(...ex.cmp.map(c => c[k]))), minDirDot: Math.min(...ex.cmp.map(c => c.dirDot)), points: ex.cmp };
  // a forest map has no sea: the field stays empty and the export has no waves
  o.noSea = await p.evaluate(async () => { const A = window.__app; A.genFlat(); A.applyBiome('forest'); A.updateTerrain();
    const sh = A.terrain.parent.children.find(c => c.geometry && c.geometry.attributes.shore).geometry.attributes.shore.array; let m = 0; for (let k = 3; k < sh.length; k += 4) m = Math.max(m, sh[k]);
    const meta = JSON.parse((await A.buildExport()).files.find(f => f.name === 'meta.json').data); return { maxSea: m, waves: meta.water[0].waves, sea: meta.sea }; });
  const checks = [
    ['沖は海（距離 +、海 1）、向きは岸（西）へ', o.sea.wet && o.sea.s > 3 && o.sea.sea > .99 && o.sea.dx < -.8],
    ['浜は陸（距離 −）で、海の波打ち際から数 m なら海に含める', !o.beach.wet && o.beach.s < 0 && o.beach.sea > .5],
    ['浜の奥（波打ち際から遠い陸）は海に含めない', !o.inland.wet && o.inland.sea < .01],
    ['内陸の池は海ではない（静か）', o.pondWet && o.pond.sea < .01],
    ['波が動く（2.2 秒で波打ち際の絵が変わる）', o.moving > 1.5],
    ['風（強風）で波が高くなり、書き出しの meta.json に波の数値が入る', o.exportWaves.calm > .3 && o.exportWaves.gale > o.exportWaves.calm],
    ['書き出しの sea_field.png と sea_field2.png を Unity（C#）と同じ読み方で読むと、エディターの場・水深と一致する', o.export.version === 2 && o.export.field2 === 'sea_field2.png' && o.export.fieldSize[0] === o.export.TN && o.export.field2Size[0] === o.export.TN && o.export.worst[3] < .01 && o.export.worst[4] < .005 && o.export.worst[0] < .01 && o.export.worst[1] < .01 && o.export.worst[2] < .02 && o.export.minDirDot > .995 && o.export.waves.wavelength === 7.5],
    ['海の無い地図では、場は空で、書き出しに波は無い', o.noSea.maxSea === 0 && o.noSea.waves === null && o.noSea.sea === null],
    ['ページのエラー 0', errs.length === 0],
  ];
  for (const [n, ok] of checks) console.log((ok ? 'PASS ' : 'FAIL ') + n);
  console.log(JSON.stringify(o), errs.join('\n'));
  await b.close(); process.exit(checks.every(c => c[1]) ? 0 : 1);
})();

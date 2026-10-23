// 海につながる川（Revision 23・24）：地図の端から海へ流れる細い水路は川（波の無い流れる水）になり、開けた海だけが海になること。
// 河口では海から川へなめらかに替わり、波の山は川へ入り込まず、川の流れに押し返されること。書き出しは海（sea_field.png）と川（water_flow.png）の両方を出すこと。
//   PW=<playwright のパス> node tests/sea_river.js
const { chromium } = require(process.env.PW || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html') + '#size=64', { timeout: 180000 }); await p.waitForTimeout(8000);
  // a grass map with the sea to the south (+z, coast tool) and a channel about 3.5 m wide from the north edge down into it
  const o = await p.evaluate(() => {
    const A = window.__app; A.genFlat(); A.makeCoast({ x: 0, z: 4 }, { x: 0, z: 20 });
    const N = Math.round(Math.sqrt(A.H.length)), half = A.SIZE / 2, W = A.state.water, cx = z => -2 + Math.sin(z * .12) * 3 + z * .15;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = -half + i * A.SIZE / (N - 1), z = -half + j * A.SIZE / (N - 1); if (z > 12) continue;
      const d = Math.abs(x - cx(z)), w = 1.6 + Math.max(0, z + 6) * .04;
      if (d < w + 1.2) { const k = j * N + i, t = Math.min(1, Math.max(0, (d - w) / 1.2)), bed = W - .9 + (z + 32) / 44 * .25; A.H[k] = Math.min(A.H[k], bed + (A.H[k] - bed) * t * t); }
    }
    A.updateTerrain(); A.rebuildProps(); A.refreshWaterData();
    const sh = A.terrain.parent.children.find(c => c.geometry && c.geometry.attributes.shore).geometry.attributes.shore.array;
    const seaAt = (x, z) => { const i = Math.round((x + half) * 2), j = Math.round((z + half) * 2); return sh[(j * N + i) * 4 + 3]; };
    // the sea weight along the channel's middle, from the north edge to well out at sea
    const along = []; for (let z = -30; z <= 26; z += 1) along.push({ z, w: +seaAt(z > 12 ? cx(12) : cx(z), z).toFixed(3), wet: A.heightAt(z > 12 ? cx(12) : cx(z), z) < W });
    // the flow in the channel (the editor's analysis, the same as the export): direction and speed
    const wi = A.waterInfo, TN = wi.TN, fl = wi.flow, flowAt = (x, z) => { const i = Math.round((x + half) / wi.TS), j = Math.round((z + half) / wi.TS), k = j * TN + i; return [fl[k * 2], fl[k * 2 + 1]]; };
    const river = []; for (let z = -24; z <= 0; z += 4) { const f = flowAt(cx(z), z); river.push({ z, ux: +f[0].toFixed(3), uz: +f[1].toFixed(3), sp: +Math.hypot(f[0], f[1]).toFixed(3) }); }
    // the crests: c = max(s,0) + o is where a crest sits (equal c = the same crest). Across the mouth, at a few metres out,
    // c must stay level (no V into the river) and lag a little in front of the mouth (bowed out to sea); s alone dips into the river
    const ga = A.terrain.parent.children.find(c => c.geometry && c.geometry.attributes.shore2).geometry.attributes, s2 = ga.shore2.array;
    const fld = (x, z) => { const i = Math.round((x + half) * 2), j = Math.round((z + half) * 2), k = j * N + i; return { s: sh[k * 4], w: sh[k * 4 + 3], o: s2[k * 2], j: s2[k * 2 + 1], wet: A.heightAt(x, z) < W }; };
    const crests = []; for (const z of [11, 13, 15]) { const row = []; for (let x = -16; x <= 16; x += 2) { const f = fld(x, z); if (f.wet && f.w > .9) row.push({ x, c: Math.max(f.s, 0) + f.o, s: f.s, j: f.j }); } crests.push({ z, row }); }
    const mouthX = cx(12);
    const jet = { mouth: fld(cx(8), 8).j, out: fld(mouthX, 14).j, beachL: fld(mouthX - 16, 12).j, beachR: fld(mouthX + 16, 12).j };
    return { along, river, inflows: wi.inflows, crests, jet, mouthX };
  });
  // the export: both the sea's field and the river's flow images, and the river has no sea weight in sea_field.png
  o.export = await p.evaluate(async () => {
    const A = window.__app, { files } = await A.buildExport(), f = n => files.find(x => x.name === n), meta = JSON.parse(f('meta.json').data);
    return { sea: !!meta.sea && !!f('sea_field.png'), flow: !!f('water_flow.png') && !!f('water_mask.png'), available: meta.waterSim.available, reason: meta.waterSim.reason };
  });
  // the sea alone (no channel): no flow images, the reason says why
  o.seaOnly = await p.evaluate(async () => {
    const A = window.__app; A.genFlat(); A.makeCoast({ x: 0, z: 4 }, { x: 0, z: 20 }); A.updateTerrain(); A.rebuildProps(); A.refreshWaterData();
    const { files } = await A.buildExport(), meta = JSON.parse(files.find(x => x.name === 'meta.json').data);
    return { available: meta.waterSim.available, reason: meta.waterSim.reason, flow: !!files.find(x => x.name === 'water_flow.png'), sea: !!meta.sea };
  });
  await b.close();
  // the crest line itself, without the lag in front of the mouth (sea.js: o includes -3 m × j; app.js SEA_LAG)
  const spread = r => { const v = r.map(e => e.c + 3 * e.j); return Math.max(...v) - Math.min(...v); }, spreadS = r => { const v = r.map(e => e.s); return Math.max(...v) - Math.min(...v); };
  o.crestSpread = o.crests.map(c => +spread(c.row).toFixed(2)); o.sSpread = o.crests.map(c => +spreadS(c.row).toFixed(2));
  // the lag in front of the mouth: c there minus c along the beach, at the same z
  o.bow = o.crests.map(c => { const near = c.row.filter(e => Math.abs(e.x - o.mouthX) < 2.5), far = c.row.filter(e => Math.abs(e.x - o.mouthX) > 10); return near.length && far.length ? +(near.reduce((a, e) => a + e.c, 0) / near.length - far.reduce((a, e) => a + e.c, 0) / far.length).toFixed(2) : null; });
  const wetAlong = o.along.filter(a => a.wet), up = wetAlong.filter(a => a.z <= 0), out = o.along.filter(a => a.z >= 20);
  let jump = 0; for (let i = 1; i < wetAlong.length; i++) jump = Math.max(jump, Math.abs(wetAlong[i].w - wetAlong[i - 1].w));
  const checks = [
    ['水路（河口より上流）は海ではない（海の重み 0）', up.length > 10 && up.every(a => a.w < .02)],
    ['沖は海（海の重み 1）', out.length > 3 && out.every(a => a.w > .98)],
    ['河口では海から川へなめらかに替わる（1m で 0.35 未満の変化）', jump < .35],
    ['川は北の端から海へ（南、+z）流れ、速さはふつうの川（上限に張り付かない）', o.inflows.some(f => f.kind === 'river' && f.z < -30) && o.river.every(r => r.uz > .2 && r.sp < 1.9)],
    ['波の山は河口の前でも海岸に沿ってまっすぐ（川の中へ V 字に入り込まない）', o.crestSpread.every(v => v < .9) && o.sSpread[0] > 2],
    ['河口の前では、川の流れに押されて波の山が沖側に遅れる', o.bow.every(v => v !== null && v < -.2)],
    ['川の噴流は河口の前に出て、離れた浜には無い', o.jet.mouth > .5 && o.jet.out > .15 && o.jet.beachL < .03 && o.jet.beachR < .03],
    ['書き出し：海の sea_field.png と、川の water_flow.png / water_mask.png の両方', o.export.sea && o.export.flow && o.export.available === true],
    ['海だけの地図：流れの画像は出さず、理由を書く', o.seaOnly.sea && !o.seaOnly.flow && o.seaOnly.available === false && /sea only/.test(o.seaOnly.reason || '')],
    ['ページのエラーなし', errs.length === 0],
  ];
  console.log(JSON.stringify({ crestSpread: o.crestSpread, sSpread: o.sSpread, bow: o.bow, jet: o.jet, river: o.river, along: o.along.filter((a, i) => i % 4 === 0), export: o.export, seaOnly: o.seaOnly, jump: +jump.toFixed(3) }));
  if (errs.length) console.log(errs.slice(0, 5));
  let fail = 0; for (const [name, ok] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) fail++; }
  process.exit(fail ? 1 : 0);
})();

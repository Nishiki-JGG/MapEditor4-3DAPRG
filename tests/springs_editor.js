// 水源とプール（Revision 28）：水源ツールで置いた水が、低い方へ小川になって流れ（溝は自動で掘る）、平らな所では湧出量の広さで止まり、
// くぼみは池になる。深い池は歩けず、浅い水は歩ける。プールは石の縁で水を地面より上に張り、縁は通れず、中に水源を置くとあふれ口から小川が出る。
// 湧出量を変えても・消しても地面は元に戻る（掘り直し）。取り消し・保存・書き出しに入る。
//   PW=<playwright のパス> node tests/springs_editor.js
const { chromium } = require(process.env.PW || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html') + '#size=48', { timeout: 180000 }); await p.waitForTimeout(8000);
  const o = await p.evaluate(async () => {
    const A = window.__app, N = 97, at = (x, z) => Math.round((z + 24) * 2) * N + Math.round((x + 24) * 2);
    const shape = (x, z) => 4 + x * .07 + Math.sin(z * .3) * .2 - 2 * Math.exp(-((x + 6) ** 2 + (z - 4) ** 2) / 16);   // a slope to the west with a hollow on it
    A.genFlat(); A.applyBiome('forest');
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) A.H[j * N + i] = shape(-24 + i * .5, -24 + j * .5);
    A.updateTerrain(); A.rebuildProps();
    const H0 = A.H.slice(), out = {};
    // 1) a spring up the slope: a stream runs west, the channel is carved, the hollow becomes a pond
    A.setTool('spring'); A.state.variant.spring = 'spring';
    const err1 = A.placeSpring(14, 4, 'spring'), r1 = A.springRes;
    out.place = { err: err1, streams: r1.streams.length, ponds: r1.ponds.map(q => [q.level, q.area, q.maxDepth]), ends: r1.springs.map(q => q.end), carvedMax: +Math.max(...A.SC).toFixed(3),
      westOfSpring: r1.streams.every(st => st.points[st.points.length - 1][0] < st.points[0][0] + .01) };
    const H1 = A.H.slice();
    // walking: the pond's deep middle is not walkable, a shallow stream is (and slows the hero)
    const pond = r1.ponds.slice().sort((a, b) => b.maxDepth - a.maxDepth)[0];
    let deepK = -1, deepD = 0; for (let k = 0; k < N * N; k++) if (r1.kind[k] === 2 && r1.depth[k] > deepD) { deepD = r1.depth[k]; deepK = k; }
    const dx = -24 + (deepK % N) * .5, dz = -24 + ((deepK / N) | 0) * .5;
    const st = r1.streams[0].points[3];
    out.walk = { deep: +deepD.toFixed(2), deepWalk: A.walkable(dx, dz), waterAtDeep: +(A.waterAt(dx, dz) - A.heightAt(dx, dz)).toFixed(2), streamDepth: +(A.waterAt(st[0], st[1]) - A.heightAt(st[0], st[1])).toFixed(3), streamWalk: A.walkable(st[0], st[1]) };
    // 2) preset back and forth, then remove: the ground comes back each time
    A.placeSpring(14, 4, 'great'); const Hg = A.H.slice(), areaGreat = A.springRes.wetCount;
    A.placeSpring(14, 4, 'spring');
    let d1 = 0; for (let k = 0; k < N * N; k++) d1 = Math.max(d1, Math.abs(A.H[k] - H1[k]));
    A.springs = []; A.applySprings();
    let d0 = 0; for (let k = 0; k < N * N; k++) d0 = Math.max(d0, Math.abs(A.H[k] - H0[k]));
    out.recarve = { areaSpring: r1.wetCount, areaGreat, backToSpring: +d1.toFixed(5), removed: +d0.toFixed(5), resAfterRemove: A.springRes };
    // 3) flat ground: a round sheet the size of the preset
    A.H.fill(3); A.SC.fill(0); A.updateTerrain(); A.placeSpring(0, -10, 'brook');
    let cells = 0; for (let k = 0; k < N * N; k++) if (A.springRes.kind[k]) cells++;
    out.flat = { area: cells * .25, preset: 70, streams: A.springRes.streams.length };
    // 4) a pool on the slope, a spring inside: the kerb blocks, the water inside is level, the overflow leaves by the notch
    A.springs = []; A.SC.fill(0); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) A.H[j * N + i] = shape(-24 + i * .5, -24 + j * .5); A.updateTerrain(); A.applySprings();
    const ep = A.placePool({ x: 6, z: -14 }, { x: 11, z: -10 }, 'rect'), pl = A.pools[0];
    const floorFlat = [[7, -12], [9, -12], [10, -11]].every(([x, z]) => Math.abs(A.heightAt(x, z) - pl.floor) < 1e-4);
    const inside = { water: +(A.waterAt(8.5, -12) - pl.rim).toFixed(3), walk: A.walkable(8.5, -12) }, kerb = { walk: A.walkable(6.15, -12), deck: A.deckAt(6.15, -12, 0) };
    const sBefore = A.springRes.streams.length;
    A.placeSpring(8.5, -12, 'brook'); const r4 = A.springRes;
    const fromNotch = r4.streams.find(q => Math.hypot(q.points[0][0] - (pl.ox > 0 ? 11.4 : pl.ox < 0 ? 5.6 : 8.5), q.points[0][1] - (pl.oz > 0 ? -9.6 : pl.oz < 0 ? -14.4 : -12)) < 1.2);
    const tooSmall = A.placePool({ x: -20, z: -20 }, { x: -19, z: -19 }, 'round');
    out.pool = { err: ep, tooSmall, floorFlat, inside, kerb, sBefore, notch: [pl.ox, pl.oz], streamsAfter: r4.streams.length, fromNotch: !!fromNotch, poolWater: r4.pools.length };
    // 5) undo, save → load
    const nUndo = { springs: A.springs.length, pools: A.pools.length };
    const d = JSON.parse(JSON.stringify(A.serialize())); const wet0 = A.springRes.wetCount;
    A.genFlat(); A.updateTerrain(); A.solveSprings();
    const cleared = { springs: A.springs.length, pools: A.pools.length, res: A.springRes };
    A.deserialize(d);
    out.io = { saved: { springs: (d.springs || []).length, pools: (d.pools || []).length, carve: !!d.springCarve }, cleared, back: { springs: A.springs.length, pools: A.pools.length, wet: A.springRes && A.springRes.wetCount, wet0 } };
    // 6) export
    const { files } = await A.buildExport(), f = n => files.find(x => x.name === n), meta = JSON.parse(f('meta.json').data);
    out.exp = { water: !!f('spring_water.png'), flow: !!f('spring_flow.png'), mask: !!f('spring_mask.png'), sources: meta.springs && meta.springs.sources.length, preset: meta.springs && meta.springs.sources.map(q => q.preset), pools: meta.pools && meta.pools.length,
      poolLevel: meta.pools && +(meta.pools[0].rim - meta.pools[0].waterLevel).toFixed(3), encoding: !!(meta.springs && meta.springs.encoding.water), span: meta.springs && meta.springs.surfaceSpan };
    // the PNG holds the surface: decode one pool texel and compare
    const png = f('spring_water.png').data, img = await createImageBitmap(new Blob([png], { type: 'image/png' })), cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0); const TN = img.width, TS = 48 / (TN - 1), ii = Math.round((8.5 + 24) / TS), jj = Math.round((-12 + 24) / TS), px = cx.getImageData(ii, jj, 1, 1).data;
    out.exp.decoded = { kind: Math.round(px[2] / 80), y: +((px[0] * 256 + px[1]) / 65535 * meta.springs.surfaceSpan + meta.springs.surfaceMin).toFixed(3), want: meta.pools[0].waterLevel, alpha: px[3] };
    // 7) undo takes the last pool spring back
    A.undo && 0;
    return { ...out, nUndo };
  });
  // undo: place a spring through the tool's own path (pointer), then undo
  const u = await p.evaluate(() => {
    const A = window.__app; A.genFlat(); A.H.fill(3); A.updateTerrain(); A.solveSprings();
    A.setTool('spring'); A.state.variant.spring = 'seep';
    A.stroke(2, 2, 1);
    const n1 = A.springs.length; A.undo(); const n2 = A.springs.length; A.redo(); const n3 = A.springs.length;
    return { n1, n2, n3 };
  });
  await b.close();
  const checks = [
    ['水源：低い方（西）へ小川が流れ、溝が掘られる（0.08〜0.22m）', !o.place.err && o.place.streams >= 1 && o.place.westOfSpring && o.place.carvedMax >= .08 && o.place.carvedMax <= .22 + 1e-6],
    ['水源：途中のくぼみは池になる', o.place.ponds.some(q => q[2] > .5)],
    ['歩行：深い池の中ほどは歩けず、浅い小川は歩ける', o.walk.deep > .9 && !o.walk.deepWalk && o.walk.streamDepth > 0 && o.walk.streamDepth < .3 && o.walk.streamWalk],
    ['湧出量を大きくすると水が増え、元に戻すと地面も元どおり', o.recarve.areaGreat > o.recarve.areaSpring && o.recarve.backToSpring < 1e-4],
    ['水源を消すと溝は埋め戻され、水も消える', o.recarve.removed < 1e-4 && o.recarve.resAfterRemove === null],
    ['平らな所：湧出量の広さで止まる（小川 70m² ±10%）', Math.abs(o.flat.area - 70) < 7 && o.flat.streams <= 1],
    ['プール：床は平らで、水は縁の 10cm 下まで張る', !o.pool.err && o.pool.floorFlat && Math.abs(o.pool.inside.water + .1) < .02],
    ['プール：縁は通れず、中の浅い水は歩ける', !o.pool.kerb.walk && o.pool.kerb.deck && o.pool.kerb.deck.kind === 'pool' && o.pool.inside.walk],
    ['プール：中に水源を置くと、あふれ口から小川が出る（小さすぎるプールは作らない）', o.pool.streamsAfter > o.pool.sBefore && o.pool.fromNotch && typeof o.pool.tooSmall === 'string'],
    ['保存・読み込みで水源・プール・溝が戻る', o.io.saved.springs === 1 && o.io.saved.pools === 1 && o.io.saved.carve && o.io.cleared.res === null && o.io.back.springs === 1 && o.io.back.pools === 1 && o.io.back.wet === o.io.back.wet0],
    ['書き出し：spring_water.png・spring_flow.png・spring_mask.png・meta.springs・meta.pools', o.exp.water && o.exp.flow && o.exp.mask && o.exp.sources === 1 && o.exp.pools === 1 && Math.abs(o.exp.poolLevel - .1) < 1e-3 && o.exp.encoding],
    ['書き出し：画像からプールの水面の高さが読める（1cm 以内）', o.exp.decoded.kind === 3 && o.exp.decoded.alpha === 255 && Math.abs(o.exp.decoded.y - o.exp.decoded.want) < .01],
    ['取り消し・やり直しで水源が消え、戻る', u.n1 === 1 && u.n2 === 0 && u.n3 === 1],
    ['ページのエラーなし', errs.length === 0],
  ];
  console.log(JSON.stringify({ ...o, undo: u }));
  if (errs.length) console.log(errs.slice(0, 5));
  let fail = 0; for (const [name, ok] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) fail++; }
  process.exit(fail ? 1 : 0);
})();

// 桟橋とコーラル（Revision 25）：桟橋は陸から水の上へ延び、先は水の上で終わる。床は陸の端で地面に乗り、すぐ水面の 0.9m 上まで上がって平らに続き、
// 先まで歩ける。コーラル 6 種は「海の生き物」のグループにあり、水の中（浅い所）にだけ撒かれ、海岸ツールで消えず、保存・書き出しに入る。
//   PW=<playwright のパス> node tests/pier_coral.js
const { chromium } = require(process.env.PW || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 640 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html') + '#size=48', { timeout: 180000 }); await p.waitForTimeout(8000);
  const CORALS = ['braincoral', 'staghorn', 'pillarcoral', 'seafan', 'tablecoral', 'roundcoral'];
  const o = await p.evaluate(CORALS => {
    const A = window.__app, W = () => A.state.water;
    A.genFlat(); A.applyBiome('beach'); A.makeCoast({ x: -4, z: 0 }, { x: 14, z: 0 }); A.updateTerrain();
    // a pier dragged from the sea to the land: it still starts on the land
    const okPier = A.placeBridge({ x: 16, z: -3 }, { x: 2, z: -3 }, 2.2, 'pier'), br = A.bridges[A.bridges.length - 1];
    const start = { x: br.x1, ground: A.heightAt(br.x1, br.z1) }, end = { x: br.x2, ground: A.heightAt(br.x2, br.z2) };
    const deck = [0, .05, .1, .2, .4, .6, .8, 1].map(t => { const x = br.x1 + (br.x2 - br.x1) * t, z = br.z1; return { t, deck: +(A.bridgeAt(x, z) - W()).toFixed(3), walk: A.walkable(x, z) }; });
    // walk the deck out to its end, frame by frame (the hero cannot jump more than a step: this checks the ramp too)
    A.state.spawn = { x: br.x1 - 1.5, z: br.z1 }; A.setMode('play'); A.player.x = br.x1 - 1.5; A.player.z = br.z1; A.playCam.yaw = -Math.PI / 2;
    A.keys.clear(); A.keys.add('KeyW'); for (let i = 0; i < 60 * 6; i++) A.update(1 / 60); A.keys.clear();
    const walked = { x: +A.player.x.toFixed(2), y: +(A.player.y - W()).toFixed(2) };
    A.setMode('edit');
    const val = A.runValidation(), pierWarn = [...val.warnings, ...val.errors].filter(m => m.includes(br.id || 'bridge')).join(' / ');
    // corals: the group, then scattering over land and water
    const T = CORALS.map(id => A.PROP.findIndex(t => t.id === id)), group = document.querySelector('#types details.pg summary')?.parentElement ? [...document.querySelectorAll('#types details.pg')].map(d => d.querySelector('summary').textContent) : [];
    A.state.palette = 'all'; A.state.types = new Set(T); A.setTool('scatter'); A.state.radius = 9; A.state.density = 1.6;
    for (const [x, z] of [[-12, 6], [-12, -10], [6, 8], [12, 8], [18, -10], [20, 6]]) A.stroke(x, z, 1);
    const corals = A.props.filter(q => CORALS.includes(A.PROP[q[0]].id)), depths = corals.map(q => W() - A.heightAt(q[1], q[2]));
    const above = corals.filter(q => A.heightAt(q[1], q[2]) + A.PROP[q[0]].height * q[4] > W()).length;   // tops above the still water
    const kinds = new Set(corals.map(q => A.PROP[q[0]].id));
    // the coast tool again keeps them
    const before = corals.length; A.makeCoast({ x: -4, z: 0 }, { x: 14, z: 0 });
    const after = A.props.filter(q => CORALS.includes(A.PROP[q[0]].id)).length;
    return { W: W(), okPier, swapped: br.x1 < br.x2, start, end, deck, walked, endX: br.x2, pierWarn, T, groupNames: group, count: before, after, kinds: [...kinds], minDepth: +Math.min(...depths).toFixed(2), maxDepth: +Math.max(...depths).toFixed(2), above, bridge: br };
  }, CORALS);
  // the tree of props in the menu
  o.coralGroup = await p.evaluate(CORALS => { const g = [...document.querySelectorAll('#types details.pg')].find(d => d.querySelector('summary').textContent.includes('海の生き物')); if (!g) return 0; const ids = new Set([...g.querySelectorAll('label[data-type]')].map(l => window.__app.PROP[+l.dataset.type]?.id)); return CORALS.filter(id => ids.has(id)).length; }, CORALS);
  // save → load and the export
  o.io = await p.evaluate(async CORALS => {
    const A = window.__app, n = A.props.filter(q => CORALS.includes(A.PROP[q[0]].id)).length, d = A.serialize();
    A.genFlat(); A.deserialize(JSON.parse(JSON.stringify(d)));
    const back = A.props.filter(q => CORALS.includes(A.PROP[q[0]].id)).length, pier = A.bridges.find(x => x.type === 'pier');
    const { files } = await A.buildExport(), f = nm => files.find(x => x.name === nm), meta = JSON.parse(f('meta.json').data), cat = JSON.parse(f('asset_catalog.json').data);
    const mb = meta.bridges.find(x => x.type === 'pier'), catIds = JSON.stringify(cat);
    return { n, back, pier: !!pier, metaPier: mb ? { rampLength: mb.rampLength, endY: mb.end && mb.end[1], deckCurve: mb.deckCurve } : null, catalogHasCorals: CORALS.every(id => catIds.includes('"' + id + '"')), csvCorals: CORALS.filter(id => f('props.csv').data.includes(id)).length };
  }, CORALS);
  await b.close();
  const lvl = o.deck.filter(d => d.t >= .4);
  const checks = [
    ['桟橋：水から陸へドラッグしても、陸の端から始まる', o.okPier && o.swapped && o.start.ground > o.end.ground],
    ['桟橋：床は陸の端で地面に乗り、水面の 0.9m 上まで上がって平らに続く', Math.abs(o.deck[0].deck - (Math.max(o.start.ground - o.W, 0) + .12)) < .02 && lvl.every(d => Math.abs(d.deck - .9) < .01)],
    ['桟橋：床の上は先まで歩ける', o.deck.every(d => d.walk) && o.walked.x > o.endX - 1.2 && Math.abs(o.walked.y - .9) < .05],
    ['桟橋：検証は先端（水の上）の段差を言わない', !/終点/.test(o.pierWarn)],
    ['コーラル 6 種が「海の生き物」のグループに入る', o.T.every(i => i >= 0) && o.coralGroup === 6],
    ['コーラルは水の中（水深 0.25〜3m）にだけ撒かれる', o.count > 10 && o.kinds.length === 6 && o.minDepth >= .25 - 1e-6 && o.maxDepth <= 3 + 1e-6],
    ['コーラルのてっぺんは静かな水面の下（浅い所では小さくなる）', o.above === 0],
    ['海岸ツールをやり直しても、コーラルは消えない', o.after === o.count],
    ['保存・読み込みで桟橋とコーラルが戻り、書き出しに入る', o.io.back === o.io.n && o.io.pier && o.io.metaPier && o.io.metaPier.rampLength > 0 && /pier/.test(o.io.metaPier.deckCurve) && o.io.catalogHasCorals && o.io.csvCorals === 6],
    ['ページのエラーなし', errs.length === 0],
  ];
  console.log(JSON.stringify({ deck: o.deck, walked: o.walked, endX: o.endX, start: o.start, end: o.end, pierWarn: o.pierWarn, count: o.count, after: o.after, kinds: o.kinds, depth: [o.minDepth, o.maxDepth], above: o.above, coralGroup: o.coralGroup, io: o.io }));
  if (errs.length) console.log(errs.slice(0, 5));
  let fail = 0; for (const [name, ok] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) fail++; }
  process.exit(fail ? 1 : 0);
})();

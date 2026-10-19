// acceptance checks for Astra's Revision 3 review (3 remaining items)
const { chromium } = require(process.env.PW || 'playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 700 } }); const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + require('path').resolve(process.env.EDITOR_DIR || require('path').resolve(__dirname, '..'), 'index.html')); await p.waitForTimeout(6000);
  const R = {};

  // ---------- 1. bridges / stairs over DRY walkable ground: too narrow must not fall back to the ground below
  R.structures = await p.evaluate(() => {
    const A = window.__app, N = 129, id = (i, j) => j * N + i;
    A.genFlat(); A.state.water = -3;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = i / 2 - 32; A.H[id(i, j)] = Math.abs(x) < 3 ? 0 : Math.abs(x) < 4 ? 3 * (Math.abs(x) - 3) : 3; }   // dry valley, banks 3m
    A.updateTerrain(); A.placeBridge({ x: -6, z: 0 }, { x: 6, z: 0 }, 2.4, 'straight'); A.applyCatalog();
    const ag = A.state.agent, W = (x, z) => { A.applyCatalog(); return { walk: A.walkable(x, z), floor: +A.floorAt(x, z).toFixed(2) }; }, r = {};
    r.groundUnderIsWalkable = (() => { const save = A.bridges.splice(0); A.applyCatalog(); const w = A.walkable(0, 0); A.bridges.push(...save); return w; })();
    r.small_centre = W(0, 0);
    ag.radius = 1.3; r.large_centre = W(0, 0); ag.radius = .3;
    r.small_edge1m = W(0, 1.0);                     // deck half width 1.2 - radius 0.3 = 0.9 < 1.0
    r.small_0_8m = W(0, .8);
    r.beside_bridge = W(0, 2.0);                    // off the deck: the valley floor below
    A.O[id(64, 64)] = 2; r.forcedOff = W(0, 0); A.O[id(64, 64)] = 0;
    const deckY = A.bridgeAt(0, 0), t = A.PROP.findIndex(q => q.r > .25);
    A.props.push([t, 0, .2, 0, 1, 0, 1, deckY]); r.obstacleOnDeck = W(0, 0); A.props.pop();
    // stairs on flat dry ground
    A.bridges.splice(0); A.genFlat(); A.state.water = -3; A.updateTerrain();
    A.stairs.push({ x1: -2, z1: 10, x2: 2, z2: 10, w: 1.2, type: 'stone', y1: 3, y2: 4.5 });
    r.stairs_small_centre = W(0, 10); r.stairs_small_off045 = W(0, 10.45);
    ag.radius = .7; r.stairs_large_centre = W(0, 10); ag.radius = .3;
    A.stairs.splice(0); A.applyCatalog();
    return r;
  });

  // ---------- 2. yawOffsetDeg ±90 with asymmetric shapes, yaw 0/90/180/270: internal = exported = contract
  R.yawOffset = await p.evaluate(async () => {
    const A = window.__app, H = A.SIZE / 2, out = {};
    const rotU = (x, z, deg) => { const a = deg * Math.PI / 180; return [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)]; };
    const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    let triggers0 = null;
    for (const off of [0, 90, -90]) {
      A.genFlat(); A.updateTerrain();
      const cat = A.catalogExport();
      cat.types.log.offsets = [0, 1.5]; cat.types.log.yawOffsetDeg = off;                         // asymmetric: one end only
      cat.floorLinks.floor_stairs_up.yawOffsetDeg = off;
      cat.floorLinks.floor_stairs_up.solid = [[0, 0, .5], [1.5, 2.0, .3]];                       // prefab-local, right & far
      A.state.catalog = A.normalizeCatalog(cat); A.applyCatalog();
      const rots = [0, Math.PI / 2, Math.PI, -Math.PI / 2], spots = [[-12, -12], [12, -12], [12, 12], [-12, 12]];
      rots.forEach((r, i) => { const [x, z] = spots[i]; A.placeMarker('up', { x, z }, { x: x + Math.sin(r) * 3, z: z + Math.cos(r) * 3 }); });
      const logT = A.PROP.findIndex(t => t.id === 'log');
      rots.forEach((r, i) => { const [x, z] = spots[i]; A.props.push([logT, x * .4, z * .4, r, 1, 0]); });
      A.ensureIds(); A.rebuildProps(); A.applyCatalog(); A.rebuildMarkers();
      const e = await A.buildExport(), F = n => e.files.find(f => f.name === n).data;
      const c = JSON.parse(F('asset_catalog.json')), meta = JSON.parse(F('meta.json')), csv = F('props.csv').split('\n').slice(1).map(l => l.split(','));
      const internal = []; A.getColliders().query(0, 0, 1e4, q => internal.push([q[0] + H, H - q[1]]));
      const nearest = pt => Math.min(...internal.map(q => d2(pt, q)));
      const up = c.floorLinks.floor_stairs_up; let worst = 0;
      for (const L of meta.floorLinks) {
        const P = [L.position[0], L.position[2]], place = ([x, z]) => { const [rx, rz] = rotU(x, z, L.yawDeg + up.yawOffsetDeg); return [P[0] + rx, P[1] + rz]; };
        up.solid.forEach(([x, z], k) => { const w = place([x, z]); worst = Math.max(worst, d2(w, [L.colliders[k].center[0], L.colliders[k].center[2]]), nearest(w)); });
        worst = Math.max(worst, d2(place([up.trigger.center[0], up.trigger.center[2]]), [L.trigger.center[0], L.trigger.center[2]]), d2(place([up.arrival[0], up.arrival[2]]), [L.arrival[0], L.arrival[2]]));
      }
      for (const r of csv.filter(r => r[1] === 'log')) {
        const P = [+r[3], +r[5]], yaw = +r[6], s = +r[7];
        for (const o of c.types.log.offsets) { const [rx, rz] = rotU(o * s, 0, yaw + c.types.log.yawOffsetDeg); worst = Math.max(worst, nearest([P[0] + rx, P[1] + rz])); }
      }
      const trig = meta.floorLinks.map(L => [L.trigger.center[0], L.trigger.center[2], L.arrival[0], L.arrival[2]]);
      if (off === 0) triggers0 = trig;
      const shift = Math.max(...trig.map((t, i) => Math.max(d2(t, triggers0[i]), d2(t.slice(2), triggers0[i].slice(2)))));
      out['off' + off] = { worstMismatch_m: +worst.toFixed(4), triggerArrivalShiftVsOff0_m: +shift.toFixed(4), catalogKeepsSolid: JSON.stringify(up.solid) === JSON.stringify([[0, 0, .5], [1.5, 2, .3]]), logOffsetsKept: c.types.log.offsets.join() };
    }
    A.state.catalog = { types: {}, floorLinks: {} }; A.applyCatalog();
    return out;
  });

  // ---------- 3. corrupt height / mask arrays are rejected and leave the current map untouched
  R.load = await p.evaluate(() => {
    const A = window.__app, N = 129;
    A.genSample(7);
    const b64 = u => { let s = ''; for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode(...u.subarray(i, i + 32768)); return btoa(s); };
    const f32 = arr => b64(new Uint8Array(new Float32Array(arr).buffer));
    const base = JSON.parse(JSON.stringify(A.serialize()));
    const state = () => { let h = 0; for (let k = 0; k < A.H.length; k++) h = (h * 31 + Math.round(A.H[k] * 1000)) | 0; return JSON.stringify([h, A.state.roomId, A.props.length, A.props.slice(0, 5).map(p => p[8]), A.markers.map(m => m.id), Array.from(A.O.slice(0, 50))]); };
    const tries = {}, before = state();
    const t = (name, f) => { const d = JSON.parse(JSON.stringify(base)); f(d); let res; try { A.deserialize(d); res = 'ACCEPTED'; } catch (e) { res = e.message.slice(0, 90); } tries[name] = { result: res, unchanged: state() === before }; };
    const H0 = Array.from(A.H);
    t('NaN height', d => { const h = H0.slice(); h[100] = NaN; d.heightsF32 = f32(h); });
    t('Infinity height', d => { const h = H0.slice(); h[5] = Infinity; d.heightsF32 = f32(h); });
    t('1 element', d => { d.heightsF32 = f32([2]); });
    t('too many elements', d => { d.heightsF32 = f32([...H0, 1]); });
    t('odd byte length', d => { const u = new Uint8Array(N * N * 4 - 1); d.heightsF32 = b64(u); });
    t('legacy cm short', d => { delete d.heightsF32; d.heightsCm = b64(new Uint8Array(10)); });
    t('splat wrong length', d => { d.splat = b64(new Uint8Array(N * N * 9 + 3)); });
    t('walkOverride value 7', d => { const u = new Uint8Array(N * N); u[3] = 7; d.walkOverride = b64(u); });
    t('not base64', d => { d.heightsF32 = '@@@not base64@@@'; });
    t('props missing', d => { delete d.props; });
    // valid round trips: new format and the old centimetre format
    const ok = {};
    try { A.deserialize(JSON.parse(JSON.stringify(base))); ok.newFormat = state() === before; } catch (e) { ok.newFormat = e.message; }
    try { const d = JSON.parse(JSON.stringify(base)); const hc = new Int16Array(N * N); for (let k = 0; k < N * N; k++) hc[k] = Math.round(H0[k] * 100); delete d.heightsF32; d.heightsCm = b64(new Uint8Array(hc.buffer)); A.deserialize(d);
      let maxErr = 0; for (let k = 0; k < N * N; k++) maxErr = Math.max(maxErr, Math.abs(A.H[k] - H0[k])); ok.oldFormat_maxHeightDiff_m = +maxErr.toFixed(4); ok.oldFormat_idsKept = A.props.map(p => p[8]).join() === base.props.map(p => p[8]).join(); } catch (e) { ok.oldFormat = e.message; }
    A.genSample(7);
    return { tries, validLoads: ok };
  });

  // ---------- the sample stays clean
  R.sample = await p.evaluate(() => { const A = window.__app; A.genSample(7); const v = A.runValidation(); return { errors: v.errors, warnings: v.warnings, walkable: v.stats.walkableCells, reachable: v.stats.reachableFromSpawn }; });
  console.log(JSON.stringify(R, null, 1)); console.log(errs.join('\n') || 'no errors'); await b.close();
})();

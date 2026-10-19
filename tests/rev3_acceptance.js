// acceptance checks for Astra's revision-2 review
// usage: PW=<path to playwright> node tests/rev3_acceptance.js
const { chromium } = require(process.env.PW || 'playwright'); const crypto = require('crypto');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 700 } }); const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + require('path').resolve(__dirname, '../index.html')); await p.waitForTimeout(6000);
  const R = {};

  // ---------- 5 + ids: deterministic re-export, sha256 correctness, ids kept through save/load
  R.hash = await p.evaluate(async () => {
    const A = window.__app, td = new TextDecoder();
    const ex = async () => { const r = await A.buildExport(); return r; };
    const e1 = await ex(), e2 = await ex();
    const same = e1.manifest.files.every((f, i) => f.sha256 === e2.manifest.files[i].sha256);
    const ids1 = A.props.map(p => p[8]).join(), room1 = A.state.roomId;
    const saved = JSON.parse(JSON.stringify(A.serialize())); A.deserialize(saved);
    const e3 = await ex();
    const ids3 = A.props.map(p => p[8]).join();
    // sub-centimetre edit: RAW changes, saved cm heights do not
    A.H[64 * 129 + 64] += .002; A.updateTerrain();
    const e4 = await ex();
    const rawChanged = e4.manifest.files.find(f => f.name === 'heightmap_r16.raw').sha256 !== e3.manifest.files.find(f => f.name === 'heightmap_r16.raw').sha256;
    const mapSame = e4.manifest.files.find(f => f.name === 'map.json').sha256 === e3.manifest.files.find(f => f.name === 'map.json').sha256;
    // catalog edit
    const cat = A.catalogExport(); cat.types.oak.assetKey = 'tdj/oak_v2'; A.state.catalog = A.normalizeCatalog(cat); A.applyCatalog();
    const e5 = await ex();
    const raw = e5.files.find(f => f.name === 'heightmap_r16.raw').data;
    let bin = ''; for (let i = 0; i < raw.length; i += 32768) bin += String.fromCharCode(...raw.subarray(i, i + 32768));
    return {
      unedited: { sameHash: e1.manifest.contentHash === e2.manifest.contentHash, sameFiles: same, rev: [e1.manifest.revision, e2.manifest.revision] },
      afterReload: { sameHash: e3.manifest.contentHash === e1.manifest.contentHash, idsKept: ids1 === ids3, roomKept: room1 === A.state.roomId, rev: e3.manifest.revision },
      subCm: { rawChanged, mapJsonUnchanged: mapSame, hashChanged: e4.manifest.contentHash !== e3.manifest.contentHash, rev: e4.manifest.revision },
      catalogEdit: { hashChanged: e5.manifest.contentHash !== e4.manifest.contentHash, rev: e5.manifest.revision },
      rawB64: btoa(bin), rawSha: e5.manifest.files.find(f => f.name === 'heightmap_r16.raw').sha256,
      emptySha: A.sha256(new Uint8Array(0)), abcSha: A.sha256(new TextEncoder().encode('abc')),
      def: e5.manifest.contentHashDefinition, metaHasVolatile: ['revision', 'exportedAt', 'contentHash'].filter(k => k in JSON.parse(e5.files.find(f => f.name === 'meta.json').data)),
    };
  });
  R.hash.nodeShaMatches = crypto.createHash('sha256').update(Buffer.from(R.hash.rawB64, 'base64')).digest('hex') === R.hash.rawSha;
  R.hash.knownVectors = R.hash.emptySha === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' && R.hash.abcSha === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
  delete R.hash.rawB64;

  // ---------- 1: catalog round trip through the real file input
  await p.evaluate(() => window.__app.genSample(7));
  const cat = await p.evaluate(() => { const c = window.__app.catalogExport();
    c.floorLinks.floor_magic_circle.assetKey = 'tdj/dungeon/warp_A'; c.floorLinks.floor_stairs_up.assetKey = 'tdj/dungeon/up_A'; c.floorLinks.floor_stairs_down.assetKey = 'tdj/dungeon/down_A';
    c.floorLinks.floor_stairs_up.solid.push([1.5, 2.0, .3]);   // asymmetric test collider: right side, far end (prefab local)
    c.types.oak.height = 9.5; c.types.log.offsets = [-1.2, 0, 1.2]; return c; });
  await p.setInputFiles('#catalogFile', { name: 'cat.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(cat)) }); await p.waitForTimeout(800);
  R.catalog = await p.evaluate(async () => {
    const A = window.__app;
    const e = await A.buildExport(), F = n => JSON.parse(e.files.find(f => f.name === n).data);
    const c1 = F('asset_catalog.json'), m1 = F('meta.json');
    const saved = JSON.parse(JSON.stringify(A.serialize())); A.deserialize(saved);
    const e2 = await A.buildExport(), c2 = JSON.parse(e2.files.find(f => f.name === 'asset_catalog.json').data), m2 = JSON.parse(e2.files.find(f => f.name === 'meta.json').data);
    const keys = c => ['floor_magic_circle', 'floor_stairs_up', 'floor_stairs_down'].map(k => c.floorLinks[k].assetKey);
    return { exported: keys(c1), afterReload: keys(c2), metaKeys: m2.floorLinks.map(l => l.assetKey), oakHeight: [c1.types.oak.height, c2.types.oak.height], logOffsets: c2.types.log.offsets,
      upSolidCount: c2.floorLinks.floor_stairs_up.solid.length, upSolidLast: c2.floorLinks.floor_stairs_up.solid.at(-1) };
  });

  // ---------- 4: four directions — prefab-local catalog shapes rotated by Unity yaw must equal the exported world values
  R.axes = await p.evaluate(async () => {
    const A = window.__app; A.genFlat(); A.updateTerrain();
    const rots = [0, Math.PI / 2, Math.PI, -Math.PI / 2], spots = [[-12, -12], [12, -12], [12, 12], [-12, 12]];
    rots.forEach((r, i) => { const [x, z] = spots[i]; A.placeMarker('up', { x, z }, { x: x + Math.sin(r) * 3, z: z + Math.cos(r) * 3 }); });
    rots.forEach((r, i) => { const [x, z] = spots[i]; A.props.push([A.PROP.findIndex(t => t.id === 'log'), x + 6 * Math.sign(-x || 1) * 0 + 0, z + (z < 0 ? 5 : -5), r, 1, 0]); });
    A.ensureIds(); A.rebuildProps(); A.applyCatalog(); A.rebuildMarkers();
    const e = await A.buildExport(), F = n => e.files.find(f => f.name === n).data;
    const cat = JSON.parse(F('asset_catalog.json')), meta = JSON.parse(F('meta.json')), csv = F('props.csv').split('\n').slice(1).map(l => l.split(','));
    const rot = (x, z, deg) => { const a = deg * Math.PI / 180; return [x * Math.cos(a) + z * Math.sin(a), -x * Math.sin(a) + z * Math.cos(a)]; };
    const d2 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
    const up = cat.floorLinks.floor_stairs_up; let worst = 0; const rows = [];
    for (const L of meta.floorLinks) {
      const P = [L.position[0], L.position[2]], w = ([x, , z]) => { const [rx, rz] = rot(x, z, L.yawDeg); return [P[0] + rx, P[1] + rz]; };
      const errT = d2(w(up.trigger.center), [L.trigger.center[0], L.trigger.center[2]]), errA = d2(w(up.arrival), [L.arrival[0], L.arrival[2]]);
      const errC = Math.max(...up.solid.map(([x, z], k) => d2(w([x, 0, z]), [L.colliders[k].center[0], L.colliders[k].center[2]])));
      const f = rot(0, -1, L.yawDeg), errF = d2(f, L.forward);
      worst = Math.max(worst, errT, errA, errC, errF); rows.push({ yaw: L.yawDeg, errT: +errT.toFixed(4), errA: +errA.toFixed(4), errC: +errC.toFixed(4), errF: +errF.toFixed(4) });
    }
    // the asymmetric collider (prefab +X, +Z) must sit to the right of the walk-in direction and beyond the trigger
    const L0 = meta.floorLinks[0], last = L0.colliders.at(-1).center, P0 = [L0.position[0], L0.position[2]], walkIn = [-L0.forward[0], -L0.forward[1]], right = [walkIn[1], -walkIn[0]];
    const rel = [last[0] - P0[0], last[2] - P0[1]], side = rel[0] * right[0] + rel[1] * right[1], ahead = rel[0] * walkIn[0] + rel[1] * walkIn[1];
    // props: log offsets along prefab X, rotated by CSV yaw, must equal the editor's internal colliders (converted to Unity)
    const logOff = cat.types.log.offsets, H = A.SIZE / 2; let worstLog = 0; const cols = [];
    A.getColliders().query(0, 0, 1e4, c => cols.push([c[0] + H, H - c[1], c[2]]));
    for (const r of csv.filter(r => r[1] === 'log')) {
      const x = +r[3], z = +r[5], yaw = +r[6], s = +r[7];
      for (const o of logOff) { const [ox, oz] = rot(o * s, 0, yaw), pt = [x + ox, z + oz]; worstLog = Math.max(worstLog, Math.min(...cols.map(c => d2(pt, c)))); }
    }
    return { rows, worst: +worst.toFixed(4), asym: { side: +side.toFixed(3), ahead: +ahead.toFixed(3) }, worstLog: +worstLog.toFixed(4), logCount: csv.filter(r => r[1] === 'log').length };
  });

  // ---------- 3: bridges / stairs go through the common walk check
  R.bridge = await p.evaluate(() => {
    const A = window.__app; A.genFlat(); A.state.catalog = { types: {}, floorLinks: {} }; A.applyCatalog();
    const N = 129, id = (i, j) => j * N + i;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = i / 2 - 32; if (Math.abs(x) < 3) A.H[id(i, j)] = -1.5; }   // a trench full of water
    A.updateTerrain(); A.placeBridge({ x: -6, z: 0 }, { x: 6, z: 0 }, 2.4, 'straight'); A.applyCatalog();
    const r = {}; const W = () => { A.applyCatalog(); return A.walkable(0, 0); };
    r.smallAgent = W(); A.state.agent.radius = 1.3; r.largeAgent = W(); A.state.agent.radius = .3;
    const deckY = A.bridgeAt(0, 0);
    let rock = -1, bestH = 1e9; A.PROP.forEach((t, i) => { if (t.r > .25 && t.height < bestH) { bestH = t.height; rock = i; } });
    const tid = A.PROP[rock].id; r.obstacleType = tid; r.deckY = +deckY.toFixed(2);
    A.props.push([rock, 0, .2, 0, 1, 0, 1, deckY]); r.obstacleOnDeck = W();
    // same obstacle standing in the trench below the deck: catalog height decides whether it reaches the deck
    A.props.pop(); A.props.push([rock, 0, .2, 0, 1, 0, 1, -1.5]);
    A.state.catalog = { types: { [tid]: { height: 1 } }, floorLinks: {} }; r.under_height1 = W();
    A.state.catalog = { types: { [tid]: { height: 5 } }, floorLinks: {} }; r.under_height5 = W();
    A.state.catalog = { types: {}, floorLinks: {} }; A.props.pop();
    A.O[id(64, 64)] = 2; r.forcedOffOnDeck = W(); A.O[id(64, 64)] = 0;
    r.stillWalkable = W();
    return r;
  });

  // ---------- 2: safe area, diagonal squeeze, isolated arrival, invalid values
  R.validation = await p.evaluate(() => {
    const A = window.__app, N = 129, id = (i, j) => j * N + i, msgs = v => [...v.errors, ...v.warnings];
    const out = {};
    // (a) the old sample position of port_0002: centre fine, safe area reaches unwalkable ground
    A.genSample(7); const port = A.markers.find(m => m.id === 'port_0002'); port.x = -28.5; A.rebuildMarkers();
    out.safeAreaOld = msgs(A.runValidation()).filter(s => s.includes('port_0002'));
    // (b) diagonal-only opening into a walled pen
    A.genFlat(); A.updateTerrain(); A.state.spawn = { x: -20, z: -20 };
    const i0 = 70, j0 = 70, i1 = 80, j1 = 80;
    for (let i = i0; i <= i1; i++) { A.O[id(i, j0)] = 2; A.O[id(i, j1)] = 2; } for (let j = j0; j <= j1; j++) { A.O[id(i0, j)] = 2; A.O[id(i1, j)] = 2; }
    A.O[id(i0, j0)] = 0;   // open only the corner cell: inside touches it diagonally
    A.updateTerrain(); A.placeMarker('chest', { x: 75 / 2 - 32, z: 75 / 2 - 32 }); A.markers.at(-1).r = .5;
    out.diagonal = msgs(A.runValidation()).filter(s => s.includes(A.markers.at(-1).id));
    // (c) magic circle whose arrival lands in a closed pen
    A.genFlat(); A.updateTerrain(); A.state.spawn = { x: -20, z: -20 };
    for (let i = 70; i <= 82; i++) { A.O[id(i, 70)] = 2; A.O[id(i, 82)] = 2; } for (let j = 70; j <= 82; j++) { A.O[id(70, j)] = 2; A.O[id(82, j)] = 2; }
    A.updateTerrain();
    const cx = 76 / 2 - 32, cz = 76 / 2 - 32;   // arrival = centre of the pen, circle 2.4m in front
    A.placeMarker('warp', { x: cx, z: cz - 2.4 - 3.6 }, { x: cx, z: cz });   // facing +z: arrival at +2.4 ... adjust below
    const w = A.markers.at(-1); const a = A.linkArrival(w); w.x += cx - a.x; w.z += cz - a.z; A.rebuildMarkers();
    out.isolatedArrival = msgs(A.runValidation()).filter(s => s.includes(w.id));
    // (d) the normal sample stays clean
    A.genSample(7); const v = A.runValidation(); out.sample = { errors: v.errors, warnings: v.warnings, notChecked: v.notChecked.length, checks: v.checks.length };
    // (e) invalid values are rejected at load
    const base = JSON.parse(JSON.stringify(A.serialize())), tries = {};
    const t = (name, f) => { const d = JSON.parse(JSON.stringify(base)); f(d); try { A.deserialize(d); tries[name] = 'ACCEPTED'; } catch (e) { tries[name] = e.message.slice(0, 80); } };
    t('NaN prop', d => { d.props[0][1] = NaN; });
    t('Infinity marker', d => { d.markers[0].x = Infinity; });
    t('negative radius', d => { d.markers.find(m => m.kind === 'enemy').r = -1; });
    t('zero-length bridge', d => { const b0 = d.bridges[0]; b0.x2 = b0.x1; b0.z2 = b0.z1; });
    t('out of map', d => { d.stairs[0].x2 = 500; });
    t('unknown kind', d => { d.markers[0].kind = 'teleporter'; });
    out.rejects = tries;
    A.genSample(7);
    return out;
  });
  console.log(JSON.stringify(R, null, 1)); console.log(errs.join('\n') || 'no errors'); await b.close();
})();

// Export grid vs. Unity Terrain, and secret passage shape vs. holes, for every selectable map size.
// usage: PW=<path to playwright> node tests/rev5_terrain_grid.js
const { chromium } = require(process.env.PW || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const url = 'file://' + path.resolve(process.env.EDITOR_DIR || path.resolve(__dirname, '..'), 'index.html');
  const out = {}, errs = [];
  for (const size of [24, 32, 48, 64, 96, 128]) {
    const p = await b.newPage({ viewport: { width: 900, height: 600 } }); p.on('pageerror', e => errs.push(size + ' PAGEERR ' + e.message));
    await p.goto(url + '#size=' + size); await p.waitForTimeout(4500);
    out[size] = await p.evaluate(async size => {
      const A = window.__app, N = Math.round(size * 2 + 1), id = (i, j) => j * N + i, HALF = size / 2;
      let kind;
      if (size === 48) { A.genSample2(); kind = 'sample2'; }
      else if (size === 64) { A.genSample(7); kind = 'sample'; }
      else {   // flat room with a rock ridge across the middle and a secret passage through it
        kind = 'flat+passage'; A.genFlat();
        for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = i / 2 - HALF, z = j / 2 - HALF; if (Math.abs(z) < 2.2) A.H[id(i, j)] = 8 - Math.max(0, Math.abs(z) - 1.6) * 8; if (Math.abs(x) <= 1.05 && Math.abs(z) < 3.6) A.O[id(i, j)] = 3; }
        A.state.spawn = { x: 0, z: -6 }; A.updateTerrain(); A.placeMarker('chest', { x: 0, z: 6 }); A.markers.at(-1).r = .5;
      }
      A.updateTerrain();
      const e = await A.buildExport(), F = n => e.files.find(f => f.name === n)?.data, meta = JSON.parse(F('meta.json')), v = e.validation;
      const TN = meta.terrain.heightmapResolution, TS = size / (TN - 1), mn = meta.terrain.editorYOfZero, range = meta.terrain.heightRange;
      const dims = async d => { const bm = await createImageBitmap(new Blob([d], { type: 'image/png' })); return bm.width === bm.height ? bm.width : -1; };
      const pngDims = {}; for (const f of e.files) if (f.name.endsWith('.png')) pngDims[f.name] = await dims(f.data);
      // decode the RAW heightmap and sample it bilinearly in Unity coordinates
      const raw = F('heightmap_r16.raw'), dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength), hRaw = (c, r) => dv.getUint16((r * TN + c) * 2, true) / 65535 * range + mn;
      const rawAt = (xu, zu) => { const fx = xu / TS, fz = zu / TS, c = Math.min(Math.floor(fx), TN - 2), r = Math.min(Math.floor(fz), TN - 2), u = fx - c, w = fz - r; return (hRaw(c, r) * (1 - u) + hRaw(c + 1, r) * u) * (1 - w) + (hRaw(c, r + 1) * (1 - u) + hRaw(c + 1, r + 1) * u) * w; };
      const corners = [[0, 0], [size, 0], [0, size], [size, size]].map(([xu, zu]) => +Math.abs(rawAt(xu, zu) - A.heightAt(xu - HALF, HALF - zu)).toFixed(4));
      // editor heights vs export heights everywhere on a 0.25 m probe grid (bilinear both)
      let maxDiff = 0; for (let zu = 0; zu <= size; zu += .25) for (let xu = 0; xu <= size; xu += .25) maxDiff = Math.max(maxDiff, Math.abs(rawAt(xu, zu) - A.heightAt(xu - HALF, HALF - zu)));
      const sp = meta.spawnPoints[0].position, spawnErr = Math.abs(meta.spawnPoints[0].position[1] + mn - A.floorAt(A.state.spawn.x, A.state.spawn.z));
      const spawnWorld = [+(A.state.spawn.x + HALF).toFixed(3), +(HALF - A.state.spawn.z).toFixed(3)];
      // walkable.png on the export grid: BFS from the spawn (8 neighbours, no corner cutting) to the chest / sanctum
      const wbm = await createImageBitmap(new Blob([F('walkable.png')], { type: 'image/png' })), cv = new OffscreenCanvas(TN, TN), g = cv.getContext('2d'); g.drawImage(wbm, 0, 0);
      const wd = g.getImageData(0, 0, TN, TN).data, W = (c, r) => c >= 0 && r >= 0 && c < TN && r < TN && wd[((TN - 1 - r) * TN + c) * 4] > 127;   // image row 0 = z max
      const seen = new Uint8Array(TN * TN), q = [], s0 = [Math.round(sp[0] / TS), Math.round(sp[2] / TS)];
      if (W(...s0)) { seen[s0[1] * TN + s0[0]] = 1; q.push(s0); }
      for (let h = 0; h < q.length; h++) { const [c, r] = q[h]; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { if (!dc && !dr) continue; const nc = c + dc, nr = r + dr; if (!W(nc, nr) || seen[nr * TN + nc]) continue; if (dc && dr && (!W(c + dc, r) || !W(c, r + dr))) continue; seen[nr * TN + nc] = 1; q.push([nc, nr]); } }
      const reachAt = ([xu, , zu]) => { const c = Math.round(xu / TS), r = Math.round(zu / TS); for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (seen[(r + dr) * TN + c + dc]) return true; return false; };
      const targets = [...meta.chestSpots.map(c => c.position), ...meta.floorLinks.map(l => l.trigger.center)];
      // passage shape vs holes vs mesh, recomputed independently from the editor arrays
      const res = { kind, TN, TS: +TS.toFixed(4), unityOK: [33, 65, 129, 257, 513, 1025, 2049, 4097].includes(TN), holesRes: meta.terrain.holesResolution,
        rawBytes: [F('heightmap_r16.raw').length === TN * TN * 2, F('walk_floor_r16.raw').length === TN * TN * 2], pngDims,
        cornersErr_m: corners, maxHeightDiffVsEditor_m: +maxDiff.toFixed(4), spawnWorld, spawnMeta: [sp[0], sp[2]], spawnHeightErr_m: +spawnErr.toFixed(4),
        exportGridReach: { reachableVertices: q.length, targets: targets.length, targetsReached: targets.filter(reachAt).length },
        errors: v.errors, warnings: v.warnings };
      const sec = meta.secretPassages;
      if (sec.present) {
        const hb = await createImageBitmap(new Blob([F('holes.png')], { type: 'image/png' })), HRN = TN - 1, hc = new OffscreenCanvas(HRN, HRN), hg = hc.getContext('2d'); hg.drawImage(hb, 0, 0);
        const hd = hg.getImageData(0, 0, HRN, HRN).data, hole = (ci, cj) => hd[((HRN - 1 - cj) * HRN + ci) * 4] < 128;   // cj: Unity z cell index
        // passage-under-rock squares in Unity coordinates
        const sq = []; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = id(i, j); if (A.O[k] === 3 && A.H[k] > A.F[k] + .3) { const xu = i / 2, zu = size - j / 2; sq.push([xu - .25, xu + .25, zu - .25, zu + .25]); } }
        const G = .125, n = Math.round(size / G);
        let rockCells = 0, rockInHole = 0, holeCells = 0, holeFine = 0, holeOverlapsRock = 0;
        const fineRock = new Set(); for (const [x0, x1, z0, z1] of sq) for (let a = Math.round(x0 / G); a < Math.round(x1 / G); a++) for (let c = Math.round(z0 / G); c < Math.round(z1 / G); c++) fineRock.add(c * n + a);
        for (const f of fineRock) { rockCells++; const a = f % n, c = (f / n) | 0; if (hole(Math.floor((a + .5) * G / TS), Math.floor((c + .5) * G / TS))) rockInHole++; }
        // mesh footprint (floor + cap triangles) on the same raster
        const mesh = JSON.parse(F('secret_passages_mesh.json')), covered = new Set();
        const holes2 = (ci, cj) => { for (let a = Math.round(ci * TS / G); a < Math.round((ci + 1) * TS / G); a++) for (let c = Math.round(cj * TS / G); c < Math.round((cj + 1) * TS / G); c++) if (fineRock.has(c * n + a)) return true; return false; };
        for (const m of mesh.passages) for (const sub of ['floor', 'cap']) { const t = m.triangles[sub], V = m.vertices;
          for (let k = 0; k < t.length; k += 3) { const P = [t[k], t[k + 1], t[k + 2]].map(ix => [V[ix * 3], V[ix * 3 + 2]]);
            const xs = P.map(p => p[0]), zs = P.map(p => p[1]);
            for (let a = Math.floor(Math.min(...xs) / G); a <= Math.ceil(Math.max(...xs) / G); a++) for (let c = Math.floor(Math.min(...zs) / G); c <= Math.ceil(Math.max(...zs) / G); c++) {
              const px = (a + .5) * G, pz = (c + .5) * G, s = (p, q2) => (q2[0] - p[0]) * (pz - p[1]) - (q2[1] - p[1]) * (px - p[0]);
              const d1 = s(P[0], P[1]), d2 = s(P[1], P[2]), d3 = s(P[2], P[0]); if ((d1 >= 0 && d2 >= 0 && d3 >= 0) || (d1 <= 0 && d2 <= 0 && d3 <= 0)) covered.add(c * n + a);
            } } }
        // stairs-down pits are holes too; their hole cells are covered by the stairsDown prefab, not by the passage mesh
        const cat = JSON.parse(F('asset_catalog.json')), pit = cat.floorLinks.floor_stairs_down.pit, pitCell = new Set();
        for (const L of meta.floorLinks.filter(l => l.kind === 'stairsDown')) {
          const a = L.yawDeg * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
          for (let cj = 0; cj < HRN; cj++) for (let ci = 0; ci < HRN; ci++) {
            let hit = false;
            for (let u = .0625; u < TS && !hit; u += .125) for (let w = .0625; w < TS && !hit; w += .125) {
              const dx = ci * TS + u - L.position[0], dz = cj * TS + w - L.position[2], lx = dx * ca - dz * sa, lz = dx * sa + dz * ca;   // into prefab-local (inverse Unity yaw)
              if (Math.abs(lx) < pit.width / 2 && lz > pit.zFrom && lz < pit.zTo) hit = true;
            }
            if (hit) pitCell.add(cj * HRN + ci);
          }
        }
        let uncovered = 0, pitHoleCells = 0;
        for (let cj = 0; cj < HRN; cj++) for (let ci = 0; ci < HRN; ci++) if (hole(ci, cj) && pitCell.has(cj * HRN + ci) && !holes2(ci, cj)) pitHoleCells++;
        for (let cj = 0; cj < HRN; cj++) for (let ci = 0; ci < HRN; ci++) if (hole(ci, cj) && !(pitCell.has(cj * HRN + ci) && !holes2(ci, cj))) {
          holeCells++; let touches = false;
          for (let a = Math.round(ci * TS / G); a < Math.round((ci + 1) * TS / G); a++) for (let c = Math.round(cj * TS / G); c < Math.round((cj + 1) * TS / G); c++) { holeFine++; if (!covered.has(c * n + a)) uncovered++; if (fineRock.has(c * n + a)) touches = true; }
          if (touches) holeOverlapsRock++;
        }
        const pc = sec.passages[0].check;
        res.passage = { outlineLoops: sec.passages[0].outline.length, holeCells, holeCellsTouchingPassageRock: holeOverlapsRock, passageUnderRock_m2: rockCells * G * G, passageUnderRockInsideHoles_m2: rockInHole * G * G,
          holeArea_m2: holeFine * G * G, holeAreaNotCoveredByMesh_m2: uncovered * G * G, stairsDownPitHoleCells: pitHoleCells, stairsDownPitHoleCellsInMeta: meta.floorLinks.filter(l => l.kind === 'stairsDown').map(l => l.pitHoleCells), editorCheck: pc };
      }
      return res;
    }, size);
    await p.close();
  }
  console.log(JSON.stringify(out, null, 1)); console.log(errs.join('\n') || 'no errors'); await b.close();
})();

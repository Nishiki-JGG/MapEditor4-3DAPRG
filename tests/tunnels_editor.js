// トンネル（Revision 30）：トンネルツールで、崖の前の地面から台地の中へマウスでドラッグして掘る。端から続きを掘ると曲がり、
// 反対側の地面まで掘ると出口になる。途中から枝分かれ。入口だけ地形に穴、口のまわりの地面は作り直す。中の床は歩けて壁は通れず、
// 屋根の上の地面も歩ける（2 層）。中に入ると屋根を透かす。崖石の片づけ、灯り、取り消し、保存・読み込み、書き出し。
// あわせて、プールツールがマウスのドラッグで作れること（Revision 28 の抜けの修正）。
//   PW=<playwright のパス> node tests/tunnels_editor.js
const { chromium } = require(process.env.PW || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 700 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html') + '#size=48', { timeout: 180000 }); await p.waitForTimeout(8000);
  if (await p.evaluate(() => !document.body.classList.contains('nopanel'))) await p.click('#menuBtn');   // the menu would take the clicks
  await p.waitForTimeout(500);
  await p.evaluate(() => { const A = window.__app; A.genFlat(); A.applyBiome('forest');
    for (let j = 0; j < 97; j++) for (let i = 0; i < 97; i++) { const x = -24 + i * .5, z = -24 + j * .5; A.H[j * 97 + i] = 3 + x * .01 + Math.sin(z * .4) * .05; }
    A.updateTerrain(); A.setTool('plateau'); A.state.radius = 9; A.state.strength = 1; A.stroke(14, 0, 30); A.stroke(14, 0, 30); A.updateTerrain(); A.rebuildProps();
    // cliff stones along the plateau's west face, where the mouth will be
    const T = A.PROP.findIndex(t => t.id === 'rock'); for (let z = -2; z <= 2; z += 1) A.props.push([T, 4.6, z, 0, 1, 0]); A.rebuildProps(); });
  await p.waitForTimeout(4000);
  // drag with the mouse from one ground point to another (world → screen through the editor camera)
  const drag = async (a, c) => {
    const pts = await p.evaluate(([a, c]) => { const A = window.__app; A.cam.target.set((a.x + c.x) / 2, A.heightAt((a.x + c.x) / 2, (a.z + c.z) / 2), (a.z + c.z) / 2); A.cam.dist = 34; A.cam.pitch = 1.2; A.cam.yaw = 0; A.update(1 / 60); A.render(); A.camera.updateMatrixWorld();
      const r = A.renderer.domElement.getBoundingClientRect(), s = q => { const v = new THREE.Vector3(q.x, A.heightAt(q.x, q.z), q.z).project(A.camera); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height]; };
      return [s(a), s(c)]; }, [a, c]);
    await p.mouse.move(pts[0][0], pts[0][1]); await p.mouse.down(); for (let k = 1; k <= 8; k++) await p.mouse.move(pts[0][0] + (pts[1][0] - pts[0][0]) * k / 8, pts[0][1] + (pts[1][1] - pts[0][1]) * k / 8); await p.mouse.up();
    await p.waitForTimeout(200);
  };
  await p.evaluate(() => { const A = window.__app; A.setTool('tunnel'); A.state.variant.tunnel = 'masonry'; A.state.tunnelSize = 'normal'; A.state.tunnelSlope = 'flat'; });
  await drag({ x: 1, z: 0 }, { x: 12, z: 0 });
  const d1 = await p.evaluate(() => { const A = window.__app; return { n: A.tunnels.length, pts: A.tunnels[0] && A.tunnels[0].pts.length, y0: A.tunnels[0] && A.tunnels[0].pts[0].y, ground: A.heightAt(1, 0), style: A.tunnels[0] && A.tunnels[0].style }; });
  await drag({ x: 12, z: 0 }, { x: 12, z: -11.5 });   // carry on from the end, out through the south side
  const o = await p.evaluate(() => {
    const A = window.__app, t = A.tunnels[0], out = {};
    out.extend = { n: A.tunnels.length, pts: t.pts.length, exitY: t.pts[2].y, exitGround: A.heightAt(12, -11.5) };
    // the holes: only near the two mouths
    const hd = A.tunnelHoleTex.image.data, M = 96, cells = []; for (let k = 0; k < M * M; k++) if (hd[k * 4] > 128) cells.push([-24 + (k % M + .5) * .5, -24 + (((k / M) | 0) + .5) * .5]);
    out.holes = { n: cells.length, west: cells.filter(c => c[0] < 6).length, south: cells.filter(c => c[1] < -6).length, deep: cells.filter(c => Math.hypot(c[0] - 12, c[1]) < 4).length };
    out.stones = A.props.filter(q => A.PROP[q[0]].id === 'rock' && Math.abs(q[2]) < 2 && Math.abs(q[1] - 4.6) < .1).length;
    // walking: floor inside, walls, and the ground over the roof (two floors)
    out.walk = { inside: A.walkable(9, 0), floor: A.floorAt(9, 0), wall: A.walkable(9, 1.15), top: A.heightAt(9, 0) };
    out.lamps = A.tunnelLamps.length; out.mesh = A.tunnelGroup.children.length;
    // a branch from the middle, northwards
    out.branchErr = A.placeTunnel({ x: 8, z: 0 }, { x: 8, z: 6 }); const br = A.tunnels[1];
    out.branch = br && { y: br.pts[0].y, start: [br.pts[0].x, br.pts[0].z] }; out.branchWalk = A.walkable(8, 4);
    return out;
  });
  // play: walk in from outside, then on the plateau across the tunnel's route
  const w = await p.evaluate(() => {
    const A = window.__app, out = {};
    A.setMode('play'); A.player.x = -2; A.player.z = 0; A.player.y = A.heightAt(-2, 0); A.playCam.yaw = -Math.PI / 2;
    A.keys.clear(); A.keys.add('KeyW'); for (let i = 0; i < 60 * 2.2; i++) A.update(1 / 60); A.keys.clear(); A.update(1 / 60);
    out.inside = { x: +A.player.x.toFixed(2), y: +A.player.y.toFixed(2), cut: A.cutU.a.value.w };
    A.player.x = 16; A.player.z = 3; A.player.y = A.heightAt(16, 3); A.playCam.yaw = 0;   // on the plateau, walking north→south over the tunnel at z = 0
    A.keys.add('KeyW'); for (let i = 0; i < 60 * 1.6; i++) A.update(1 / 60); A.keys.clear(); A.update(1 / 60);
    out.top = { z: +A.player.z.toFixed(2), y: +A.player.y.toFixed(2), ground: +A.heightAt(A.player.x, A.player.z).toFixed(2), cut: A.cutU.a.value.w };
    A.setMode('edit');
    return out;
  });
  // edit: the tunnel tool over a tunnel cuts its roof away; undo / save → load / export
  const e = await p.evaluate(async () => {
    const A = window.__app, out = {};
    A.setTool('tunnel'); A.stroke(9, 0, 0); A.update(1 / 60); out.editCut = A.cutU.a.value.w;
    A.undo(); A.undo(); out.undo = [A.tunnels.length, A.tunnels[0].pts.length]; A.redo(); A.redo(); out.redo = A.tunnels.length;   // the cursor stroke, then the second drag
    const d = JSON.parse(JSON.stringify(A.serialize())); A.genFlat(); A.updateTerrain(); A.rebuildTunnels(); out.cleared = A.tunnelGroup.children.length;
    A.deserialize(d); out.loaded = { n: A.tunnels.length, mesh: A.tunnelGroup.children.length, walk: A.walkable(9, 0) };
    const { files } = await A.buildExport(), f = nm => files.find(x => x.name === nm), meta = JSON.parse(f('meta.json').data), tm = f('tunnels_mesh.json') && JSON.parse(f('tunnels_mesh.json').data);
    out.exp = { mesh: !!tm, subs: tm && tm.submeshes.map(s => [s.name, s.triangles.length / 3]), verts: tm && tm.vertices.length / 3, tunnels: meta.tunnels && meta.tunnels.length, mouths: meta.tunnels && meta.tunnels.map(t => t.mouths.length), holes: meta.terrain.holes, holeCells: meta.terrain.holeCells, rules: !!meta.tunnelRules, warnings: (JSON.parse(f('validation.json').data).warnings || []).filter(s => s.includes('トンネル')) };
    // walkable.png: the tunnel floor is marked 56 (G)
    const img = await createImageBitmap(new Blob([f('walkable.png').data], { type: 'image/png' })), cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
    const TN = img.width, TS = 48 / (TN - 1), px = cx.getImageData(Math.round((9 + 24) / TS), Math.round((24 - 0) / TS), 1, 1).data; out.exp.walkPx = [px[0], px[1]];
    return out;
  });
  // the pool tool by mouse drag (it set no drag start before)
  await p.evaluate(() => { const A = window.__app; A.setTool('pool'); A.state.variant.pool = 'rect'; });
  const np0 = await p.evaluate(() => window.__app.pools.length);
  await drag({ x: -14, z: -14 }, { x: -9, z: -10 });
  const np1 = await p.evaluate(() => window.__app.pools.length);
  await b.close();
  const checks = [
    ['ドラッグで掘る：崖の前の地面から台地の中へ、床は入口の地面の高さ', d1.n === 1 && d1.pts === 2 && Math.abs(d1.y0 - d1.ground) < .01 && d1.style === 'masonry'],
    ['端から続きを掘る：曲がって反対側の地面まで抜け、出口の床はその地面', o.extend.n === 1 && o.extend.pts === 3 && Math.abs(o.extend.exitY - o.extend.exitGround) < .02],
    ['地形の穴は 2 つの口だけ（台地の中には開けない）', o.holes.n > 10 && o.holes.west > 0 && o.holes.south > 0 && o.holes.deep === 0],
    ['口のまわりの崖石を片づける', o.stones === 0],
    ['中の床は歩け、壁は通れない（床はトンネルの床、上は台地）', o.walk.inside && Math.abs(o.walk.floor - d1.y0) < .01 && !o.walk.wall && o.walk.top > o.walk.floor + 3],
    ['網と灯りがある', o.mesh >= 3 && o.lamps >= 1],
    ['途中から枝分かれ：本線の床の高さで始まり、枝の中も歩ける', !o.branchErr && o.branch && Math.abs(o.branch.y - d1.y0) < .01 && Math.abs(o.branch.start[1]) < .01 && o.branchWalk],
    ['歩くモード：外から歩いて入り、中では屋根を透かす', w.inside.x > 7 && Math.abs(w.inside.y - d1.y0) < .05 && w.inside.cut > 0],
    ['歩くモード：台地の上はトンネルの上を歩いて渡れる（透かさない）', w.top.z < -1.5 && Math.abs(w.top.y - w.top.ground) < .1 && w.top.cut === 0],
    ['編集：トンネルツールでトンネルの上にカーソルを置くと、屋根を透かす', e.editCut > 0],
    ['取り消し・やり直し：続きを掘る前（1 本、点 2 つ）に戻り、やり直せる', e.undo[0] === 1 && e.undo[1] === 2 && e.redo === 2],
    ['保存・読み込みでトンネルが戻る', e.cleared === 0 && e.loaded.n === 2 && e.loaded.mesh >= 3 && e.loaded.walk],
    ['書き出し：tunnels_mesh.json（床・壁・天井・枠・口のまわりの地面）と meta.tunnels・穴', e.exp.mesh && e.exp.subs.find(s => s[0] === 'floor')[1] > 0 && e.exp.subs.find(s => s[0] === 'cap')[1] > 0 && e.exp.subs.find(s => s[0] === 'frame')[1] > 0 && e.exp.tunnels === 2 && e.exp.mouths[0] === 2 && e.exp.holes === 'holes.png' && e.exp.holeCells > 0 && e.exp.rules],
    ['書き出し：walkable.png のトンネルの床は 56、検証の警告なし', e.exp.walkPx[0] === 255 && e.exp.walkPx[1] === 56 && e.exp.warnings.length === 0],
    ['プールツール：マウスのドラッグで作れる', np1 === np0 + 1],
    ['ページのエラーなし', errs.length === 0],
  ];
  console.log(JSON.stringify({ d1, o, w, e }));
  if (errs.length) console.log(errs.slice(0, 5));
  let fail = 0; for (const [name, ok] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) fail++; }
  process.exit(fail ? 1 : 0);
})();

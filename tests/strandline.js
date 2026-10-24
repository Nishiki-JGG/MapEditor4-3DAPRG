// 波打ち際の小物（Revision 26・27）：海岸ツールで浜を作ると、打ち上がりの届く帯に貝殻（ホタテの殻・タカラガイ・貝のかけら）が少し並ぶ。
// 打ち上げられた海藻は自動では置かない（手で撒く物）。内陸の池には置かない。やり直しても増えない。
// 撒くツールでは、海藻も含めて、それぞれの高さの帯にだけ置ける。当たり判定は無い。
//   PW=<playwright のパス> node tests/strandline.js
const { chromium } = require(process.env.PW || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 900, height: 600 } });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html') + '#size=48', { timeout: 180000 }); await p.waitForTimeout(8000);
  const o = await p.evaluate(() => {
    const A = window.__app, W = () => A.state.water, SHELLS = ['scallop', 'cowrie', 'shellbits'], ALL = [...SHELLS, 'wrack'];
    A.genFlat(); A.applyBiome('beach');
    A.setTool('lower'); A.state.radius = 3; A.state.strength = 1; A.stroke(-14, -12, 60);   // a pond inland
    A.makeCoast({ x: 2, z: 0 }, { x: 16, z: 0 });
    const mine = () => A.props.filter(q => ALL.includes(A.PROP[q[0]].id));
    const items = mine().map(q => ({ id: A.PROP[q[0]].id, x: q[1], z: q[2], yaw: q[3], h: A.heightAt(q[1], q[2]) - W() }));
    const ga = A.terrain.parent.children.find(c => c.geometry && c.geometry.attributes.shore).geometry.attributes, sh = ga.shore.array, N = Math.round(Math.sqrt(sh.length / 4));
    const dirAt = (x, z) => { const k = Math.round((z + 24) * 2) * N + Math.round((x + 24) * 2); return [sh[k * 4 + 1], sh[k * 4 + 2]]; };
    // a prop's local x axis turned by yaw is (cos yaw, -sin yaw): for wrack it should run along the shore, across the way to the sea
    const along = items.filter(i => i.id === 'wrack').map(i => { const d = dirAt(i.x, i.z); return Math.abs(Math.cos(i.yaw) * d[0] - Math.sin(i.yaw) * d[1]); });
    const nearPond = items.filter(i => Math.hypot(i.x + 14, i.z + 12) < 6).length;
    const n1 = items.length; A.makeCoast({ x: 2, z: 0 }, { x: 16, z: 0 }); const n2 = mine().length;
    // the scatter brush: over sand, the water's edge and the sea
    A.props = A.props.filter(q => !ALL.includes(A.PROP[q[0]].id)); A.rebuildProps();
    A.state.palette = 'all'; A.state.types = new Set(ALL.map(id => A.PROP.findIndex(t => t.id === id))); A.setTool('scatter'); A.state.radius = 8; A.state.density = 2;
    for (const [x, z] of [[-4, 6], [4, -6], [8, 8], [12, -8]]) A.stroke(x, z, 1);
    const sc = mine().map(q => ({ id: A.PROP[q[0]].id, h: A.heightAt(q[1], q[2]) - W() }));
    const bands = Object.fromEntries(ALL.map(id => [id, A.PROP.find(t => t.id === id).shore]));
    return { items, along, nearPond, n1, n2, sc, bands, radii: ALL.map(id => A.PROP.find(t => t.id === id).r) };
  });
  await b.close();
  const count = id => o.items.filter(i => i.id === id).length, inBand = (list) => list.every(i => i.h >= o.bands[i.id][0] - 1e-6 && i.h <= o.bands[i.id][1] + 1e-6);
  const shells = count('scallop') + count('cowrie') + count('shellbits');
  const checks = [
    ['海岸ツール：貝殻 3 種が自動で並ぶ', count('scallop') > 2 && count('cowrie') > 2 && count('shellbits') > 2],
    ['海岸ツール：打ち上げられた海藻は自動では置かない', count('wrack') === 0],
    ['自動の貝殻は、打ち上がりの帯（水際〜0.45m）にある', inBand(o.items)],
    ['内陸の池のまわりには置かない', o.nearPond === 0],
    ['海岸ツールをやり直しても増えない', o.n2 === o.n1],
    ['撒くツールでは、海藻も含めて、それぞれの高さの帯にだけ置ける', o.sc.length > 10 && o.sc.some(i => i.id === 'wrack') && inBand(o.sc)],
    ['当たり判定は無い', o.radii.every(r => r === 0)],
    ['ページのエラーなし', errs.length === 0],
  ];
  console.log(JSON.stringify({ wrack: count('wrack'), shells, n1: o.n1, n2: o.n2, nearPond: o.nearPond, alongMax: o.along.length ? +Math.max(...o.along).toFixed(3) : null, scattered: o.sc.length }));
  if (errs.length) console.log(errs.slice(0, 5));
  let fail = 0; for (const [name, ok] of checks) { console.log((ok ? 'PASS ' : 'FAIL ') + name); if (!ok) fail++; }
  process.exit(fail ? 1 : 0);
})();

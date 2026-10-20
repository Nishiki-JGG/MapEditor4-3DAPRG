// water.js の単体試験（node）。ブラウザ・Unity は使わない。
//   node tests/water_unit.js
const assert = require('assert');
const zlib = require('zlib');
const crypto = require('crypto');
const W = require('../water.js');
let pass = 0, fail = 0; const results = [];
function t(name, fn) {
  const t0 = Date.now();
  try { const info = fn(); pass++; results.push({ name, ok: true, ms: Date.now() - t0, info }); console.log('PASS', name, info !== undefined ? JSON.stringify(info) : ''); }
  catch (e) { fail++; results.push({ name, ok: false, error: String(e.message || e) }); console.log('FAIL', name, '\n   ', e.message); }
}
const sha = u8 => crypto.createHash('sha256').update(u8).digest('hex');

// 格子: TN×TN、間隔 0.5m、エディター座標 x = -HALF + i*TS, z = -HALF + j*TS
function grid(TN, fn) {
  const TS = 0.5, HALF = (TN - 1) * TS / 2, TH = new Float32Array(TN * TN);
  for (let j = 0; j < TN; j++) for (let i = 0; i < TN; i++) TH[j * TN + i] = fn(-HALF + i * TS, -HALF + j * TS);
  return { TN, TS, HALF, TH };
}
const LAND = 3, BED = 0;
const channel = (o = {}) => { const g = grid(65, (x, z) => (Math.abs(x) <= 3 && z >= -15 ? BED : LAND)); return Object.assign(g, { level: 1, falls: [{ id: 'f1', x: 0, z: -13, w: 3 }] }, o); };
const at = (g, x, z) => { const i = Math.round((x + g.HALF) / g.TS), j = Math.round((z + g.HALF) / g.TS); return j * g.TN + i; };

t('T1 直線の水路：流れは水路の向き（+z）、横向きはほぼ0、保存則 ≤3%', () => {
  const g = channel(), r = W.analyze(g);
  for (const z of [-6, 0, 6, 12]) { const k = at(g, 0, z), ux = r.flow[k * 2], uz = r.flow[k * 2 + 1]; assert(uz > 0.05, `z=${z} uz=${uz}`); assert(Math.abs(ux) < 0.15 * uz + 0.02, `z=${z} ux=${ux} uz=${uz}`); }
  assert(Math.abs(r.flux.balance) <= 0.03, 'balance ' + r.flux.balance);
  assert(r.cg.relResidual < 1e-3);
  return { balance: +r.flux.balance.toFixed(5), cg: r.cg, stats: r.stats };
});

t('T1b 漏れ項を無くすと、水路の真ん中の速さが一様（±12%）', () => {
  const g = channel({ options: { leakLength: 1e6 } }), r = W.analyze(g);
  const v = [-6, -2, 2, 6, 10].map(z => r.flow[at(g, 0, z) * 2 + 1]), mean = v.reduce((a, b) => a + b) / v.length;
  for (const x of v) assert(Math.abs(x - mean) <= 0.12 * mean, JSON.stringify(v));
  return { v: v.map(x => +x.toFixed(3)) };
});

t('T2 出口の無い池：出口の流量0、入口＝漏れ（≤3%）、遠いほど遅い', () => {
  const g = grid(129, (x, z) => (Math.hypot(x, z) <= 12 ? BED : LAND)); Object.assign(g, { level: 1, falls: [{ id: 'f1', x: 0, z: -9, w: 3 }] });
  const r = W.analyze(g);
  assert(r.flux.sink === 0, 'sink ' + r.flux.sink);
  assert(Math.abs(r.flux.balance) <= 0.03, 'balance ' + r.flux.balance);
  const near = Math.hypot(r.flow[at(g, 0, -6) * 2], r.flow[at(g, 0, -6) * 2 + 1]), far = Math.hypot(r.flow[at(g, 0, 8) * 2], r.flow[at(g, 0, 8) * 2 + 1]);
  assert(near > 2 * far, `near ${near} far ${far}`);
  return { near: +near.toFixed(3), far: +far.toFixed(3), balance: +r.flux.balance.toFixed(5) };
});

t('T3 岸からの距離：岸の隣のセル 0.25m、次 0.75m、その次 1.25m', () => {
  const g = grid(65, (x, z) => (Math.abs(x) <= 6 && Math.abs(z) <= 6 ? BED : LAND)); Object.assign(g, { level: 1, falls: [] });
  const r = W.analyze(g), j = Math.round((0 + g.HALF) / g.TS), i0 = Math.round((-6 + g.HALF) / g.TS);
  const b = [0, 1, 2].map(d => r.bank[j * g.TN + i0 + d]);
  assert(Math.abs(b[0] - 0.25) < 1e-4 && Math.abs(b[1] - 0.75) < 1e-4 && Math.abs(b[2] - 1.25) < 1e-4, JSON.stringify(b));
  assert(r.bank[j * g.TN + i0 - 1] === 0, '陸は0');
  return b;
});

t('T4 水深 = 水位 − 地形（水の所）、陸は 0', () => {
  const g = grid(65, (x, z) => Math.sin(x * .3) * Math.cos(z * .25) * 1.5); g.level = 0.4; g.falls = [];
  const r = W.analyze(g); let n = 0, maxErr = 0;
  for (let k = 0; k < g.TN * g.TN; k++) { const d = g.level - g.TH[k]; if (d > 0.02) { n++; maxErr = Math.max(maxErr, Math.abs(r.depth[k] - d)); assert(r.wet[k] === 1); } else { assert(r.depth[k] === 0 && r.wet[k] === 0); } }
  assert(n > 100 && maxErr < 1e-6);
  return { wetCells: n, maxErr };
});

t('T5 乾いた所の滝：警告が出て、流れは出ない（落ちない）', () => {
  const g = channel({ falls: [{ id: 'dry', x: 12, z: 12, w: 3 }] }), r = W.analyze(g);
  assert(r.warnings.some(w => w.includes('乾いた')), r.warnings.join('|'));
  assert(!r.hasFlow); assert(r.falls[0].dry === true);
  return r.warnings;
});

t('T5b 滝が無い：警告が出て、水際の距離は計算される', () => {
  const g = channel({ falls: [] }), r = W.analyze(g);
  assert(r.warnings.some(w => w.includes('入口になる滝も')) && !r.hasFlow && r.bank[at(g, 0, 0)] > 0 && Array.isArray(r.paths) && r.paths.length === 0 && Array.isArray(r.falls));
});

t('T6 水が無い（水位が低すぎる）：落ちずに警告', () => {
  const g = channel({ level: -5 }), r = W.analyze(g);
  assert(r.wetCount === 0 && r.warnings.length === 1 && !r.hasFlow);
});

t('T7 泡の帯：滝から水路の中心線にそって伸び、横では消える', () => {
  const g = channel(), r = W.analyze(g);
  assert(r.paths.length === 1 && r.paths[0].points.length > 10, 'path');
  const pts = r.paths[0].points; for (let q = 1; q < pts.length; q++) assert(pts[q][1] >= pts[q - 1][1] - 1e-6, '筋は +z へ進む');
  const c = r.trail[at(g, 0, -8)], e = r.trail[at(g, 2.5, -8)], far = r.trail[at(g, 0, 14)];
  assert(c > 0.3 && c <= 0.65, 'center ' + c); assert(e < 0.1 * c + 0.02, 'edge ' + e); assert(far < c, 'tapers');
  return { center: +c.toFixed(3), edge: +e.toFixed(3), far: +far.toFixed(3), pathLen: pts.length };
});

t('T8 流れ関数 ψ：水路を横切ると単調（0〜1）', () => {
  const g = channel({ options: { leakLength: 1e6 } }), r = W.analyze(g);
  const xs = [-2.5, -1.5, -0.5, 0.5, 1.5, 2.5], v = xs.map(x => r.psi[at(g, x, 4)]);
  const inc = v.every((a, q) => q === 0 || a >= v[q - 1] - 0.02), dec = v.every((a, q) => q === 0 || a <= v[q - 1] + 0.02);
  assert(inc || dec, JSON.stringify(v)); assert(Math.abs(v[5] - v[0]) > 0.5, 'range ' + JSON.stringify(v));
  return v.map(x => +x.toFixed(3));
});

t('T9 再現性：同じ入力を2回で画像のバイト列が同じ', () => {
  const a = W.pack(W.analyze(channel())), b = W.pack(W.analyze(channel()));
  assert(sha(a.flow) === sha(b.flow) && sha(a.mask) === sha(b.mask));
  const pa = W.encodePngRGBA(65, 65, a.flow), pb = W.encodePngRGBA(65, 65, b.flow); assert(sha(pa) === sha(pb));
  return { flow: sha(a.flow).slice(0, 12), mask: sha(a.mask).slice(0, 12), png: sha(pa).slice(0, 12) };
});

t('T10 画像の中身：陸 A=0、水 A≥4、陸の流れ=128、NaN/Inf なし、PNG が復号できて一致', () => {
  const g = channel(), r = W.analyze(g), p = W.pack(r);
  for (let k = 0; k < g.TN * g.TN; k++) {
    if (r.wet[k]) { assert(p.flow[k * 4 + 3] >= 4); } else { assert(p.flow[k * 4 + 3] === 0 && p.flow[k * 4] === 128 && p.flow[k * 4 + 1] === 128 && p.mask[k * 4] === 0); }
    assert(Number.isFinite(r.flow[k * 2]) && Number.isFinite(r.flow[k * 2 + 1]) && Number.isFinite(r.psi[k]) && Number.isFinite(r.bank[k]) && Number.isFinite(r.trail[k]));
  }
  const png = W.encodePngRGBA(g.TN, g.TN, p.flow);
  assert(Buffer.from(png.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])));
  // IDAT を取り出して復号
  let pos = 8, idat = []; while (pos < png.length) { const len = Buffer.from(png.buffer, png.byteOffset + pos, 4).readUInt32BE(0), type = Buffer.from(png.subarray(pos + 4, pos + 8)).toString('latin1'); if (type === 'IDAT') idat.push(Buffer.from(png.subarray(pos + 8, pos + 8 + len))); pos += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)), rowLen = 1 + g.TN * 4; assert(raw.length === rowLen * g.TN);
  for (let y = 0; y < g.TN; y++) { assert(raw[y * rowLen] === 0); for (let x = 0; x < g.TN * 4; x++) assert(raw[y * rowLen + 1 + x] === p.flow[y * g.TN * 4 + x]); }
  // CRC の検査
  pos = 8; while (pos < png.length) { const len = Buffer.from(png.buffer, png.byteOffset + pos, 4).readUInt32BE(0); const crc = Buffer.from(png.buffer, png.byteOffset + pos + 8 + len, 4).readUInt32BE(0); assert(W.crc32(png.subarray(pos + 4, pos + 8 + len)) === crc, 'crc'); pos += 12 + len; }
  return { pngBytes: png.length };
});

t('T11 全面が水の 257²：出口は地図の端、時間 ≤3秒、収束', () => {
  const g = grid(257, (x, z) => -1 - 0.5 * Math.cos(x * .1)); Object.assign(g, { level: 0, falls: [{ id: 'c', x: 0, z: 0, w: 4 }] });
  const t0 = Date.now(), r = W.analyze(g), ms = Date.now() - t0;
  assert(r.cg.relResidual < 1e-3 && Math.abs(r.flux.balance) <= 0.03, JSON.stringify(r.cg) + ' ' + r.flux.balance);
  assert(ms <= 3000, ms + ' ms');
  return { ms, cg: r.cg, balance: +r.flux.balance.toFixed(5), stats: r.stats };
});

t('T12 複数の滝が同じ池に入る：2つの入口、保存則 ≤3%', () => {
  const g = grid(129, (x, z) => (Math.hypot(x, z) <= 14 ? BED : LAND)); Object.assign(g, { level: 1, falls: [{ id: 'a', x: -8, z: 0, w: 3 }, { id: 'b', x: 8, z: 0, w: 3 }] });
  const r = W.analyze(g); assert(r.falls.filter(f => !f.dry).length === 2 && Math.abs(r.flux.balance) <= 0.03); assert(r.paths.length === 2);
  return { balance: +r.flux.balance.toFixed(5) };
});

t('T13 滝の無い川：水底の高い端から低い端へ流れる、保存則 ≤3%、入口が記録される', () => {
  const g = grid(65, (x, z) => (Math.abs(x) <= 3 ? -0.3 - 0.02 * (z + 16) : LAND)); Object.assign(g, { level: 0, falls: [] });
  const r = W.analyze(g);
  assert(r.hasFlow && r.inflows.length === 1, JSON.stringify(r.inflows));
  assert(r.inflows[0].z < -14 && r.inflows[0].outlets === 1, JSON.stringify(r.inflows[0]));
  for (const z of [-8, 0, 8]) assert(r.flow[at(g, 0, z) * 2 + 1] > 0.05, 'z=' + z);
  assert(Math.abs(r.flux.balance) <= 0.03, 'balance ' + r.flux.balance);
  // 逆向きの水底（+z 側が高い）なら、流れも逆
  const g2 = grid(65, (x, z) => (Math.abs(x) <= 3 ? -0.3 + 0.02 * (z + 16) - 0.64 : LAND)); Object.assign(g2, { level: 0, falls: [] });
  const r2 = W.analyze(g2); assert(r2.flow[at(g2, 0, 0) * 2 + 1] < -0.05, 'reverse');
  return { inflow: r.inflows[0], balance: +r.flux.balance.toFixed(5) };
});

t('T14 端に1か所だけ接する湖：流れの入口が無く、動かない（落ちない）', () => {
  const g = grid(65, (x, z) => (Math.hypot(x - 14, z) <= 6 ? BED : LAND)); Object.assign(g, { level: 1, falls: [] });
  const r = W.analyze(g); assert(!r.hasFlow && r.inflows.length === 0 && r.warnings.length === 1);
});

t('T15 滝のある水路が端にも接する：端は出口（川の入口は作らない）', () => {
  const g = channel(); const r = W.analyze(g); assert(r.inflows.length === 0 && r.flux.sink > 0);
});

console.log(`\n${pass} passed, ${fail} failed`);
require('fs').writeFileSync(require('path').join(__dirname, 'WATER_UNIT_RESULT.json'), JSON.stringify({ pass, fail, results }, null, 1));
process.exit(fail ? 1 : 0);

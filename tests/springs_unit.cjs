// 水源の計算（springs.js）の試験。合成の地形で、平地・斜面・くぼみ・あふれ・合流・水際・プール・溝・速さを確かめる。
//   node tests/springs_unit.cjs
const S = require('../springs.js');
const TN = 129, TS = .5, HALF = 32, X = i => -HALF + i * TS, n = TN * TN;
const terrain = f => { const T = new Float32Array(n); for (let j = 0; j < TN; j++) for (let i = 0; i < TN; i++) T[j * TN + i] = f(X(i), X(j)); return T; };
const run = (TH, springs, extra = {}) => S.solve({ TN, TS, HALF, TH, level: extra.level ?? -50, springs, pools: extra.pools, options: extra.options });
const wetArea = (r, kind) => { let c = 0; for (let k = 0; k < n; k++) if (kind ? r.kind[k] === kind : r.kind[k]) c++; return c * TS * TS; };
const checks = [], info = {};
const ok = (name, v) => checks.push([name, !!v]);

// 1. 平地: 丸い池が、湧出量の面積まで広がって止まる
{
  const TH = terrain(() => 1), r = run(TH, [{ id: 's1', x: 3, z: -2, preset: 'spring' }]);
  const A = wetArea(r, 2), P = S.PRESETS.spring.area; let mx = 0, sx = 0, sz = 0, c = 0, rmax = 0, rmin = 1e9;
  for (let k = 0; k < n; k++) if (r.kind[k] === 2) { sx += X(k % TN); sz += X((k / TN) | 0); c++; mx = Math.max(mx, r.depth[k]); }
  const cx = sx / c, cz = sz / c;
  for (let k = 0; k < n; k++) if (r.kind[k] === 2) { const i = k % TN, j = (k / TN) | 0; let rim = false; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (r.kind[(j + b) * TN + i + a] !== 2) rim = true; if (rim) { const d = Math.hypot(X(i) - cx, X(j) - cz); rmax = Math.max(rmax, d); rmin = Math.min(rmin, d); } }
  info.flat = { area: A, preset: P, center: [+cx.toFixed(2), +cz.toFixed(2)], rimR: [+rmin.toFixed(2), +rmax.toFixed(2)], depth: +mx.toFixed(3), streams: r.streams.length, end: r.springs[0].end };
  ok('平地: 池が湧出量の面積まで広がって止まる（±2%）', Math.abs(A - P) <= P * .02 + TS * TS && r.springs[0].end === 'dry');
  ok('平地: 水源を中心に丸く広がる', Math.hypot(cx - 3, cz + 2) < .3 && rmax / rmin < 1.25);
  ok('平地: 水深は薄い膜（3cm）', Math.abs(mx - .03) < 1e-4);
  const sizes = ['seep', 'brook', 'spring', 'great'].map(p => wetArea(run(TH, [{ id: 'a', x: 0, z: 0, preset: p }])));
  info.presets = sizes;
  ok('プリセット: しずく < 小川 < 泉 < 大きな泉 の順に広い', sizes.every((v, i) => !i || v > sizes[i - 1] * 2));
}
// 2. 斜面: 低い方へ小川として流れ、下流ほど細くなり、予算が尽きると消える（水面は下るだけ）
{
  const TH = terrain((x, z) => 5 + x * .06 + Math.sin(z * .7) * .02), r = run(TH, [{ id: 's', x: 20, z: 0, preset: 'brook' }]);
  const st = r.streams[0], P = st ? st.points : [];
  const down = P.every((p, i) => !i || p[2] <= P[i - 1][2] + 1e-6), narrower = P.length > 4 && P[P.length - 1][3] <= P[0][3];
  const L = P.reduce((a, p, i) => i ? a + Math.hypot(p[0] - P[i - 1][0], p[1] - P[i - 1][1]) : 0, 0);
  info.slope = { streams: r.streams.length, len: +L.toFixed(1), w0: P[0] && P[0][3], w1: P.length && P[P.length - 1][3], x1: P.length && P[P.length - 1][0], end: r.springs[0].end, ponds: r.ponds.length };
  ok('斜面: 低い方（-x）へ小川が流れる', P.length > 10 && P[P.length - 1][0] < 20 - 10 && r.ponds.length === 0);
  ok('斜面: 水面は下流へ下がるだけ・下流ほど細い', down && narrower);
  const r1 = run(TH, [{ id: 's', x: 20, z: 0, preset: 'seep' }]), P1 = r1.streams[0].points;
  info.slope.seepEnd = P1[P1.length - 1][0];
  ok('斜面: しずくは予算が尽きた所で消える（地図の端まで行かない）', r1.springs[0].end === 'dry' && P1[P1.length - 1][0] > -HALF + 10);
  const r2 = run(TH, [{ id: 's', x: 20, z: 0, preset: 'great' }]);
  ok('斜面: 大きな泉なら地図の端まで流れる', r2.springs[0].end === 'edge');
}
// 3. くぼみ: 入りきらない深い鉢では、予算の面積で止まる（あふれない）
{
  const TH = terrain((x, z) => 2 + Math.min(Math.hypot(x, z), 20) * .15), r = run(TH, [{ id: 's', x: 6, z: 0, preset: 'brook' }]);
  const A = wetArea(r), lv = r.ponds[0] && r.ponds[0].level;
  info.bowl = { area: A, ponds: r.ponds.length, level: lv, maxDepth: r.ponds[0] && r.ponds[0].maxDepth, end: r.springs[0].end };
  ok('くぼみ: 鉢の底へ流れて池になる（水面は水平）', r.ponds.length === 1 && r.ponds[0].maxDepth > .3);
  ok('くぼみ: 面積は予算で止まり、あふれない', A <= S.PRESETS.brook.area * 1.05 && r.springs[0].end === 'dry');
}
// 4. あふれ: 浅いくぼみは満ちて、いちばん低いふちからあふれて下へ流れ続ける
{
  const TH = terrain((x, z) => 6 + x * .08 - .9 * Math.exp(-((x - 10) ** 2 + z * z) / 8)), r = run(TH, [{ id: 's', x: 18, z: 0, preset: 'spring' }]);
  const pond = r.ponds[0], after = r.streams.find(st => st.points[0][0] < 10);
  info.spill = { ponds: r.ponds.length, pondArea: pond && pond.area, streams: r.streams.length, end: r.springs[0].end, outStart: after && after.points[0].slice(0, 3) };
  ok('あふれ: くぼみが池になり、その下流（-x 側）へ小川が続く', pond && pond.area > 2 && after && after.points.length > 5);
  ok('あふれ: あふれた小川の水面は池の水面より低い', after && after.points[0][2] < pond.level + 1e-6);
}
// 5. 合流: 2 つの水源が同じくぼみへ流れると、池は 1 つで、1 つのときより広い
{
  const TH = terrain((x, z) => 2 + Math.min(Math.hypot(x, z), 22) * .15);
  const one = run(TH, [{ id: 'a', x: 8, z: 0, preset: 'brook' }]), two = run(TH, [{ id: 'a', x: 8, z: 0, preset: 'brook' }, { id: 'b', x: -6, z: 6, preset: 'brook' }]);
  info.merge = { one: wetArea(one, 2), two: wetArea(two, 2), ponds: two.ponds.length, springs: two.ponds[0] && two.ponds[0].springs };
  ok('合流: 2 つの水源が 1 つの池になり、広さが増える', two.ponds.length === 1 && wetArea(two, 2) > wetArea(one, 2) * 1.3 && two.ponds[0].springs.length === 2);
  // 2 つのくぼみが満ちて同じ水位になると 1 つの池に
  const TH2 = terrain((x, z) => 3 - 1.2 * Math.exp(-((x - 5) ** 2 + z * z) / 6) - 1.2 * Math.exp(-((x + 5) ** 2 + z * z) / 6) + Math.max(0, Math.hypot(x, z) - 12) * .2);
  const r2 = run(TH2, [{ id: 'a', x: 5, z: 0, preset: 'great' }]);
  info.merge2 = { ponds: r2.ponds.length, level: r2.ponds.map(p => p.level), area: r2.ponds.map(p => p.area) };
  ok('合流: 隣のくぼみまで満ちると 1 つの池（水位は 1 つ）', r2.ponds.length === 1 && r2.kind[TN * 64 + 54] === 2 && r2.kind[TN * 64 + 74] === 2);
}
// 6. 水際: 低い水（地図の水位）に届いた小川はそこで終わる
{
  const TH = terrain(x => x * .1), r = run(TH, [{ id: 's', x: 20, z: 0, preset: 'brook' }], { level: 0 });
  const P = r.streams[0].points, last = P[P.length - 1];
  let wetBelow = 0; for (let k = 0; k < n; k++) if (r.kind[k] && TH[k] < 0) wetBelow++;
  info.shore = { end: r.springs[0].end, lastX: last[0], wetBelow };
  ok('水際: 水位より低い水に届いて終わる', r.springs[0].end === 'water' && Math.abs(last[0]) < 1 && wetBelow === 0);
  const r2 = run(TH, [{ id: 'w', x: -10, z: 0, preset: 'brook' }], { level: 0 });
  ok('水際: 水の中の水源は警告して何も作らない', r2.wetCount === 0 && r2.warnings.length === 1);
}
// 7. プール: 水源の入ったプールはあふれ口から小川が出る。出口が無ければプールの中で終わる
{
  const TH = terrain(x => 3 + x * .05), cells = []; for (let j = 60; j <= 68; j++) for (let i = 60; i <= 68; i++) cells.push(j * TN + i);
  const pools = [{ id: 'p1', cells, level: 3.4, outlet: 64 * TN + 58 }];
  const r = run(TH, [{ id: 's', x: 0, z: 0, preset: 'brook' }], { pools });
  info.pool = { end: r.springs[0].end, streams: r.streams.length, firstX: r.streams[0] && r.streams[0].points[0][0], poolCells: wetArea(r, 3) / (TS * TS) };
  ok('プール: プールの中は決まった水面のまま', wetArea(r, 3) / (TS * TS) === cells.length && cells.every(k => r.surf[k] === Math.fround(3.4)));
  ok('プール: あふれ口からの小川はプールの水面より上がらない', r.streams[0] && r.streams[0].points[0][2] <= 3.4 + 1e-6);
  ok('プール: あふれ口から低い方へ小川が出る', r.streams.length === 1 && r.streams[0].points[0][0] < -2.5 && r.streams[0].points.length > 5);
  const r2 = run(TH, [{ id: 's', x: 0, z: 0, preset: 'brook' }], { pools: [{ ...pools[0], outlet: -1 }] });
  ok('プール: あふれ口が無ければ小川は出ない', r2.streams.length === 0 && r2.springs[0].end === 'pool');
  const r3 = run(TH, [], { pools });
  let edgeOk = true; for (let k = 0; k < n; k++) if (!r3.kind[k] && !isNaN(r3.edge[k]) && r3.edge[k] - TH[k] > -.3 + 1e-6) edgeOk = false;
  ok('プール: 水源が無くても水は張ってあり、外の岸の線は壁の下', wetArea(r3, 3) > 0 && r3.streams.length === 0 && edgeOk);
}
// 8. 溝: 小川の所だけ、溝の深さまでしか掘らない。池は掘らない
{
  const TH = terrain((x, z) => 6 + x * .08 - .9 * Math.exp(-((x - 10) ** 2 + z * z) / 8)), r = run(TH, [{ id: 's', x: 18, z: 0, preset: 'spring' }]), cv = S.carve(r, TH);
  let mx = 0, inPond = 0, far = 0, cnt = 0;
  for (let k = 0; k < n; k++) { mx = Math.max(mx, cv[k]); if (cv[k] > 0) cnt++; if (r.kind[k] === 2 && cv[k] > 0) inPond++; if (cv[k] > 0 && Math.abs(X((k / TN) | 0)) > 4) far++; }
  // 掘った地形でもう一度解くと、小川は溝の中を通る（同じ所を流れる）
  const T2 = TH.map((h, k) => h - cv[k]), r2 = run(T2, [{ id: 's', x: 18, z: 0, preset: 'spring' }]);
  const line = res => res.streams.flatMap(st => st.points), L1 = line(r), L2 = line(r2);
  let same = 0, tot = L1.length; for (const p of L1) if (L2.some(q => Math.hypot(p[0] - q[0], p[1] - q[1]) <= .75)) same++;
  info.carve = { max: +mx.toFixed(3), cells: cnt, inPond, far, sameRoute: +(same / tot).toFixed(3) };
  ok('溝: 深さは 0.08〜0.22m、池の中と離れた所は掘らない', mx >= .08 && mx <= .22 + 1e-6 && inPond === 0 && far === 0);
  ok('溝: 掘った地形でも小川はほぼ同じ所を流れる（線の 9 割以上が 0.75m 以内）', same / tot > .9);
}
// 9. 同じ入力からは同じ結果。広い地図に大きな泉 6 つでも速い
{
  const TN2 = 257, H2 = 64, T = new Float32Array(TN2 * TN2);
  for (let j = 0; j < TN2; j++) for (let i = 0; i < TN2; i++) { const x = -H2 + i * .5, z = -H2 + j * .5; T[j * TN2 + i] = 4 + Math.sin(x * .11) * 2 + Math.cos(z * .09 + x * .03) * 2.5 + Math.sin(x * .7 + z * .5) * .3; }
  const sp = Array.from({ length: 6 }, (_, q) => ({ id: 'g' + q, x: -50 + q * 20, z: (q % 2 ? 30 : -30), preset: 'great' }));
  const t0 = Date.now(), a = S.solve({ TN: TN2, TS: .5, HALF: H2, TH: T, level: 0, springs: sp }), ms = Date.now() - t0;
  const b = S.solve({ TN: TN2, TS: .5, HALF: H2, TH: T, level: 0, springs: sp });
  let same = a.wetCount === b.wetCount; for (let k = 0; k < TN2 * TN2 && same; k++) if (!(a.surf[k] === b.surf[k] || (isNaN(a.surf[k]) && isNaN(b.surf[k])))) same = false;
  info.big = { ms, wet: a.wetCount, ponds: a.ponds.length, streams: a.streams.length, ends: a.springs.map(s => s.end) };
  ok('同じ入力からは同じ結果', same);
  ok('128m の地図に大きな泉 6 つでも 300ms 以内', ms < 300);
}
console.log(JSON.stringify(info));
let fail = 0; for (const [name, v] of checks) { console.log((v ? 'PASS ' : 'FAIL ') + name); if (!v) fail++; }
process.exit(fail ? 1 : 0);

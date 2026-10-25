// トンネルの形の計算（tunnels.js）の試験。合成の丘で、区間の分け方・入口の穴・網・床の問い合わせ・枝分かれ・検証を確かめる。
//   node tests/tunnels_unit.cjs
const T = require('../tunnels.js');
const checks = [], info = {}, ok = (name, v) => checks.push([name, !!v]);
// 西は平地（高さ 3）、x = 0 から東へ 2m で 6m 上がる丘（高さ 9）
const H = (x, z) => 3 + 6 / (1 + Math.exp(-(x - 1) * 3));
const tun = (id, pts, style = 'rock', w = 2.4, h = 2.8) => ({ id, style, w, h, pts: pts.map(([x, z, y]) => ({ x, z, y })) });
{
  const P = T.prepare([tun('t1', [[-4, 0, 3], [12, 0, 3]])], H), st = P[0].st, cls = st.map(q => q.cls);
  const first = c => st.find(q => q.cls === c), last0 = st.filter(q => q.cls === 0).pop();
  info.classes = { open: cls.filter(c => c === 0).length, cut: cls.filter(c => c === 1).length, tube: cls.filter(c => c === 2).length, cutFrom: first(1) && +first(1).x.toFixed(2), tubeFrom: first(2) && +first(2).x.toFixed(2), deepest: +Math.max(...st.map(q => q.toOpen)).toFixed(2) };
  ok('区間：平地は外、丘の斜面は切り通し、丘の中はトンネル（西から順に）', cls[0] === 0 && first(1).x < first(2).x && last0.x < first(1).x && cls[cls.length - 1] === 2);
  ok('区間：奥ほど入口から遠い（行き止まりで約 10m）', info.classes.deepest > 9 && info.classes.deepest < 12);
  const q1 = T.query(P, 6, .5), q2 = T.query(P, 6, 1.5), q3 = T.query(P, -3, 0), q4 = T.query(P, 6, .9, .3);
  info.query = { q1: q1 && { y: q1.y, cls: q1.cls }, q2, q3, q4 };
  ok('床の問い合わせ：中の床は 3m、幅の外と入口の外は null、体の半径を引いた幅', q1 && Math.abs(q1.y - 3) < 1e-9 && q1.cls === 2 && q2 === null && q3 === null && q4 === null);
  const holes = T.holes(P, H, 97, .5, 24), cells = []; for (let k = 0; k < holes.length; k++) if (holes[k]) cells.push([-24 + (k % 96 + .5) * .5, -24 + (((k / 96) | 0) + .5) * .5]);
  info.holes = { n: cells.length, x: [Math.min(...cells.map(c => c[0])), Math.max(...cells.map(c => c[0]))], z: [Math.min(...cells.map(c => c[1])), Math.max(...cells.map(c => c[1]))] };
  ok('地形の穴：入口（斜面）だけ、幅＋壁の範囲（奥の丘と平地には開けない）', cells.length > 10 && info.holes.x[0] > -1.5 && info.holes.x[1] < first(2).x + .7 && info.holes.z[1] < 1.2 + .45 + .25);
  const g = T.build(P, H), subs = T.SUBMESH.map((n, i) => [n, g.sub.filter(s => s === i).length]);
  info.mesh = { tris: g.sub.length, subs: Object.fromEntries(subs), lamps: g.lamps.length };
  ok('網：床・壁・天井と、素掘りの坑口の岩（decor）がある（坑口の板は作らない）。頂点ごとの法線・模様の座標・奥の暗さ', subs.slice(0, 3).every(([, n]) => n > 0) && subs[3][1] === 0 && subs[7][1] > 200 && g.pos.length === g.sub.length * 9 && g.col.length === g.pos.length && g.nor.length === g.pos.length && g.uv.length === g.sub.length * 6 && g.dk.length === g.sub.length * 3 && g.mat.length === g.sub.length);
  // 法線は単位長さ。壁・天井は奥ほど暗い
  let badN = 0; for (let k = 0; k < g.nor.length; k += 3) if (Math.abs(Math.hypot(g.nor[k], g.nor[k + 1], g.nor[k + 2]) - 1) > 1e-3) badN++;
  ok('網：法線は単位長さ、奥（10m）は口より暗い', badN === 0 && Math.max(...Array.from(g.dk)) > .9 && Math.min(...Array.from(g.dk)) === 0);
  // 口のまわりの地面：穴のセルを細かく作り直し、口の輪郭で切り抜く（口の中へ垂れ下がる細い三角形が無い）
  const cp = T.cap(P, H, holes, 97, .5, 24), nt = cp.tris.length / 6; let inOpen = 0, area = 0;
  const inside = (x, z) => { const y = H(x, z), l = Math.min(Math.abs(z) / 1.2, 1), top = T.profile(2.4, 2.8).hs + T.profile(2.4, 2.8).r * Math.sqrt(1 - l * l); return x > first(1).x + .05 && Math.abs(z) < 1.15 && y > 3 + .03 && y < 3 + top - .05; };
  for (let k = 0; k < nt; k++) {
    const p = [0, 1, 2].map(i => [cp.tris[k * 6 + i * 2], cp.tris[k * 6 + i * 2 + 1]]); area += Math.abs((p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) - (p[2][0] - p[0][0]) * (p[1][1] - p[0][1])) / 2;
    // 重心と、各辺の中点・各頂点と重心の中点が、口の中に入らない
    const pts = [[(p[0][0] + p[1][0] + p[2][0]) / 3, (p[0][1] + p[1][1] + p[2][1]) / 3]]; for (let i = 0; i < 3; i++) { const j = (i + 1) % 3; pts.push([(p[i][0] + p[j][0]) / 2, (p[i][1] + p[j][1]) / 2], [(p[i][0] + pts[0][0]) / 2, (p[i][1] + pts[0][1]) / 2]); }
    if (pts.some(([x, z]) => inside(x, z))) inOpen++;
  }
  info.cap = { tris: nt, area: +area.toFixed(2), of: cells.length * .25, inOpen };
  ok('口のまわりの地面：穴のセルの一部を作り直し、口の中は抜く（垂れ下がる三角形なし）', nt > 0 && area < cells.length * .25 && area > cells.length * .25 * .2 && inOpen === 0);
  let bad = 0; for (let k = 0; k < g.pos.length; k++) if (!Number.isFinite(g.pos[k])) bad++;
  ok('網：数値はすべて有限', bad === 0);
  // 天井は床から高さ h まで、中の壁は幅の半分の所（素掘りのでこぼこ 0.14m まで）
  let maxY = -1e9, maxU = 0; for (let k = 0; k < g.pos.length; k += 3) { const x = g.pos[k], y = g.pos[k + 1], z = g.pos[k + 2]; if (x > 4 && x < 11 && g.sub[(k / 9) | 0] <= 2) { maxY = Math.max(maxY, y); maxU = Math.max(maxU, Math.abs(z)); } }
  info.inside = { maxY: +maxY.toFixed(2), maxU: +maxU.toFixed(2) };
  ok('網：中の天井は床＋高さ、壁は幅の半分（でこぼこ込み）', Math.abs(maxY - (3 + 2.8)) < .15 && maxU < 1.2 + .2);
  ok('灯り：奥（入口から 2m より先）に灯りが付く', g.lamps.length >= 1 && g.lamps.every(l => l.x > 3));
  const w = T.check(P, H, { agent: { height: 1.8 }, water: .8 });
  ok('検証：正しいトンネルには警告なし', w.length === 0);
}
// 4 種類の見た目・大きさ
{
  const res = {}; for (const s of Object.keys(T.STYLES)) { const P = T.prepare([tun('s', [[-4, 0, 3], [12, 0, 3]], s)], H), g = T.build(P, H); res[s] = { tris: g.sub.length, frame: g.sub.filter(x => x === 4).length, lamps: g.lamps.length }; }
  info.styles = res;
  ok('見た目：坑道は支保工、石積み・遺跡は坑口の枠の石（素掘りの枠は松明の腕木だけ）', res.mine.frame > 100 && res.masonry.frame > res.rock.frame + 15 && res.ruins.frame > res.masonry.frame);
}
// 洞窟：ゆがんだ丸い断面（左右は単調、頂きは高さ h、床の幅の外へ出ない）、口の地面は輪郭で切り抜く、坑口の岩・鍾乳石、灯りなし
{
  const tc = tun('cave1', [[-4, 0, 3], [12, 0, 3]], 'cave', 3.2, 3.4), P = T.prepare([tc], H), g = T.build(P, H), pr = T.profileOf(tc);
  let mono = true; for (let k = 1; k < pr.pts.length; k++) if (pr.pts[k][0] <= pr.pts[k - 1][0]) mono = false;
  const vmax = Math.max(...pr.pts.map(p => p[1])), umax = Math.max(...pr.pts.map(p => Math.abs(p[0])));
  const other = T.profileOf({ ...tc, id: 'cave2' }), differs = other.pts.some((p, k) => Math.abs(p[1] - pr.pts[k][1]) > .05);
  const holes = T.holes(P, H, 97, .5, 24), cp = T.cap(P, H, holes, 97, .5, 24); let inOpen = 0;
  const first1 = P[0].st.find(q => q.cls > 0);
  for (let k = 0; k < cp.tris.length / 6; k++) { const x = (cp.tris[k * 6] + cp.tris[k * 6 + 2] + cp.tris[k * 6 + 4]) / 3, z = (cp.tris[k * 6 + 1] + cp.tris[k * 6 + 3] + cp.tris[k * 6 + 5]) / 3, y = H(x, z); if (x > first1.x + .05 && Math.abs(z) < 1.5 && y > 3.03 && y < 3 + pr.top(z) - .05) inOpen++; }
  info.cave = { mono, vmax: +vmax.toFixed(2), umax, differs, decor: g.sub.filter(x => x === 7).length, lamps: g.lamps.length, inOpen };
  ok('洞窟：断面は左右に単調・高さ h・幅の中、トンネルごとに形が違う、口の地面は輪郭で切り抜く、坑口の岩と鍾乳石があり灯りは無い', mono && Math.abs(vmax - 3.4) < 1e-6 && umax <= 1.6 + 1e-9 && differs && inOpen === 0 && info.cave.decor > 500 && g.lamps.length === 0);
}
// 枝分かれ：本線の途中から北へ。互いの中の壁・床は作らない（口が開く）
{
  const t1 = tun('a', [[-4, 0, 3], [14, 0, 3]]), t2 = tun('b', [[8, 0, 3], [8, 10, 3]]), P = T.prepare([t1, t2], H), g = T.build(P, H);
  const P1 = T.prepare([t1], H), g1 = T.build(P1, H);
  // 本線の北の壁が、枝の口（x = 8 ± 1.1）では消えている
  let wallAtMouth = 0; for (let k = 0; k < g.sub.length; k++) { if (g.sub[k] !== 1) continue; const cx = (g.pos[k * 9] + g.pos[k * 9 + 3] + g.pos[k * 9 + 6]) / 3, cz = (g.pos[k * 9 + 2] + g.pos[k * 9 + 5] + g.pos[k * 9 + 8]) / 3; if (Math.abs(cx - 8) < .9 && cz > 1 && cz < 1.4) wallAtMouth++; }
  let wallBefore = 0; for (let k = 0; k < g1.sub.length; k++) { if (g1.sub[k] !== 1) continue; const cx = (g1.pos[k * 9] + g1.pos[k * 9 + 3] + g1.pos[k * 9 + 6]) / 3, cz = (g1.pos[k * 9 + 2] + g1.pos[k * 9 + 5] + g1.pos[k * 9 + 8]) / 3; if (Math.abs(cx - 8) < .9 && cz > 1 && cz < 1.4) wallBefore++; }
  const qa = T.query(P, 8, 4);
  info.branch = { wallBefore, wallAtMouth, branchFloor: qa && qa.y };
  ok('枝分かれ：本線の壁に口が開き、枝の床を歩ける', wallBefore > 10 && wallAtMouth === 0 && qa && qa.y === 3);
}
// 勾配と検証
{
  const steep = T.prepare([tun('st', [[-4, 0, 3], [4, 0, 6]])], H), w1 = T.check(steep, H, { agent: { height: 1.8 } });
  const low = T.prepare([tun('lo', [[-4, 0, 3], [12, 0, 3]], 'rock', 1.6, 1.8)], H), w2 = T.check(low, H, { agent: { height: 1.8 } });
  const wet = T.prepare([tun('we', [[-4, 0, .5], [12, 0, .5]])], (x, z) => H(x, z) - 2.5), w3 = T.check(wet, (x, z) => H(x, z) - 2.5, { agent: { height: 1.8 }, water: .8 });
  const flat = T.prepare([tun('fl', [[-4, 0, 3], [-1, 0, 3]])], H), w4 = T.check(flat, H, { agent: { height: 1.8 } });
  info.check = { w1, w2, w3, w4 };
  ok('検証：急すぎる勾配・低すぎる天井・水位より低い床・地面がかぶらない、を警告', w1.some(s => s.includes('15°')) && w2.some(s => s.includes('身長')) && w3.some(s => s.includes('水位')) && w4.some(s => s.includes('かぶる')));
}
// 速さ：128m の地図に 60m のトンネル 4 本
{
  const H2 = (x, z) => 3 + 8 * Math.exp(-(x * x + z * z) / 900), ts = [0, 1, 2, 3].map(k => tun('p' + k, [[Math.cos(k * 1.57) * 50, Math.sin(k * 1.57) * 50, 3.2], [Math.cos(k * 1.57) * 30, Math.sin(k * 1.57) * 30, 3.5], [Math.cos(k * 1.57 + .5) * 10, Math.sin(k * 1.57 + .5) * 10, 4]]));
  const t0 = Date.now(), P = T.prepare(ts, H2), g = T.build(P, H2), h = T.holes(P, H2, 257, .5, 64), ms = Date.now() - t0;
  info.perf = { ms, tris: g.sub.length };
  ok('速さ：4 本で 1 秒以内、三角形は 1 本あたり 2 万以下', ms < 1000 && g.sub.length < 80000);
}
console.log(JSON.stringify(info));
let fail = 0; for (const [name, v] of checks) { console.log((v ? 'PASS ' : 'FAIL ') + name); if (!v) fail++; }
process.exit(fail ? 1 : 0);

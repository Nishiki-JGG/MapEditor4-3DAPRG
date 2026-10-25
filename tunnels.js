// トンネル（マップエディター用）。地形は高さの格子なので横穴は表せない。そこで、トンネルは地形とは別の物として持ち、
// 中の床・壁・天井と入口の正面（坑口）を網で作り、入口だけ地形に穴を開ける。画面に依存しない関数だけを置く
// （ブラウザでは window.TDTunnels、node では module.exports）。
//
// トンネル t = { id, style, w, h, pts: [{x, z, y}, ...] }   pts = 中心線の折れ線（エディター座標）、y = 床の高さ。w 幅、h 高さ(m)
// 中心線を 0.25m ごとに区切り、その真上の地面の高さ g で 3 つに分ける:
//   0 外    g ≤ 床 + COVER           地面を歩く（トンネルの物は何も置かない）
//   1 切り通し g < 床 + 高さ + COVER   屋根の無い溝。両側に土留めの壁、床
//   2 トンネル g ≥ 床 + 高さ + COVER   床・壁・アーチの天井。外や切り通しとの境（入口）には坑口の正面を立てる
//   prepare(tunnels, H)              区切りを作る（H(x, z) = 地面の高さ）
//   query(prep, x, z)                (x, z) が床の上なら { i, y, lat, s, cls, w, h }（一番近いトンネル）、外なら null
//   holes(prep, H, n, cell, half)    地形の穴: (n-1)² のセルごとに 1 = 描かない（入口・切り通し）
//   build(prep, H)                   網: 三角形の並び { pos, col, glow, sub }（sub = SUBMESH の番号）と灯りの位置
//   check(prep, H, o)                検証の警告
(function (root) {
  'use strict';
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const hyp = (a, b) => Math.sqrt(a * a + b * b);
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
  const STYLES = { rock: { name: '素掘り' }, masonry: { name: '石積み' }, mine: { name: '坑道' }, ruins: { name: '遺跡' } };
  const SIZES = { narrow: { name: '細い', w: 1.6, h: 2.4 }, normal: { name: 'ふつう', w: 2.4, h: 2.8 }, wide: { name: '広い', w: 3.2, h: 3.4 } };
  const SLOPES = { flat: { name: '水平', deg: 0 }, up: { name: 'ゆるい上り', deg: 5 }, down: { name: 'ゆるい下り', deg: -5 }, up2: { name: '上り', deg: 10 }, down2: { name: '下り', deg: -10 } };
  const MAX_SLOPE = Math.tan(15 * Math.PI / 180);   // 出口を地面に合わせるときの最大の勾配
  const WALL = .45, COVER = .25, STEP = .25;
  const SUBMESH = ['floor', 'wall', 'ceiling', 'portal', 'frame', 'lamp', 'shaft', 'decor'];   // decor: 坑口の岩・落石・根・つる・レール（当たり判定なし）。shaft: 壁の外側から地面まで立つ岩の面（屋根を透かしたときの切り口。ふだんは山の中）

  // ---- 区切り
  function stationsOf(t, H) {
    const P = t.pts, st = []; let s0 = 0;
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1], L = hyp(b.x - a.x, b.z - a.z); if (L < 1e-6) continue;
      const tx = (b.x - a.x) / L, tz = (b.z - a.z) / L, n = Math.max(1, Math.ceil(L / STEP));
      for (let q = st.length ? 1 : 0; q <= n; q++) { const u = q / n; st.push({ s: s0 + L * u, x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u, y: a.y + (b.y - a.y) * u, tx, tz, seg: i }); }
      s0 += L;
    }
    // 折れ目では、前後の向きの平均（壁が角でつながる）
    for (let k = 1; k < st.length - 1; k++) if (st[k].seg !== st[k + 1].seg) { const a = st[k], b = st[k + 1]; let x = a.tx + b.tx, z = a.tz + b.tz, l = hyp(x, z) || 1; a.tx = x / l; a.tz = z / l; }
    // 外と切り通しの境は、幅の左右の地面も見る（崖が斜めに口を横切ると、片側だけ先に地面が床より高くなる）
    for (const q of st) { q.nx = -q.tz; q.nz = q.tx; q.g = H(q.x, q.z); const e = t.w * .45, gm = Math.max(q.g, H(q.x + q.nx * e, q.z + q.nz * e), H(q.x - q.nx * e, q.z - q.nz * e)); q.cls = gm <= q.y + COVER ? 0 : q.g < q.y + t.h + COVER ? 1 : 2; }
    // 0.75m より短いトンネルの区間は切り通しにする（薄い屋根だけが浮かない）
    for (let k = 0; k < st.length;) {
      if (st[k].cls !== 2) { k++; continue; } let e = k; while (e + 1 < st.length && st[e + 1].cls === 2) e++;
      if (st[e].s - st[k].s < .75) for (let q = k; q <= e; q++) st[q].cls = 1;
      k = e + 1;
    }
    // 外か切り通しまでの、線にそった距離（入口からどれだけ奥か）
    let d = 1e9; for (const q of st) { d = q.cls < 2 ? 0 : d + STEP; q.toOpen = d; }
    d = 1e9; for (let k = st.length - 1; k >= 0; k--) { const q = st[k]; d = q.cls < 2 ? 0 : d + STEP; q.toOpen = Math.min(q.toOpen, d); }
    // 口の前の地面からの距離（外の区間で、切り通しかトンネルまで。口の前 1m は床の高さで歩く。崖のすそは急で、地面では歩けないため）
    d = 1e9; for (const q of st) { d = q.cls ? 0 : d + STEP; q.toMouth = d; }
    d = 1e9; for (let k = st.length - 1; k >= 0; k--) { const q = st[k]; d = q.cls ? 0 : d + STEP; q.toMouth = Math.min(q.toMouth, d); }
    return { t, st, len: s0 };
  }
  function prepare(tunnels, H) { return tunnels.filter(t => t.pts && t.pts.length >= 2).map(t => stationsOf(t, H)); }

  // 中心線へ一番近い点：線にそった距離 s、左右のずれ lat（左が +）、床の高さ y、区切りの番号 k
  function nearest(T, x, z) {
    const P = T.t.pts; let best = null, s0 = 0;
    for (let i = 0; i < P.length - 1; i++) {
      const a = P[i], b = P[i + 1], dx = b.x - a.x, dz = b.z - a.z, L = hyp(dx, dz); if (L < 1e-6) continue;
      const u = clamp(((x - a.x) * dx + (z - a.z) * dz) / (L * L), 0, 1), px = a.x + dx * u, pz = a.z + dz * u, d = hyp(x - px, z - pz);
      if (!best || d < best.d) best = { d, s: s0 + L * u, lat: ((x - px) * -dz + (z - pz) * dx) / L, y: a.y + (b.y - a.y) * u, u, end: (i === 0 && u === 0) || (i === P.length - 2 && u === 1) };
      s0 += L;
    }
    if (best) best.k = clamp(Math.round(best.s / T.len * (T.st.length - 1)), 0, T.st.length - 1);
    return best;
  }
  function stationAt(T, s) { const st = T.st; let lo = 0, hi = st.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (st[m].s <= s) lo = m; else hi = m; } return st[Math.abs(st[lo].s - s) <= Math.abs(st[hi].s - s) ? lo : hi]; }

  // (x, z) が、どれかのトンネル（切り通しか中）の床の上か。margin = 壁から離れる距離（体の半径）
  function query(prep, x, z, margin = 0) {
    let out = null;
    prep.forEach((T, i) => {
      const q = nearest(T, x, z); if (!q || q.end && q.d > 1e-6) return;
      const hw = T.t.w / 2 - margin; if (Math.abs(q.lat) > hw || q.d > hw) return;
      const S = stationAt(T, q.s); if (S.cls === 0 && S.toMouth > 1) return;
      if (!out || Math.abs(q.lat) < Math.abs(out.lat)) out = { i, y: q.y, lat: q.lat, s: q.s, cls: S.cls, w: T.t.w, h: T.t.h, toOpen: S.toOpen };
    });
    return out;
  }
  // (x, y, z) が、別のトンネル j の中（床から天井まで）か。枝分かれの所で、互いの壁・床・天井を消すのに使う
  function insideOther(prep, self, x, y, z) {
    for (let j = 0; j < prep.length; j++) {
      if (j === self) continue; const T = prep[j], q = nearest(T, x, z); if (!q || q.end && q.d > 1e-6) continue;
      if (Math.abs(q.lat) < T.t.w / 2 - .02 && q.d < T.t.w / 2 && y > q.y - .1 && y < q.y + T.t.h + .05 && stationAt(T, q.s).cls > 0) return true;
    }
    return false;
  }

  // ---- 地形の穴：入口（トンネルの端から 0.35m まで）と切り通しの、壁の外側まで
  function holes(prep, H, n, cell, half) {
    const m = n - 1, out = new Uint8Array(m * m);
    for (const T of prep) {
      const hw = T.t.w / 2 + WALL - .1, pr = profile(T.t.w, T.t.h); let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
      for (const q of T.st) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); z0 = Math.min(z0, q.z); z1 = Math.max(z1, q.z); }
      const i0 = Math.max(0, Math.floor((x0 - hw - 1 + half) / cell)), i1 = Math.min(m - 1, Math.ceil((x1 + hw + 1 + half) / cell));
      const j0 = Math.max(0, Math.floor((z0 - hw - 1 + half) / cell)), j1 = Math.min(m - 1, Math.ceil((z1 + hw + 1 + half) / cell));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        if (out[j * m + i]) continue;
        const cx = -half + (i + .5) * cell, cz = -half + (j + .5) * cell, q = nearest(T, cx, cz); if (!q || q.end && q.d > .2) continue;
        if (Math.abs(q.lat) > hw || q.d > hw + .2) continue;
        const S = stationAt(T, q.s); if (S.cls === 0) continue;
        const xa = -half + i * cell, za = -half + j * cell, hs = [H(xa, za), H(xa + cell, za), H(xa, za + cell), H(xa + cell, za + cell)];
        const lo = Math.min(...hs), hi = Math.max(...hs);
        if (hi <= q.y + .05) continue;
        if (S.cls === 1 || lo < q.y + archTop(pr, T.t.w / 2, q.lat) + .2) out[j * m + i] = 1;   // 地面が口の断面に食い込むセル（崖の面の、口のまわり）
      }
    }
    return out;
  }

  // ---- 網
  const C = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const unit = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  const vn2 = (x, y) => { const i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j, a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1), su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v); return a + (b - a) * su + (c - a) * sv + (a - b - c + d) * su * sv; };
  // 材質：描くときの模様（mat）。rock は崖と同じ岩肌（頂点の色は明るさの掛け算）、ほかは頂点の色が地の色。MOSSY を足すと上向きの面に苔
  const MAT = { rock: 0, brick: 1, stone: 2, wood: 3, dirt: 4, flag: 5, metal: 6, plant: 7, glow: 8 }, MOSSY = 16;
  const ROCK = [.54, .515, .455];   // 岩肌の平均の色（崖の地形と同じ式の真ん中。書き出しで掛ける）
  const PAL = {
    rock: { floor: [C(0x8a6f4f), C(0xa1845e)] },
    masonry: { wall: [C(0x8c8579), C(0xa79f8f)], floor: [C(0x7d776c), C(0x999284)], trim: [C(0x9d9584), C(0xbcb29d)] },
    mine: { floor: [C(0x7f6447), C(0x977a57)], wood: [C(0x684628), C(0x8c663f)], metal: [C(0x45464a), C(0x5c5a57)] },
    ruins: { wall: [C(0x767c6d), C(0x939786)], floor: [C(0x6e7163), C(0x8a8c7d)], trim: [C(0x8b8f80), C(0xaaac9c)], vine: [C(0x3f5a2a), C(0x5f7d38)] },
  };
  // 横断面：左の床の角 → 左の壁 → アーチ → 右の壁 → 右の床の角。[u 左右, v 床からの高さ, 天井なら 1]
  // nrm = 中へ向く法線 (u, v)、arc = 左の床の角からの長さ（石積みの段の模様）
  function profile(w, h) {
    const hw = w / 2, r = Math.min(hw * .85, h * .45), hs = h - r, NA = 10, out = [[-hw, 0, 0], [-hw, hs / 3, 0], [-hw, hs * 2 / 3, 0], [-hw, hs, 0]];
    for (let k = 1; k < NA; k++) { const a = Math.PI * (1 - k / NA); out.push([Math.cos(a) * hw, hs + Math.sin(a) * r, 1]); }
    out.push([hw, hs, 0], [hw, hs * 2 / 3, 0], [hw, hs / 3, 0], [hw, 0, 0]);
    const nrm = out.map(([u, v, c]) => { if (!c) return [u < 0 ? 1 : -1, 0]; const x = -u / hw / hw, y = -(v - hs) / r / r, l = hyp(x, y) || 1; return [x / l, y / l]; });
    const arc = [0]; for (let k = 1; k < out.length; k++) arc.push(arc[k - 1] + hyp(out[k][0] - out[k - 1][0], out[k][1] - out[k - 1][1]));
    return { pts: out, nrm, arc, hs, r };
  }
  const archTop = (pr, hw, lat) => { const l = Math.min(Math.abs(lat) / hw, 1); return pr.hs + pr.r * Math.sqrt(1 - l * l); };

  function build(prep, H) {
    const O = { pos: [], nor: [], col: [], uv: [], dk: [], glow: [], sub: [], mat: [] }, lamps = [];
    let ti = 0;
    // 三角形 1 枚。頂点 = { p, n?, c, uv?, d? }。法線があれば、表の向きを法線にそろえる（無ければ面の向き）
    const emit = (a, b, c, s, m, g = 0) => {
      const fn = cross(sub3(b.p, a.p), sub3(c.p, a.p)), fl = Math.hypot(fn[0], fn[1], fn[2]); if (!(fl > 1e-10)) return;
      if (s !== 4 && s !== 5 && s !== 7 && insideOther(prep, ti, (a.p[0] + b.p[0] + c.p[0]) / 3, (a.p[1] + b.p[1] + c.p[1]) / 3, (a.p[2] + b.p[2] + c.p[2]) / 3)) return;   // 枝分かれの口
      const f = [fn[0] / fl, fn[1] / fl, fn[2] / fl], vs = a.n && dot(add(add(a.n, b.n || f), c.n || f), f) < 0 ? [a, c, b] : [a, b, c];
      for (const v of vs) { O.pos.push(...v.p); O.nor.push(...(v.n || f)); O.col.push(...v.c); O.uv.push(...(v.uv || [0, 0])); O.dk.push(v.d || 0); O.glow.push(g); }
      O.sub.push(s); O.mat.push(m);
    };
    const quad = (a, b, c, d, s, m, g) => { emit(a, b, c, s, m, g); emit(a, c, d, s, m, g); };
    const lerpV = (a, b, t) => ({ p: a.p.map((x, i) => x + (b.p[i] - x) * t), n: a.n && b.n ? unit(a.n.map((x, i) => x + (b.n[i] - x) * t)) : a.n || b.n, c: a.c.map((x, i) => x + (b.c[i] - x) * t), uv: a.uv && b.uv ? [a.uv[0] + (b.uv[0] - a.uv[0]) * t, a.uv[1] + (b.uv[1] - a.uv[1]) * t] : a.uv, d: (a.d || 0) + ((b.d || 0) - (a.d || 0)) * t });
    // 多角形を f ≥ 0 の側だけ残して切る（f は頂点で線形に補間）
    const clip = (vs, f) => { const val = vs.map(v => f(v.p)), out = []; for (let i = 0; i < vs.length; i++) { const j = (i + 1) % vs.length, a = val[i], b = val[j]; if (a >= 0) out.push(vs[i]); if ((a >= 0) !== (b >= 0)) out.push(lerpV(vs[i], vs[j], a / (a - b))); } return out; };
    const fan = (ps, s, m, g) => { for (let k = 1; k + 1 < ps.length; k++) emit(ps[0], ps[k], ps[k + 1], s, m, g); };
    const under = p => H(p[0], p[2]) - .03 - p[1];   // 地面より下（岩の中）なら正
    // 局所の枠 F = { o 原点, ax 左右, aw 前後（坑口では外向き） }。P(F, u, v, w)、D = 向き
    const P = (F, u, v, w) => [F.o[0] + F.ax[0] * u + F.aw[0] * w, F.o[1] + v, F.o[2] + F.ax[2] * u + F.aw[2] * w];
    const D = (F, r) => [F.ax[0] * r[0] + F.aw[0] * r[2], r[1], F.ax[2] * r[0] + F.aw[2] * r[2]];
    const rot = ([rx, ry, rz]) => { const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
      return v => { let [x, y, z] = v; [x, y] = [x * cz - y * sz, x * sz + y * cz]; [y, z] = [y * cx - z * sx, y * sx + z * cx]; [x, z] = [x * cy + z * sy, -x * sy + z * cy]; return [x, y, z]; }; };
    // 8 つの角の塊（下の 4 つ、上の 4 つの順で輪）を、外向きの平らな面で
    const solid = (k8, color, s, m, d = 0, g = 0, uvOf = null) => {
      const cen = k8.reduce((a, p) => add(a, p), [0, 0, 0]).map(x => x / 8);
      for (const [i, j, k, l] of [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]) {
        const fc = [k8[i], k8[j], k8[k], k8[l]].reduce((a, p) => add(a, p), [0, 0, 0]).map(x => x / 4);
        let n = unit(cross(sub3(k8[j], k8[i]), sub3(k8[k], k8[i]))); if (dot(n, sub3(fc, cen)) < 0) n = n.map(x => -x);
        const V = p => ({ p, n, c: color, d, uv: uvOf ? uvOf(p, n) : [p[0] + p[2], p[1]] });
        quad(V(k8[i]), V(k8[j]), V(k8[k]), V(k8[l]), s, m, g);
      }
    };
    // 直方体：底の中心 c0 = [u, v, w]、大きさ [du, dv, dw]、回し方 r = [rx, ry, rz]（底の中心のまわり）
    const box = (F, c0, size, color, s, m, r = [0, 0, 0], d = 0, g = 0) => {
      const R = rot(r), [du, dv, dw] = size, L = (a, b, c) => { const q = R([a, b, c]); return P(F, c0[0] + q[0], c0[1] + q[1], c0[2] + q[2]); };
      const long = du >= dv && du >= dw ? 0 : dv >= dw ? 1 : 2, A = D(F, R(long === 0 ? [1, 0, 0] : long === 1 ? [0, 1, 0] : [0, 0, 1])), Bv = D(F, R(long === 1 ? [1, 0, 0] : [0, 1, 0]));
      const k8 = [L(-du / 2, 0, -dw / 2), L(du / 2, 0, -dw / 2), L(du / 2, 0, dw / 2), L(-du / 2, 0, dw / 2), L(-du / 2, dv, -dw / 2), L(du / 2, dv, -dw / 2), L(du / 2, dv, dw / 2), L(-du / 2, dv, dw / 2)];
      solid(k8, color, s, m, d, g, p => [dot(p, A) * 1, dot(p, Bv) + dot(p, cross(A, Bv)) * .7]);   // 木目は長い向き
    };
    // 角柱（柱・円柱の胴）：底の中心 c0、半径 rad、長さ len（局所の上向き）、面の数 n
    const prism = (F, c0, rad, len, n, color, s, m, r = [0, 0, 0], d = 0, a0 = 0) => {
      const R = rot(r), L = (x, y, z) => { const q = R([x, y, z]); return P(F, c0[0] + q[0], c0[1] + q[1], c0[2] + q[2]); }, Nn = (x, y, z) => unit(D(F, R([x, y, z])));
      const top = { p: L(0, len, 0), n: Nn(0, 1, 0), c: color, d }, bot = { p: L(0, 0, 0), n: Nn(0, -1, 0), c: color, d };
      for (let k = 0; k < n; k++) {
        const a = a0 + k / n * Math.PI * 2, b = a0 + (k + 1) / n * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
        const V = (c, s0, y) => ({ p: L(c * rad, y, s0 * rad), n: Nn(c, 0, s0), c: color, d, uv: [y * 1.0, (k + (c === cb ? 1 : 0)) / n * rad * 6] });
        quad(V(ca, sa, 0), V(cb, sb, 0), V(cb, sb, len), V(ca, sa, len), s, m);
        emit({ ...top, p: top.p }, { p: L(cb * rad, len, sb * rad), n: top.n, c: color, d }, { p: L(ca * rad, len, sa * rad), n: top.n, c: color, d }, s, m);
        emit({ ...bot }, { p: L(ca * rad, 0, sa * rad), n: bot.n, c: color, d }, { p: L(cb * rad, 0, sb * rad), n: bot.n, c: color, d }, s, m);
      }
    };
    // 2 点の間の角材（筋交い・レール）
    const beam = (A, B, tw, th, color, s, m, d = 0) => {
      const dir = unit(sub3(B, A)), side = unit(Math.abs(dir[1]) > .9 ? [1, 0, 0] : cross(dir, [0, 1, 0])), up = cross(side, dir);
      const k = (p, a, b) => add(p, add(side.map(x => x * a), up.map(x => x * b)));
      solid([k(A, -tw / 2, -th / 2), k(B, -tw / 2, -th / 2), k(B, tw / 2, -th / 2), k(A, tw / 2, -th / 2), k(A, -tw / 2, th / 2), k(B, -tw / 2, th / 2), k(B, tw / 2, th / 2), k(A, tw / 2, th / 2)], color, s, m, d, 0, p => [dot(p, dir), dot(p, up) + dot(p, side)]);
    };
    // 岩の塊：ゆがめた正二十面体（1 回分割、80 面）、なめらかな法線
    const lump = (cen, rx, ry, rz, yaw, seed, color, s) => {
      // 割れた面：3 つの平面で切り落とし、面の向きを強めにした法線（角ばった岩）
      const cuts = [0, 1, 2].map(i => ({ n: unit([hash(i, seed) - .5, hash(i + 3, seed) - .3, hash(i + 6, seed) - .5]), d: .5 + .3 * hash(i + 9, seed) }));
      const loc = ICO.v.map((v, i) => { let p = v.map(x => x * (1 + (vn2(v[0] * 1.9 + seed, v[1] * 1.9 + v[2] * 1.5 - seed) - .5) * .55 + (hash(i, seed) - .5) * .16)); for (const c of cuts) { const e = dot(p, c.n) - c.d; if (e > 0) p = sub3(p, c.n.map(x => x * e)); } if (p[1] < -.45) p = [p[0], -.45 - (p[1] + .45) * .2, p[2]]; return p; });
      const cy = Math.cos(yaw), sy = Math.sin(yaw), pt = i => { const [x, y, z] = loc[i], X = x * rx, Y = y * ry, Z = z * rz; return [cen[0] + X * cy + Z * sy, cen[1] + Y, cen[2] - X * sy + Z * cy]; };
      const nm = i => { const [x, y, z] = ICO.v[i], X = x / rx, Y = y / ry, Z = z / rz; return unit([X * cy + Z * sy, Y, -X * sy + Z * cy]); };
      const shadeOf = i => { const k = .82 + .2 * hash(i, seed + 3) - .2 * Math.max(0, -ICO.v[i][1]); return [color[0] * k, color[1] * k, color[2] * k]; };
      for (const f of ICO.f) {
        const p = f.map(pt), fn = unit(cross(sub3(p[1], p[0]), sub3(p[2], p[0]))), fo = dot(fn, sub3(p[0], cen)) < 0 ? fn.map(x => -x) : fn;
        const V = (i, k) => ({ p: p[k], n: unit(add(fo.map(x => x * .7), nm(i).map(x => x * .3))), c: shadeOf(i) });
        emit(V(f[0], 0), V(f[1], 1), V(f[2], 2), s, MAT.rock);
      }
    };
    // 垂れ下がる根・つる：上の点 top から長さ len、幅 wd の細い帯（前後の向き aw に面を向ける）
    const strand = (top, F, len, wd, color, m, seed) => {
      const n = 6, pts = []; for (let k = 0; k <= n; k++) { const t = k / n, sw = Math.sin(t * 2.6 + seed) * .06 * t; pts.push([top[0] + F.ax[0] * sw + F.aw[0] * t * .05, top[1] - len * t, top[2] + F.ax[2] * sw + F.aw[2] * t * .05]); }
      const nn = unit(F.aw.map(x => x)); for (let k = 0; k < n; k++) {
        const w0 = wd * (1 - k / n * .6), w1 = wd * (1 - (k + 1) / n * .6), V = (p, w, t) => ({ p: [p[0] + F.ax[0] * w, p[1], p[2] + F.ax[2] * w], n: nn, c: mix(color, color.map(x => x * .7), t), uv: [t * len, w] });
        quad(V(pts[k], -w0 / 2, k / n), V(pts[k], w0 / 2, k / n), V(pts[k + 1], w1 / 2, (k + 1) / n), V(pts[k + 1], -w1 / 2, (k + 1) / n), 7, m);
      }
    };

    prep.forEach((T, tIndex) => {
      ti = tIndex;
      const t = T.t, st = T.st, style = PAL[t.style] ? t.style : 'rock', pal = PAL[style], hw = t.w / 2, pr = profile(t.w, t.h), seed = (t.id || '').split('').reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7) % 997;
      const W = (q, u, v) => [q.x + q.nx * u, q.y + v, q.z + q.nz * u];
      const dkOf = q => 1 - Math.exp(-(q.toOpen || 0) / 2.2);   // 奥ほど暗い（0 = 入口）
      const tone = (pair, a, b) => mix(pair[0], pair[1], hash(a + seed, b));
      const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
      const brick = style === 'masonry' || style === 'ruins', wallMat = brick ? MAT.brick | (style === 'ruins' ? MOSSY : 0) : MAT.rock;
      const floorMat = brick ? MAT.flag | (style === 'ruins' ? MOSSY : 0) : MAT.dirt;
      // 素掘り・坑道の壁は、中へだけふくらむでこぼこ（口のまわりで地面の縁より外へ出ない）
      const rough = style === 'rock' ? .2 : style === 'mine' ? .14 : style === 'ruins' ? .03 : 0, last = pr.pts.length - 1;
      const ring = q => pr.pts.map(([u, v, c], k) => {
        const [nu, nv] = pr.nrm[k], b = k === 0 || k === last ? 0 : rough * (vn2(q.s * 1.4 + seed, k * .8) * .75 + hash(Math.round(q.s * 8) + seed, k) * .25);
        const uu = u + nu * b, vv = v + nv * b, ao = c ? .9 : .6 + .4 * sstep(0, .9, vv);
        const base = brick ? tone(pal.wall, 3, 1) : [1, 1, 1], vary = brick ? 1 : .86 + .22 * vn2(q.s * .9 + seed, k * .5 + 3);
        return { p: W(q, uu, vv), n: [q.nx * nu, nv, q.nz * nu], c: shade(base, ao * vary), uv: [q.s, pr.arc[k]], d: dkOf(q) };
      });
      const rings = st.map(q => q.cls ? ring(q) : null);
      // 床（中の区間と、口の外 0.5m。外では地面に沿わせて、地面の下へもぐる）
      const fl = [-hw, -hw / 2, 0, hw / 2, hw];
      const floorV = (q, u) => {
        const x = q.x + q.nx * u, z = q.z + q.nz * u, y = q.cls ? q.y + .01 : clamp(H(x, z) + .02, q.y - .35, q.y + .01), ao = 1 - .3 * sstep(.45, 1, Math.abs(u) / hw);
        return { p: [x, y, z], n: [0, 1, 0], c: shade(tone(pal.floor, 5, 2), ao), uv: [q.s, u], d: q.cls ? dkOf(q) : 0 };
      };
      const onFloor = q => q.cls > 0 || q.toMouth <= .5;
      for (let k = 0; k + 1 < st.length; k++) {
        const a = st[k], b = st[k + 1]; if (!onFloor(a) || !onFloor(b)) continue;
        for (let p = 0; p < 4; p++) quad(floorV(a, fl[p]), floorV(b, fl[p]), floorV(b, fl[p + 1]), floorV(a, fl[p + 1]), 0, floorMat);
      }
      // 中：壁・天井。地面より上に出る所は切り落とす（口の奥行きと切り通しの側面が、地面との交わりできれいに終わる）
      for (let k = 0; k + 1 < st.length; k++) {
        const a = st[k], b = st[k + 1]; if (!a.cls || !b.cls) continue;
        const ra = rings[k], rb = rings[k + 1], deep = a.toOpen > 4 && b.toOpen > 4 && a.cls === 2 && b.cls === 2;
        for (let p = 0; p + 1 < ra.length; p++) {
          const s = pr.pts[p][2] || pr.pts[p + 1][2] ? 2 : 1, poly = [ra[p], ra[p + 1], rb[p + 1], rb[p]];
          if (deep) quad(...poly, s, wallMat); else fan(clip(poly, under), s, wallMat);
        }
        if (a.cls !== 2 || b.cls !== 2) continue;
        // 屋根を透かしたときの切り口：壁の外側に、床の下から真上の地面まで立つ暗い岩の面
        for (const sd of [-1, 1]) {
          const u = sd * (hw + .28), A0 = W(a, u, -.1), B0 = W(b, u, -.1), n = [-sd * a.nx, 0, -sd * a.nz], c = [.72, .72, .72], V = p => ({ p, n, c, d: .35 });
          quad(V(A0), V(B0), V([B0[0], H(B0[0], B0[2]) - .03, B0[2]]), V([A0[0], H(A0[0], A0[2]) - .03, A0[2]]), 6, MAT.rock);
        }
        const F = { o: [a.x, a.y, a.z], ax: [a.nx, 0, a.nz], aw: [a.tx, 0, a.tz] }, wd = tone(pal.wood || [[.4, .3, .2], [.5, .38, .25]], k, 1), kd = dkOf(a);
        // 坑道：1.8m ごとに木の支保工（左右の丸太の柱と梁）
        if (style === 'mine' && Math.floor(a.s / 1.8) !== Math.floor(b.s / 1.8) && a.toOpen > .6) {
          for (const sd of [-1, 1]) prism(F, [sd * (hw - .13), 0, 0], .11, pr.hs + .22, 7, wd, 4, MAT.wood, [0, 0, 0], kd, k);
          box(F, [0, pr.hs + .2, 0], [t.w - .05, .2, .22], wd, 4, MAT.wood, [0, 0, 0], kd);
        }
        // 灯り：入口から 2m より奥で、およそ 7m ごと、左右交互の壁に
        if (Math.floor(a.s / 7) !== Math.floor(b.s / 7) && a.toOpen > 2) {
          const side = Math.floor(a.s / 7) % 2 ? 1 : -1, y = style === 'mine' ? pr.hs + .05 : Math.min(pr.hs, 1.9) - .1;
          if (style === 'mine') {   // 梁から吊るしたランタン
            box(F, [0, y - .45, 0], [.03, .4, .03], C(0x2a2622), 4, MAT.metal); lantern(F, [0, y - .78, 0]);
            lamps.push({ x: a.x, y: a.y + y - .65, z: a.z, color: 0xffb35a });
          } else {   // 壁の松明
            const u = side * (hw - .12); torch(F, [u, y - .35, 0], -side);
            lamps.push({ x: a.x + a.nx * u, y: a.y + y + .1, z: a.z + a.nz * u, color: 0xff9a40 });
          }
        }
      }
      function lantern(F, c0) {
        box(F, c0, [.2, .03, .2], C(0x2e2b28), 4, MAT.metal); box(F, [c0[0], c0[1] + .27, c0[2]], [.2, .04, .2], C(0x2e2b28), 4, MAT.metal);
        box(F, [c0[0], c0[1] + .03, c0[2]], [.15, .24, .15], C(0xffd27a), 5, MAT.glow, [0, 0, 0], 0, 1);
      }
      function torch(F, c0, inward) {   // 壁の松明：腕木、柄、炎
        box(F, [c0[0], c0[1], c0[2]], [.07, .38, .07], C(0x4a3624), 4, MAT.wood, [0, 0, inward * .25]);
        box(F, [c0[0] + inward * .09, c0[1] + .38, c0[2]], [.13, .2, .13], C(0xffb040), 5, MAT.glow, [0, 0, 0], 0, 1);
      }
      // 行き止まり（トンネルの区間で終わる端、ほかのトンネルの中でない）：奥の壁
      for (const [k, dir] of [[0, -1], [st.length - 1, 1]]) {
        const q = st[k]; if (q.cls !== 2 || insideOther(prep, ti, q.x, q.y + 1, q.z)) continue;
        const r = rings[k], n = [-q.tx * dir, 0, -q.tz * dir], c = { p: W(q, 0, pr.hs * .6), n, c: [.8, .8, .8], d: dkOf(q) };
        for (let p = 0; p + 1 < r.length; p++) emit(c, { ...r[p], n }, { ...r[p + 1], n }, 1, wallMat);
        emit({ ...r[0], n }, { ...r[r.length - 1], n }, c, 1, wallMat);
        const e = hw + .28, A0 = W(q, -e, -.1), B0 = W(q, e, -.1), V = p => ({ p, n, c: [.5, .5, .5], d: .6 });   // 切り口：行き止まりの上も地面まで
        quad(V(A0), V(B0), V([B0[0], H(B0[0], B0[2]) - .03, B0[2]]), V([A0[0], H(A0[0], A0[2]) - .03, A0[2]]), 6, MAT.rock);
      }
      // ---- 坑口：トンネルの区間の端から外へ、地面が天井の高さより下がる所（崖や斜面の面）に、種類ごとの枠と飾り
      for (let k = 0; k < st.length; k++) {
        const q0 = st[k]; if (q0.cls !== 2) continue;
        for (const o of [-1, 1]) {
          if (!st[k + o] || st[k + o].cls === 2 || insideOther(prep, ti, st[k + o].x, st[k + o].y + 1, st[k + o].z)) continue;
          let m = k + o; while (st[m + o] && st[m].g > st[m].y + t.h) m += o;
          const q = st[m], F0 = { o: [q.x, q.y, q.z], ax: [q.nx * o, 0, q.nz * o], aw: [q.tx * o, 0, q.tz * o] }, ms = hash(k + seed, o + 5) * 100;
          // 崖の面：局所の (u, v) の高さで、地面が v より高い一番外の w（崖の表面）。見つからなければ null
          const faceW0 = (F, u, v) => { for (let w = 1.6; w >= -1.6; w -= .05) { const p = P(F, u, 0, w); if (H(p[0], p[2]) >= q.y + v) return w; } return null; };
          // 枠は、いちばん上の石・梁の高さで崖の面に合わせる（斜面では少し奥へ下げ、上の端が崖の上へ突き出さない）
          const topOf = style === 'rock' ? 0 : style === 'mine' ? pr.hs + 1.1 : pr.hs + pr.r + .65, wTop = topOf ? faceW0(F0, 0, topOf) : null;
          const F = wTop === null ? F0 : { ...F0, o: P(F0, 0, 0, clamp(wTop - .2, -1.2, .6)) }, faceW = (u, v) => faceW0(F, u, v);
          const groundV = (u, w) => { const p = P(F, u, 0, w); return H(p[0], p[2]) - q.y; };
          // 口の輪郭にそった点（左の壁の下から、アーチを回って右の壁の下まで）：[u, v, 外向きの (du, dv)]
          const outline = f => {
            const L1 = pr.hs - .05, L2 = Math.PI * (hw + pr.r) / 2, tot = L1 * 2 + L2, d = f * tot;
            if (d < L1) return [-hw, .05 + d, -1, 0];
            if (d > L1 + L2) return [hw, .05 + (tot - d), 1, 0];
            const a = Math.PI * (1 - (d - L1) / L2), nx = Math.cos(a) / hw, ny = Math.sin(a) / pr.r, l = hyp(nx, ny);
            return [Math.cos(a) * hw, pr.hs + Math.sin(a) * pr.r, nx / l, ny / l];
          };
          if (style === 'rock') {
            // ふちの岩：口の輪郭のまわりに、崖の面へ半分埋めて並べる（口の中へは、頭より上だけ少しはみ出す）
            const n = Math.round(8 + t.w * 2);
            for (let i = 0; i < n; i++) {
              const f = (i + .2 + .6 * hash(i, ms)) / n, [u, v, du, dv] = outline(f), rad = .24 + .28 * hash(i + 3, ms) + (v > pr.hs ? .1 : 0) + (v < .6 ? .08 : 0);
              const off = rad * (v > 1.9 ? .5 : 1.0), cu = u + du * off, cv = v + dv * off, w = faceW(cu, cv);
              if (w === null || w < -.8) continue;
              lump(P(F, cu, cv, Math.min(w, 1.2) - rad * .3), rad * (1.1 + .4 * hash(i, 9)), rad * (.7 + .25 * hash(i, 11)), rad * (.75 + .2 * hash(i, 13)), hash(i, ms + 2) * 6.3, ms + i * 7, [.92, .92, .92], 7);
            }
            // 足もとの落石
            for (let i = 0; i < 7; i++) {
              const sd = i % 2 ? 1 : -1, u = sd * (hw + .15 + 1.1 * hash(i, ms + 4)), w0 = faceW(u, .15), w = (w0 === null ? 0 : w0) + .1 + .9 * hash(i, ms + 6), r = .07 + .14 * hash(i, ms + 8);
              lump(P(F, u, groundV(u, w) + r * .25, w), r * 1.2, r * .75, r, hash(i, 3) * 6, ms + 40 + i, [.86, .86, .86], 7);
            }
            // 口の上から垂れる根
            for (let i = 0; i < 5; i++) {
              const u = (hash(i, ms + 12) - .5) * hw * 1.3, v = archTop(pr, hw, u) - .02, w = faceW(u, v + .1);
              if (w !== null) strand(P(F, u, v, Math.min(w, .8) + .02), F, .25 + .6 * hash(i, ms + 13), .035, C(0x4b3726), MAT.wood, i * 1.7);
            }
          } else if (style === 'mine') {
            const wd = i => tone(pal.wood, k + i, 2), F2 = { ...F, o: P(F, 0, 0, .05) };
            for (const sd of [-1, 1]) {
              prism(F2, [sd * (hw + .06), 0, 0], .14, pr.hs + .48, 8, wd(sd), 4, MAT.wood, [0, 0, sd * .03], 0, ms);
              beam(P(F2, sd * (hw + .02), pr.hs - .3, 0), P(F2, sd * (hw - .55), pr.hs + .42, 0), .12, .12, wd(sd + 4), 4, MAT.wood);   // 方杖
            }
            box(F2, [0, pr.hs + .4, 0], [t.w + .95, .3, .32], wd(0), 4, MAT.wood, [0, 0, (hash(k, ms) - .5) * .04]);   // 梁
            for (let i = 0; i < 3; i++) box(F2, [(hash(i, ms) - .5) * .2, pr.hs + .72 + i * .15, -.04], [t.w + .5 - i * .35, .13, .07], wd(i + 7), 4, MAT.wood, [0, 0, (hash(i, ms + 1) - .5) * .05]);   // 矢板
            box(F2, [-(hw + .06), 1.25, .19], [.5, .3, .04], tone(pal.wood, 3, 9).map(x => x * .8), 4, MAT.wood, [0, 0, .06]);   // 札
            // 右の柱のランタン（腕木から吊るす）
            const lu = hw + .06;
            box(F2, [lu, 1.95, .2], [.05, .05, .32], C(0x2e2b28), 4, MAT.metal); box(F2, [lu, 1.74, .33], [.025, .2, .025], C(0x2e2b28), 4, MAT.metal); lantern(F2, [lu, 1.43, .33]);
            const lp = P(F2, lu, 1.58, .33); lamps.push({ x: lp[0], y: lp[1], z: lp[2], color: 0xffb35a });
            // レールと枕木：中から口の外 1.6m まで
            const g = Math.min(.42, hw * .36), rail = pal.metal[0];
            for (let j = 0; j + 1 < st.length; j++) {
              const a = st[j], b = st[j + 1], da = (a.s - q.s) * o, db = (b.s - q.s) * o;
              if (Math.min(da, db) < -3.5 || Math.max(da, db) > 1.6) continue;
              const yA = (qq, u) => { const x = qq.x + qq.nx * u, z = qq.z + qq.nz * u; return qq.cls ? qq.y + .01 : Math.max(H(x, z), qq.y - .35) + .01; };
              for (const sd of [-1, 1]) beam([a.x + a.nx * sd * g, yA(a, sd * g) + .1, a.z + a.nz * sd * g], [b.x + b.nx * sd * g, yA(b, sd * g) + .1, b.z + b.nz * sd * g], .05, .06, rail, 7, MAT.metal, a.cls ? dkOf(a) : 0);
              if (Math.floor(a.s / .6) !== Math.floor(b.s / .6)) { const Fa = { o: [a.x, yA(a, 0), a.z], ax: [a.nx, 0, a.nz], aw: [a.tx, 0, a.tz] }; box(Fa, [0, 0, 0], [g * 2 + .4, .07, .14], tone(pal.wood, j, 5).map(x => x * .8), 7, MAT.wood, [0, (hash(j, 2) - .5) * .12, 0], a.cls ? dkOf(a) : 0); }
            }
          } else {
            // 石積み・遺跡：迫石（くさび形の石）と要石、迫り元の台、側柱（たがい違いの隅石）
            const ruins = style === 'ruins', sm = ruins ? MAT.stone | MOSSY : MAT.stone, NB = t.w < 2 ? 7 : t.w > 3 ? 11 : 9, key = NB >> 1;
            const stone = i => shade(tone(pal.trim, i, k), .9 + .14 * hash(i, ms + 21));
            for (let i = 0; i < NB; i++) {
              if (ruins && i !== key && Math.abs(i - key) > 1 && hash(i, ms + 30) > .72) continue;   // 遺跡：抜け落ちた石
              const g = .012 / pr.r, a0 = Math.PI * (1 - i / NB) - g, a1 = Math.PI * (1 - (i + 1) / NB) + g, T0 = i === key ? .62 : .44, wf = i === key ? .3 : .2 + .03 * hash(i, ms), wb = -.4;
              const I = a => [Math.cos(a) * (hw + .01), pr.hs + Math.sin(a) * (pr.r + .01)], Ou = (a, th) => { const [u, v] = I(a); return [u + Math.cos(a) * th, v + Math.sin(a) * th]; };
              const sag = ruins ? (hash(i, ms + 31) - .5) * .06 : 0, [u0, v0] = I(a0), [u1, v1] = I(a1), [x0, y0] = Ou(a0, T0), [x1, y1] = Ou(a1, T0), [xm, ym] = Ou((a0 + a1) / 2, T0), fw = faceW(xm, ym);
              if (fw !== null && fw > wf + .05) continue;   // 崖の中に埋まった石
              solid([P(F, u0, v0 + sag, wb), P(F, u1, v1 + sag, wb), P(F, x1, y1 + sag, wb), P(F, x0, y0 + sag, wb), P(F, u0, v0 + sag, wf), P(F, u1, v1 + sag, wf), P(F, x1, y1 + sag, wf), P(F, x0, y0 + sag, wf)], stone(i), 4, sm);
            }
            // 側柱・台：崖に埋まる石は作らない（崖が口の脇で前へ出ている側。角だけが崖から飛び出さない）
            const buried = (u, v, wFront) => { const fw = faceW(u, v); return fw !== null && fw > wFront - .02; };
            for (const sd of [-1, 1]) {
              // 隅石：0.4m ごと、幅をたがい違いに
              for (let c = 0, v = .22; v < pr.hs - .17; c++, v += .4) { const wdt = (c + (sd > 0 ? 1 : 0)) % 2 ? .62 : .44, h = Math.min(.4, pr.hs - .17 - v) - .012; if (!buried(sd * (hw + wdt), v + h / 2, .18)) box(F, [sd * (hw + wdt / 2), v, -.08], [wdt, h, .52], stone(c * 3 + sd + 50), 4, sm); }
              if (!buried(sd * (hw + .63), pr.hs - .1, .24)) box(F, [sd * (hw + .3), pr.hs - .17, -.06], [.66, .17, .6], stone(sd + 70), 4, sm);   // 迫り元の台
              if (!buried(sd * (hw + .71), .11, .26)) box(F, [sd * (hw + .34), 0, -.05], [.74, .22, .62], stone(sd + 80), 4, sm);   // 台石
            }
            if (!ruins) {
              for (const sd of [-1, 1]) {   // 側柱（埋まっていれば崖の面）に松明
                const u = sd * (hw + .3), fw = faceW(u, 1.6), w = Math.max(.18, fw === null ? .18 : fw + .02);
                box(F, [u, 1.62, w + .04], [.06, .06, .2], C(0x2e2b28), 4, MAT.metal); torch({ ...F, o: P(F, 0, 0, w + .12) }, [u, 1.5, 0], 0); const lp = P(F, u, 2.0, w + .12); lamps.push({ x: lp[0], y: lp[1], z: lp[2], color: 0xff9a40 });
              }
            } else {
              // 遺跡：左右の円柱（台・胴・柱頭）と楣石。片方の柱が崩れていることがある
              const broken = hash(k + seed, 9) > .5, nd = Math.max(3, Math.ceil((t.h - .3) / .62)), topV = .22 + nd * .62, pw = [];
              for (const sd of [-1, 1]) {
                // 柱は崖の面の手前に立てる（面が外へ出ている側では、そのぶん前へ）
                const u = sd * (hw + .98), br = broken && sd < 0, fw = faceW(u, topV * .6), w = clamp((fw === null ? 0 : fw) + .38, .05, 1.8); pw.push(w);
                const b0 = Math.max(0, groundV(u, w)); box(F, [u, b0 - .05, w], [.74, .27, .74], stone(sd + 90), 4, sm);
                const n = br ? 2 : nd; for (let d = 0; d < n; d++) prism(F, [u + (hash(d, sd + ms) - .5) * .03, b0 + .22 + d * .62, w], .25 - d * .006, .6, 10, stone(d + sd * 7 + 95), 4, sm, [0, hash(d, sd) * .5, 0]);
                pw.top = Math.max(pw.top || 0, b0 + topV);
                if (!br) box(F, [u, b0 + topV, w], [.7, .2, .7], stone(sd + 99), 4, sm);
                else { prism(F, [u + 1.0 * -sd, groundV(u - sd, w + .9) + .25, w + .9], .25, .6, 10, stone(sd + 98), 4, sm, [Math.PI / 2, .7, 0]); box(F, [u + .25 * -sd, groundV(u, w + 1.1), w + 1.1], [.5, .3, .42], stone(sd + 97), 4, sm, [0, .6, .2]); }
              }
              if (!broken && Math.abs(pw[0] - pw[1]) < .45) box(F, [0, pw.top + .2, (pw[0] + pw[1]) / 2], [t.w + 2.6, .34, .62], stone(110), 4, sm, [0, Math.atan2(pw[1] - pw[0], 2 * (hw + .98)), 0]);
              // 落ちた迫石と小石
              for (let i = 0; i < 4; i++) { const sd = i % 2 ? 1 : -1, u = sd * (hw + .2 + .8 * hash(i, ms + 40)), fw = faceW(u, .25), w = Math.max(fw === null ? 0 : fw + .15, 0) + .3 + .9 * hash(i, ms + 41); box(F, [u, groundV(u, w) - .03, w], [.3 + .2 * hash(i, 1), .22, .26], stone(i + 120), 7, sm, [hash(i, 2) * .5, hash(i, 3) * 3, hash(i, 4) * .4]); }
              // 上から垂れるつる
              const noLintel = broken || Math.abs(pw[0] - pw[1]) >= .45, vTop = noLintel ? pr.hs + pr.r + .45 : pw.top + .2;
              for (let i = 0; i < 8; i++) {
                const sd = i % 2 ? 1 : -1, u = sd * (noLintel ? hw * .55 + (hw * .5 + .3) * hash(i, ms + 50) : hw * .3 + (hw + .9) * hash(i, ms + 50)), top = noLintel ? archTop(pr, hw, Math.min(Math.abs(u), hw)) + .4 : vTop;
                // 迫石の上の外側から、口の脇へ垂れる（口の真ん中には垂らさない）
                strand(P(F, u, top, noLintel ? .24 : (pw[0] + pw[1]) / 2 + .32), F, Math.min(top - .4, .5 + 1.3 * hash(i, ms + 51)), .1, tone(pal.vine, i, 3), MAT.plant, i * 2.1);
              }
            }
          }
        }
      }
    });
    return { pos: new Float32Array(O.pos), nor: new Float32Array(O.nor), col: new Float32Array(O.col), uv: new Float32Array(O.uv), dk: new Float32Array(O.dk), glow: new Float32Array(O.glow), sub: Uint8Array.from(O.sub), mat: Uint8Array.from(O.mat), lamps };
  }
  // 正二十面体を 1 回分割した球（岩の塊の元）
  const ICO = (() => {
    const g = (1 + Math.sqrt(5)) / 2, v = [[-1, g, 0], [1, g, 0], [-1, -g, 0], [1, -g, 0], [0, -1, g], [0, 1, g], [0, -1, -g], [0, 1, -g], [g, 0, -1], [g, 0, 1], [-g, 0, -1], [-g, 0, 1]].map(unit);
    let f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    const mid = new Map(), m = (a, b) => { const key = a < b ? a + ',' + b : b + ',' + a; if (!mid.has(key)) { v.push(unit(add(v[a], v[b]))); mid.set(key, v.length - 1); } return mid.get(key); };
    f = f.flatMap(([a, b, c]) => { const ab = m(a, b), bc = m(b, c), ca = m(c, a); return [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]]; });
    return { v, f };
  })();

  // ---- 口のまわりの地面（cap）：穴を開けたセルの地面を 1/res の細かい格子で作り直し、トンネルの口（床から天井までの断面の中）を切り抜く。
  // 境目をまたぐ四角は、もう半分に分けてから、口の輪郭で切る（細い三角形が口に垂れ下がらない）。
  // 地形と同じ材質で描く（高さは格子の双一次補間）。返すのは (x, z) の三角形の並び（上から見て表の向き）
  function cap(prep, H, mask, n, cell, half, res = 4) {
    const m = n - 1, tris = [], f = cell / res, pr = prep.map(T => profile(T.t.w, T.t.h));
    const field = (x, z) => {   // 負 = 口の中（地面を描かない）
      let best = 1;
      prep.forEach((T, i) => {
        const q = nearest(T, x, z); if (!q || q.end && q.d > 1e-6) return;
        const S = stationAt(T, q.s); if (S.cls === 0) return;
        const hw = T.t.w / 2, v = H(x, z) - q.y;
        best = Math.min(best, Math.max(Math.abs(q.lat) - (hw + .02), -.05 - v, v - (archTop(pr[i], hw, q.lat) + .02)));
      });
      return best;
    };
    const put = (a, b, c) => { const cr = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]); if (Math.abs(cr) < 1e-12) return; if (cr > 0) tris.push(...a, ...b, ...c); else tris.push(...a, ...c, ...b); };
    const cut = (x0, z0, s, depth) => {
      const ps = [[x0, z0], [x0 + s, z0], [x0 + s, z0 + s], [x0, z0 + s]], fv = ps.map(p => field(p[0], p[1]));
      if (fv.every(v => v >= 0) && field(x0 + s / 2, z0 + s / 2) >= 0) { put(ps[0], ps[1], ps[2]); put(ps[0], ps[2], ps[3]); return; }
      if (fv.every(v => v < 0)) return;
      if (depth > 0) { const h = s / 2; cut(x0, z0, h, depth - 1); cut(x0 + h, z0, h, depth - 1); cut(x0, z0 + h, h, depth - 1); cut(x0 + h, z0 + h, h, depth - 1); return; }
      const out = []; for (let i = 0; i < 4; i++) { const j = (i + 1) % 4, a = fv[i], b = fv[j]; if (a >= 0) out.push(ps[i]); if ((a >= 0) !== (b >= 0)) { const t = a / (a - b); out.push([ps[i][0] + (ps[j][0] - ps[i][0]) * t, ps[i][1] + (ps[j][1] - ps[i][1]) * t]); } }
      for (let k = 1; k + 1 < out.length; k++) put(out[0], out[k], out[k + 1]);
    };
    for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) {
      if (!mask[j * m + i]) continue;
      for (let b = 0; b < res; b++) for (let a = 0; a < res; a++) cut(-half + i * cell + a * f, -half + j * cell + b * f, f, 2);
    }
    return { tris: Float32Array.from(tris), size: f };
  }

  // ---- 検証
  function check(prep, H, o) {
    const warn = [], ag = o.agent || { height: 1.8 };
    prep.forEach(T => {
      const t = T.t, id = t.id || '';
      if (t.h < ag.height + .2) warn.push(`トンネル ${id}: 高さ ${t.h}m が、体格の身長 ${ag.height}m に足りません（通れません）`);
      for (let i = 0; i + 1 < t.pts.length; i++) { const a = t.pts[i], b = t.pts[i + 1], L = hyp(b.x - a.x, b.z - a.z); if (L > 1e-6 && Math.abs(b.y - a.y) / L > MAX_SLOPE + 1e-6) warn.push(`トンネル ${id}: ${i + 1} 本目の区間の勾配が 15° を超えています`); }
      if (T.st.some(q => q.y < (o.water ?? -1e9) + .05)) warn.push(`トンネル ${id}: 床が水位より低い所があります`);
      if (!T.st.some(q => q.cls === 2)) warn.push(`トンネル ${id}: 上に地面がかぶる所がありません（切り通しだけです）`);
    });
    return warn;
  }

  const api = { STYLES, SIZES, SLOPES, MAX_SLOPE, WALL, COVER, SUBMESH, MAT, MOSSY, ROCK, prepare, query, nearest, holes, build, cap, check, profile };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TDTunnels = api;
})(typeof window !== 'undefined' ? window : this);

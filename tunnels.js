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
  const SUBMESH = ['floor', 'wall', 'ceiling', 'portal', 'frame', 'lamp', 'shaft'];   // shaft: 壁の外側から地面まで立つ岩の面（屋根を透かしたときの切り口。ふだんは山の中）

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
    for (const q of st) { q.nx = -q.tz; q.nz = q.tx; q.g = H(q.x, q.z); q.cls = q.g <= q.y + COVER ? 0 : q.g < q.y + t.h + COVER ? 1 : 2; }
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
      const hw = T.t.w / 2 + WALL - .1; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
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
        if (S.cls === 1 || (S.toOpen <= .35 && lo < q.y + T.t.h + .2)) out[j * m + i] = 1;
      }
    }
    return out;
  }

  // ---- 網
  const C = h => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const PAL = {
    rock: { wall: [C(0x5c574f), C(0x877f70)], floor: [C(0x5e4f3d), C(0x7b6a52)], portal: [C(0x625c52), C(0x8e8676)] },
    masonry: { wall: [C(0x857f73), C(0xb2aa99)], floor: [C(0x726d63), C(0x968f83)], portal: [C(0x8d877b), C(0xbdb5a3)], trim: [C(0xa49c8b), C(0xcbc3b1)] },
    mine: { wall: [C(0x58524a), C(0x7e766a)], floor: [C(0x5a4a38), C(0x76644c)], portal: [C(0x5d574e), C(0x857d6f)], wood: [C(0x5a3e26), C(0x87633f)] },
    ruins: { wall: [C(0x646b5f), C(0x8b917f)], floor: [C(0x5f6257), C(0x7f8274)], portal: [C(0x6a7064), C(0x939884)], moss: [C(0x40562e), C(0x5f7a3c)], trim: [C(0x7f857a), C(0xa3a797)] },
  };
  // 横断面：左の床の角 → 左の壁 → アーチ → 右の壁 → 右の床の角。[u 左右, v 床からの高さ, 天井なら 1]
  function profile(w, h) {
    const hw = w / 2, r = Math.min(hw * .85, h * .45), hs = h - r, out = [[-hw, 0, 0], [-hw, hs * .5, 0], [-hw, hs, 0]];
    for (let k = 1; k < 8; k++) { const a = Math.PI * (1 - k / 8); out.push([Math.cos(a) * hw, hs + Math.sin(a) * r, 1]); }
    out.push([hw, hs, 0], [hw, hs * .5, 0], [hw, 0, 0]);
    return { pts: out, hs, r };
  }
  function build(prep, H) {
    const pos = [], col = [], glow = [], sub = [], lamps = [];
    prep.forEach((T, ti) => {
      const t = T.t, st = T.st, style = PAL[t.style] ? t.style : 'rock', pal = PAL[style], hw = t.w / 2, pr = profile(t.w, t.h), seed = (t.id || '').split('').reduce((a, c) => a * 31 + c.charCodeAt(0) | 0, 7) % 997;
      const W = (q, u, v) => [q.x + q.nx * u, q.y + v, q.z + q.nz * u];
      const dark = q => .45 + .55 * Math.exp(-(q.toOpen || 0) / 3);   // 奥ほど暗い（地形の影は受けず、この明るさで中の暗さを出す）
      const tri = (a, b, c, color, s, g = 0) => {   // 中心が別のトンネルの中なら作らない（枝分かれの口を開ける）
        const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3, cz = (a[2] + b[2] + c[2]) / 3;
        if (s !== 4 && s !== 5 && insideOther(prep, ti, cx, cy, cz)) return;
        pos.push(...a, ...b, ...c); for (let k = 0; k < 3; k++) { col.push(...color); glow.push(g); } sub.push(s);
      };
      const quad = (a, b, c, d, color, s, g) => { tri(a, b, c, color, s, g); tri(a, c, d, color, s, g); };
      // 直方体：中心 (u, v, s) の局所の箱（左右 du、高さ dv、前後 ds）、q の向き
      const box = (q, u, v, ds0, du, dv, ds, color, s, g = 0) => {
        const P = (a, b, c) => { const x = q.x + q.nx * (u + a) + q.tx * (ds0 + c), z = q.z + q.nz * (u + a) + q.tz * (ds0 + c); return [x, q.y + v + b, z]; };
        const a = du / 2, c = ds / 2, v0 = 0, v1 = dv, p = [P(-a, v0, -c), P(a, v0, -c), P(a, v0, c), P(-a, v0, c), P(-a, v1, -c), P(a, v1, -c), P(a, v1, c), P(-a, v1, c)];
        for (const [i, j, k, l] of [[0, 1, 2, 3], [4, 7, 6, 5], [0, 4, 5, 1], [1, 5, 6, 2], [2, 6, 7, 3], [3, 7, 4, 0]]) quad(p[i], p[j], p[k], p[l], color, s, g);
      };
      const tone = (pair, a, b) => mix(pair[0], pair[1], hash(a + seed, b));
      const shade = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
      // 素掘りの壁はでこぼこ（区切りと輪の番号から決まる。両隣の区切りで同じ値）
      const rough = style === 'rock' || style === 'mine' ? .14 : 0;
      const ring = q => pr.pts.map(([u, v, c], k) => {
        if (!rough || k === 0 || k === pr.pts.length - 1) return W(q, u, v);
        const e = (hash(Math.round(q.s * 4) + seed, k) - .3) * rough, nu = u / hw, nv = c ? (v - pr.hs) / pr.r : 0, l = hyp(nu, nv) || 1;
        return W(q, u + nu / l * e * (c ? 1 : 1), v + (c ? nv / l * e : (hash(k, Math.round(q.s * 4)) - .5) * .06));
      });
      const rings = st.map(q => q.cls ? ring(q) : null);
      // 中（トンネルと切り通しの区間）：床・壁・天井。入口のまわりと切り通しでは、地面より下（岩の中）にある所だけ描く
      // （口の奥行きと切り通しの側面が、岩を掘った面になる。地面の上は、地形と同じ材質の網 cap で口のまわりを作り直す）
      const under = (A, B, Cc, D) => { const x = (A[0] + B[0] + Cc[0] + D[0]) / 4, y = (A[1] + B[1] + Cc[1] + D[1]) / 4, z = (A[2] + B[2] + Cc[2] + D[2]) / 4; return y < H(x, z) - .02; };
      for (let k = 0; k + 1 < st.length; k++) {
        const a = st[k], b = st[k + 1]; if (!a.cls || !b.cls) continue;
        const inTube = a.cls === 2 && b.cls === 2;
        const ra = rings[k], rb = rings[k + 1], ka = dark(a), kb = dark(b), kk = (ka + kb) / 2, blk = Math.floor(a.s / .6);
        for (let p = 0; p + 1 < ra.length; p++) {
          const c = pr.pts[p][2] || pr.pts[p + 1][2] ? 2 : 1, course = Math.floor(pr.pts[p][1] / .4);
          let color = style === 'masonry' || style === 'ruins' ? tone(pal.wall, blk + (course % 2) * 7, p) : tone(pal.wall, Math.round(a.s * 2), p);
          if (style === 'ruins' && pr.pts[p][1] < .7 && hash(blk, p + 3) > .55) color = tone(pal.moss, blk, p);
          if (!inTube && !under(ra[p], ra[p + 1], rb[p + 1], rb[p])) continue;
          quad(ra[p], ra[p + 1], rb[p + 1], rb[p], shade(color, kk), c);
        }
        const fl = [-hw, -hw / 3, hw / 3, hw];
        for (let p = 0; p < 3; p++) quad(W(a, fl[p], .01), W(b, fl[p], .01), W(b, fl[p + 1], .01), W(a, fl[p + 1], .01), shade(tone(pal.floor, style === 'masonry' ? blk : Math.round(a.s * 3), p), kk), 0);
        // 坑道：1.8m ごとに木の支保工（左右の柱と梁）
        if (!inTube) continue;
        // 屋根を透かしたときの切り口：壁の外側に、床の下から真上の地面まで立つ暗い岩の面
        for (const sd of [-1, 1]) {
          const u = sd * (hw + .28), A0 = W(a, u, -.1), B0 = W(b, u, -.1), At = [A0[0], H(A0[0], A0[2]) - .03, A0[2]], Bt = [B0[0], H(B0[0], B0[2]) - .03, B0[2]];   // just under the ground: hidden until the roof is cut away
          quad(A0, B0, Bt, At, shade(tone(pal.wall, Math.round(a.s), 11), .55), 6);
        }
        if (style === 'mine' && Math.floor(a.s / 1.8) !== Math.floor(b.s / 1.8) && a.toOpen > .6) {
          const wd = tone(pal.wood, blk, 1), f = shade(wd, kk);
          box(a, -hw + .11, 0, 0, .2, pr.hs + .25, .2, f, 4); box(a, hw - .11, 0, 0, .2, pr.hs + .25, .2, f, 4);
          box(a, 0, pr.hs + .25, 0, t.w, .2, .22, f, 4);
        }
        // 灯り：入口から 2m より奥で、およそ 7m ごと、左右交互の壁に
        if (Math.floor(a.s / 7) !== Math.floor(b.s / 7) && a.toOpen > 2) {
          const side = Math.floor(a.s / 7) % 2 ? 1 : -1, y = style === 'mine' ? pr.hs + .05 : Math.min(pr.hs, 1.9) - .1;
          if (style === 'mine') {   // 梁から吊るしたランタン
            box(a, 0, y - .45, 0, .04, .4, .04, C(0x2a2622), 4); box(a, 0, y - .75, 0, .22, .3, .22, C(0xffd27a), 5, 1);
            lamps.push({ x: a.x, y: a.y + y - .6, z: a.z, color: 0xffb35a });
          } else {   // 壁の松明
            const u = side * (hw - .12);
            box(a, u, y - .35, 0, .08, .4, .08, C(0x4a3624), 4); box(a, u - side * .02, y + .05, 0, .16, .22, .16, C(0xffb040), 5, 1);
            lamps.push({ x: a.x + a.nx * u, y: a.y + y + .1, z: a.z + a.nz * u, color: 0xff9a40 });
          }
        }
      }
      // 行き止まり（トンネルの区間で終わる端、ほかのトンネルの中でない）：奥の壁
      for (const [k, dir] of [[0, -1], [st.length - 1, 1]]) {
        const q = st[k]; if (q.cls !== 2 || insideOther(prep, ti, q.x, q.y + 1, q.z)) continue;
        const r = rings[k], c = W(q, 0, pr.hs * .6), color = shade(tone(pal.wall, k, 3), dark(q));
        for (let p = 0; p + 1 < r.length; p++) dir > 0 ? tri(c, r[p + 1], r[p], color, 1) : tri(c, r[p], r[p + 1], color, 1);
        tri(r[0], r[r.length - 1], c, color, 1);
        const e = hw + .28, A0 = W(q, -e, -.1), B0 = W(q, e, -.1), sc = shade(color, .55);   // 切り口：行き止まりの上も地面まで
        quad(A0, B0, [B0[0], H(B0[0], B0[2]) - .03, B0[2]], [A0[0], H(A0[0], A0[2]) - .03, A0[2]], sc, 6);
      }
      // 坑口の枠：トンネルの区間の端から外へ、地面が天井の高さより下がる所（崖や斜面の面）に、種類ごとの枠を立てる
      for (let k = 0; k < st.length; k++) {
        const q0 = st[k]; if (q0.cls !== 2) continue;
        for (const o of [-1, 1]) {
          if (!st[k + o] || st[k + o].cls === 2 || insideOther(prep, ti, st[k + o].x, st[k + o].y + 1, st[k + o].z)) continue;
          let m = k + o; while (st[m + o] && st[m].g > st[m].y + t.h) m += o;
          const q = st[m], F = (u, v) => W(q, u, v), front = (a, b, c, d, cc, sb) => o < 0 ? quad(a, b, c, d, cc, sb) : quad(a, d, c, b, cc, sb);
          const qf = { x: q.x + q.tx * o * .12, z: q.z + q.tz * o * .12, y: q.y, tx: q.tx, tz: q.tz, nx: q.nx, nz: q.nz };
          if (style === 'mine') {
            const wd = tone(pal.wood, k, 2); box(qf, -hw - .02, 0, 0, .26, pr.hs + .45, .26, wd, 4); box(qf, hw + .02, 0, 0, .26, pr.hs + .45, .26, wd, 4); box(qf, 0, pr.hs + .45, 0, t.w + .9, .28, .3, wd, 4);
          } else if (style === 'masonry' || style === 'ruins') {
            // 迫石（アーチのまわりの石）と要石。遺跡は左右の柱と楣石（片方の柱が崩れていることもある）
            const pts = pr.pts, n0 = 2, n1 = pts.length - 3, dz = a => [a[0] + q.tx * o * .1, a[1], a[2] + q.tz * o * .1];
            for (let p = n0; p < n1; p++) {
              const [ua, va] = pts[p], [ub, vb] = pts[p + 1], ga = Math.atan2((va - pr.hs) / pr.r, ua / hw), gb = Math.atan2((vb - pr.hs) / pr.r, ub / hw);
              const out = (u, v, g) => F(u + Math.cos(g) * .38, v + Math.sin(g) * .38), cc = tone(pal.trim, p, k);
              front(dz(F(ua, va)), dz(F(ub, vb)), dz(out(ub, vb, gb)), dz(out(ua, va, ga)), cc, 4);
              if (p === Math.floor((n0 + n1) / 2)) front(dz(out(ua, va, ga)), dz(out(ub, vb, gb)), dz(F((ua + ub) / 2, Math.max(va, vb) + .62)), dz(F((ua + ub) / 2, Math.max(va, vb) + .62)), cc, 4);
            }
            for (const sd of [-1, 1]) box(qf, sd * (hw + .19), 0, 0, .38, pr.hs, .3, tone(pal.trim, k + sd, 6), 4);   // 迫り元までの側柱
            if (style === 'ruins') {
              const tr = tone(pal.trim, k, 4), broken = hash(k + seed, 9) > .5;
              box(qf, -hw - .45, 0, 0, .5, pr.hs + (broken ? .1 : .7), .5, tr, 4); box(qf, hw + .45, 0, 0, .5, pr.hs + .7, .5, tr, 4);
              if (!broken) box(qf, 0, pr.hs + pr.r + .45, 0, t.w + 1.5, .32, .55, tone(pal.moss, k, 4), 4);
            }
          }
        }
      }
    });
    return { pos: new Float32Array(pos), col: new Float32Array(col), glow: new Float32Array(glow), sub: Uint8Array.from(sub), lamps };
  }

  // ---- 口のまわりの地面（cap）：穴を開けたセルの地面を 1/res の細かい格子で作り直し、トンネルの口（床から天井までの断面の中）だけ抜く。
  // 地形と同じ材質で描く（高さは格子の双一次補間。セルの縁では地形の三角形と一致する）。返すのは (x, z) の四角の並び
  function cap(prep, H, mask, n, cell, half, res = 4) {
    const m = n - 1, quads = [], f = cell / res;
    const opening = (x, y, z) => {
      for (const T of prep) {
        const q = nearest(T, x, z); if (!q || q.end && q.d > 1e-6) continue;
        const hw = T.t.w / 2 + .02; if (Math.abs(q.lat) > hw) continue;
        const pr = profile(T.t.w, T.t.h), l = Math.min(Math.abs(q.lat) / (T.t.w / 2), 1), top = pr.hs + pr.r * Math.sqrt(1 - l * l), v = y - q.y;
        if (v > -.05 && v < top + .02) return true;
      }
      return false;
    };
    for (let j = 0; j < m; j++) for (let i = 0; i < m; i++) {
      if (!mask[j * m + i]) continue;
      for (let b = 0; b < res; b++) for (let a = 0; a < res; a++) {
        const x0 = -half + i * cell + a * f, z0 = -half + j * cell + b * f, cx = x0 + f / 2, cz = z0 + f / 2;
        if (!opening(cx, H(cx, cz), cz)) quads.push(x0, z0);
      }
    }
    return { quads: Float32Array.from(quads), size: f };
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

  const api = { STYLES, SIZES, SLOPES, MAX_SLOPE, WALL, COVER, SUBMESH, prepare, query, nearest, holes, build, cap, check, profile };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TDTunnels = api;
})(typeof window !== 'undefined' ? window : this);

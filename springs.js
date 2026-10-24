// 水源（湧き水）の計算（マップエディター用）。画面に依存しない関数だけを置く（water.js と同じく、ブラウザでは window.TDSprings、node では module.exports）。
//
// 流体シミュレーションはしない。湧出量を「濡らせる面積(m²)」の予算に置き換えて、決まった順に水を配る（静的に一度だけ計算する）:
//   1. 水源から、いちばん急に下がる隣へ小川として流れる。川幅ぶんの面積を予算から払う（下流ほど水が減って細くなる）
//   2. それ以上下がれない所（くぼみ）では池になる。低いセルから順に池へ足し、セル 1 つごとに面積を払う
//      （水面からの蒸発・地面への浸み込みが面積に比例する、と考えたときの釣り合い）。平らな所では丸く広がって、予算で止まる
//   3. 池のふちで、水面より低いセルが見つかったら（あふれ口）、そこから小川として流れ続ける
//   4. 別の水源の水にぶつかったら合流して、残りの予算をその先へ渡す。同じ高さになった池どうしは 1 つにまとまる
//   5. 地図の端・水位より低い水（池や海）・出口の無いプールで終わる。予算が尽きた所で小川は地面に浸み込んで消える
// 考え方の元: Barnes, Callaghan & Wickert (2021) "Computing water flow through complex landscapes – Part 3: Fill–Spill–Merge"
//   https://esurf.copernicus.org/articles/9/105/2021/ （ここでは、雨ではなく水源からの水、量は面積の予算で扱う簡易版）
//
//   solve({ TN, TS, HALF, TH, level, springs:[{id,x,z,preset}], pools:[{id,cells,level,outlet}], options })
//     TH: TN×TN の地面の高さ（x = -HALF + i*TS, z = -HALF + j*TS）、level: 地図全体の水位（これより低い所はもともと水）
//     pools: 石で囲んだプール。cells = 水のセルの番号、level = 水面、outlet = あふれ口の外側のセル（-1 = 無し）
//   → { surf  水面の高さ（乾いた所は NaN）, depth 水深, kind 0 乾き / 1 小川 / 2 池 / 3 プール, flow (ux,uz) m/s,
//       edge  水のセルと、その隣の乾いたセルの水面（面の網を作るとき、岸の線を辺の途中に出すため。ほかは NaN）,
//       springs[] 各水源の行き先, streams[] 小川の線, ponds[] 池, falls[] 小川が崖を落ちる所, warnings[] }
//   carve(res, TH) → 小川の溝として地面を下げる量（TN×TN、m、0 以上）。溝を掘る前の地面 TH で解いた res に使う
//     （エディターは掘った量を覚えておき、水源を変えたら元の地面に戻してから掘り直す）
(function (root) {
  'use strict';
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const hyp = (a, b) => Math.sqrt(a * a + b * b);
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  // 湧出量のプリセット。q は目安の湧出量（L/s、書き出しに入れる説明用）、area は濡らせる面積(m²)
  const PRESETS = {
    seep: { name: 'しずく', q: 0.2, area: 10 },
    brook: { name: '小川', q: 3, area: 70 },
    spring: { name: '泉', q: 12, area: 260 },
    great: { name: '大きな泉', q: 40, area: 900 },
  };
  const DEFAULTS = {
    film: 0.03,         // 池の水面を、満ちた高さよりこれだけ上にする（平らな所でも薄く水が見える）(m)
    spillEps: 0.02,     // これより低い所だけをあふれ口とみなす（細かいでこぼこは池が埋める）(m)
    fallDrop: 0.8,      // 小川の 1 歩でこれ以上下がると滝(m)
    maxSteps: 400000,
  };
  // 予算（残りの面積 m²）から小川の幅・水深・溝の深さ
  const widthOf = B => clamp(0.09 * Math.sqrt(Math.max(B, 0)), 0.35, 2.4);
  const depthOf = B => clamp(0.04 + 0.006 * Math.sqrt(Math.max(B, 0)), 0.04, 0.24);
  const carveOf = B => clamp(0.08 + 0.006 * Math.sqrt(Math.max(B, 0)), 0.08, 0.22);
  const speedOf = slope => clamp(0.35 + 2.5 * slope, 0.3, 2.2);

  // 小さい順に取り出すヒープ（key, cell）
  function Heap() { this.k = []; this.c = []; }
  Heap.prototype.push = function (key, cell) {
    const K = this.k, C = this.c; let i = K.length; K.push(key); C.push(cell);
    while (i > 0) { const p = (i - 1) >> 1; if (K[p] <= key) break; K[i] = K[p]; C[i] = C[p]; i = p; }
    K[i] = key; C[i] = cell;
  };
  Heap.prototype.pop = function () {
    const K = this.k, C = this.c, key = K[0], cell = C[0], lk = K.pop(), lc = C.pop(), n = K.length;
    if (n) {
      let i = 0;
      for (;;) { let m = 2 * i + 1; if (m >= n) break; if (m + 1 < n && K[m + 1] < K[m]) m++; if (K[m] >= lk) break; K[i] = K[m]; C[i] = C[m]; i = m; }
      K[i] = lk; C[i] = lc;
    }
    return [key, cell];
  };
  Object.defineProperty(Heap.prototype, 'size', { get() { return this.k.length; } });

  function solve(o) {
    const opt = Object.assign({}, DEFAULTS, o.options || {});
    const { TN, TS, HALF, TH, level } = o, n = TN * TN, warnings = [];
    const X = i => -HALF + i * TS, cellAt = (x, z) => clamp(Math.round((z + HALF) / TS), 0, TN - 1) * TN + clamp(Math.round((x + HALF) / TS), 0, TN - 1);
    const DI = [1, -1, 0, 0, 1, 1, -1, -1], DJ = [0, 0, 1, -1, 1, -1, 1, -1], DL = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2];
    const nbr = (k, d) => { const i = k % TN + DI[d], j = ((k / TN) | 0) + DJ[d]; return i < 0 || j < 0 || i >= TN || j >= TN ? -1 : j * TN + i; };
    const onEdge = k => { const i = k % TN, j = (k / TN) | 0; return i === 0 || j === 0 || i === TN - 1 || j === TN - 1; };
    const sink = k => TH[k] < level;   // もともとの水（水位より低い所）
    const own = new Int32Array(n).fill(-1), bodies = [], sys = [];
    const find = s => { while (sys[s].parent !== s) { sys[s].parent = sys[sys[s].parent].parent; s = sys[s].parent; } return s; };
    const sysOf = k => own[k] < 0 ? -1 : find(bodies[own[k]].sys);
    const newSys = (budget, head, springs) => { sys.push({ parent: sys.length, budget, head, springs, end: null }); return sys.length - 1; };
    // a はここで流れを終え、残りの予算は b の先頭（いま水が進んでいる所）へ
    const join = (a, b) => { a = find(a); b = find(b); if (a === b) return b; sys[a].parent = b; sys[b].budget += Math.max(sys[a].budget, 0); sys[a].budget = 0; sys[b].springs.push(...sys[a].springs); return b; };
    const newStream = (s, cap) => { bodies.push({ kind: 'stream', sys: s, path: [], B: [], cap }); return bodies.length - 1; };   // cap: 池・プールからあふれた小川は、その水面より上がらない
    const addPath = (b, k, B) => { const st = bodies[b]; st.path.push(k); st.B.push(B); if (own[k] < 0) own[k] = b; };
    const newPond = (s, k) => {
      const h = new Heap(), P = { kind: 'pond', sys: s, level: TH[k], heap: h, cells: [], seed: k, dead: false };
      bodies.push(P); const b = bodies.length - 1; h.push(TH[k], k); return b;
    };
    // 池のふち: 低い順。高さが同じなら、水源から近い順（平らな所で丸く広がる）
    const keyOf = (P, m) => TH[m] + 1e-6 * hyp((m % TN) - (P.seed % TN), ((m / TN) | 0) - ((P.seed / TN) | 0));
    const pushRim = (b, k) => { const P = bodies[b]; for (let d = 0; d < 8; d++) { const m = nbr(k, d); if (m >= 0 && own[m] !== b) P.heap.push(keyOf(P, m), m); } };
    const mergePonds = (a, b) => {   // b を a に足す
      const A = bodies[a], Bp = bodies[b]; if (a === b || Bp.dead) return;
      for (const k of Bp.cells) { own[k] = a; A.cells.push(k); }
      for (let t = 0; t < Bp.heap.k.length; t++) A.heap.push(Bp.heap.k[t], Bp.heap.c[t]);
      A.level = Math.max(A.level, Bp.level); Bp.dead = true; Bp.cells = []; Bp.heap = new Heap(); Bp.mergedInto = a;
    };
    const live = b => { while (bodies[b].dead) b = bodies[b].mergedInto; return b; };

    // ---- プール: 水面の決まった池。あふれ口があれば、届いた水はそこから小川になる
    const poolSys = [];
    for (const pl of o.pools || []) {
      bodies.push({ kind: 'pool', sys: -1, level: pl.level, cells: pl.cells.slice(), id: pl.id }); const b = bodies.length - 1;
      const out = pl.outlet >= 0 && !(own[pl.outlet] >= 0) ? pl.outlet : -1;
      const s = newSys(0, out >= 0 ? { t: 'run', b: -1, k: out, cap: pl.level } : { t: 'end' }, []); sys[s].end = out >= 0 ? null : 'pool';
      bodies[b].sys = s; for (const k of pl.cells) own[k] = b; poolSys.push(s);
    }

    // 1 歩ずつ進める。予算が尽きたら、先頭をそのまま残して止まる（あとで合流した水が続きを進める）
    let steps = 0;
    function advance(s) {
      for (;;) {
        s = find(s); const S = sys[s], h = S.head;
        if (h.t === 'end' || S.budget <= 0 || ++steps > opt.maxSteps) return;
        if (h.t === 'run') {
          if (h.b < 0) {   // 流れの始まり（水源・あふれ口）
            const k = h.k;
            if (sink(k)) { S.head = { t: 'end' }; S.end = 'water'; continue; }
            const t = sysOf(k); if (t >= 0 && t !== s) { join(s, t); continue; }
            h.b = newStream(s, h.cap ?? Infinity); addPath(h.b, k, S.budget); S.budget -= widthOf(S.budget) * TS;
          }
          const k = h.k;
          if (onEdge(k)) { S.head = { t: 'end' }; S.end = 'edge'; continue; }
          let best = -1, bs = 0;
          for (let d = 0; d < 8; d++) {
            const m = nbr(k, d); if (m < 0) continue;
            const q = own[m] >= 0 ? bodies[own[m]] : null;
            if (q && find(q.sys) === s && q.kind !== 'stream') continue;   // 自分の池へは戻らない
            const sl = (TH[k] - TH[m]) / (DL[d] * TS); if (sl > bs) { bs = sl; best = m; }
          }
          if (best < 0) {   // くぼみ: 池になる
            const b = newPond(s, k); S.head = { t: 'fill', b }; continue;
          }
          if (sink(best)) { addPath(h.b, best, S.budget); S.head = { t: 'end' }; S.end = 'water'; continue; }
          const t = sysOf(best);
          if (t >= 0) {
            addPath(h.b, best, S.budget);
            if (t === s) { S.head = { t: 'end' }; S.end = 'loop'; continue; }
            join(s, t); continue;
          }
          S.budget -= widthOf(S.budget) * TS * hyp(best % TN - k % TN, ((best / TN) | 0) - ((k / TN) | 0));
          addPath(h.b, best, S.budget); h.k = best; continue;
        }
        // 池を満たす
        const b = live(h.b), P = bodies[b]; h.b = b;
        if (!P.heap.size) { S.head = { t: 'end' }; S.end = 'full'; continue; }
        const [key, m] = P.heap.pop();
        if (own[m] === b) continue;
        if (sink(m)) { S.head = { t: 'end' }; S.end = 'water'; continue; }
        const qb = own[m], Q = qb >= 0 ? bodies[qb] : null, t = Q ? find(Q.sys) : -1;
        if (!Q && onEdge(m)) {   // 地図の端まで広がった: そこから外へ流れ出る
          own[m] = b; P.cells.push(m); P.level = Math.max(P.level, TH[m]); S.budget -= TS * TS; S.head = { t: 'end' }; S.end = 'edge'; continue;
        }
        if (Q && Q.kind === 'pond') {
          if (P.level < Q.level - opt.spillEps && key < Q.level - 1e-9) { P.heap.push(Q.level, m); continue; }   // 高い所の池: その水位まで上がったら 1 つになる
          if (t !== s) {
            const qHeadOnQ = sys[t].head.t === 'fill' && live(sys[t].head.b) === qb;
            const r = join(s, t); mergePonds(b, qb);
            sys[r].head = qHeadOnQ ? { t: 'fill', b } : sys[r].head; continue;
          }
          mergePonds(b, qb); continue;
        }
        if (Q && t !== s) { join(s, t); continue; }   // 別の水源の小川・プールへ流れ込む
        if (Q && Q.kind === 'pool') continue;          // 自分のプールの壁
        if (Q && Q.kind === 'stream') {   // 自分の流れ込みの小川が沈む
          own[m] = b; P.cells.push(m); P.level = Math.max(P.level, TH[m]); pushRim(b, m); continue;
        }
        if (TH[m] < P.level - opt.spillEps) {   // あふれ口
          S.head = { t: 'run', b: -1, k: m, cap: P.level + opt.film }; continue;
        }
        own[m] = b; P.cells.push(m); P.level = Math.max(P.level, TH[m]); S.budget -= TS * TS; pushRim(b, m);
      }
    }

    // ---- 水源を順に
    const outSprings = [];
    for (const sp of o.springs || []) {
      const pr = PRESETS[sp.preset] || PRESETS.brook, k0 = cellAt(sp.x, sp.z);
      const s = newSys(pr.area, { t: 'run', b: -1, k: k0 }, [sp.id]);
      outSprings.push({ id: sp.id, x: sp.x, z: sp.z, preset: sp.preset in PRESETS ? sp.preset : 'brook', q: pr.q, area: pr.area, sys: s, cell: k0 });
      if (sink(k0)) warnings.push(`水源 ${sp.id || ''}（${sp.x.toFixed(1)}, ${sp.z.toFixed(1)}）は水位より低い水の中にあります（湧いた水はそのまま水に混ざります）`);
      advance(s);
    }
    if (steps > opt.maxSteps) warnings.push('水源の計算が長すぎるので途中で止めました');

    // ---- 結果を格子に
    const surf = new Float32Array(n).fill(NaN), kind = new Uint8Array(n), flow = new Float32Array(n * 2), body = new Int32Array(n).fill(-1);
    const ponds = [], pools = [], streams = [], falls = [];
    bodies.forEach((P, b) => {
      if (P.kind === 'stream' || P.dead) return;
      const pond = P.kind === 'pond', y = pond ? P.level + opt.film : P.level; let maxD = 0;
      for (const k of P.cells) { surf[k] = y; kind[k] = pond ? 2 : 3; body[k] = b; maxD = Math.max(maxD, y - TH[k]); }
      if (pond) ponds.push({ body: b, level: +y.toFixed(3), area: +(P.cells.length * TS * TS).toFixed(2), maxDepth: +maxD.toFixed(3), cells: P.cells.length, springs: sys[find(P.sys)].springs.slice() });
      else pools.push({ id: P.id, body: b, level: P.level, cells: P.cells.length });
    });
    // 小川: セルの中心を結ぶ線をなめらかにして、幅のぶんのセルを塗る（いちばん近い線の水面）
    const best = new Float32Array(n).fill(1e9), face = new Uint8Array(n);   // face: 滝の落ちる崖の面（水面を描かない。滝の幕だけ）
    bodies.forEach((st, b) => {
      if (st.kind !== 'stream' || st.path.length < 1) return;
      const m = st.path.length, px = new Float64Array(m), pz = new Float64Array(m), ps = new Float64Array(m), w = new Float64Array(m);
      for (let t = 0; t < m; t++) { const k = st.path[t]; px[t] = X(k % TN); pz[t] = X((k / TN) | 0); w[t] = widthOf(st.B[t]); ps[t] = TH[k] + depthOf(st.B[t]); }
      ps[0] = Math.min(ps[0], st.cap); for (let t = 1; t < m; t++) ps[t] = Math.min(ps[t], ps[t - 1]);   // 水面は下流へ下がるだけ
      for (let it = 0; it < 2; it++) for (let t = 1; t < m - 1; t++) { px[t] = (px[t - 1] + 2 * px[t] + px[t + 1]) / 4; pz[t] = (pz[t - 1] + 2 * pz[t] + pz[t + 1]) / 4; }
      const pts = []; for (let t = 0; t < m; t++) pts.push([+px[t].toFixed(3), +pz[t].toFixed(3), +ps[t].toFixed(3), +w[t].toFixed(3), +depthOf(st.B[t]).toFixed(3), +carveOf(st.B[t]).toFixed(3)]);   // x, z, 水面, 幅, 水深, 溝の深さ
      // どこで終わるか: water 水位より低い水へ / edge 地図の端 / pond 池へ / join ほかの流れへ / dry 地面に浸み込む
      const last = st.path[m - 1], end = sink(last) ? 'water' : onEdge(last) ? 'edge' : own[last] >= 0 && own[last] !== b ? (bodies[own[last]].kind === 'stream' ? 'join' : 'pond') : 'dry';
      streams.push({ body: b, points: pts, end, springs: sys[find(st.sys)].springs.slice() });
      // 崖を落ちる所（続けて急な所は 1 つの滝）。縁（lip）から滝つぼ（foot）までの区間は水面を描かず、崖の面のセルにも水を置かない
      const skip = new Uint8Array(m), onFace = new Uint8Array(m);
      for (let t = 1; t < m; t++) {
        const drop = TH[st.path[t - 1]] - TH[st.path[t]]; if (drop < opt.fallDrop) continue;
        let e = t; while (e + 1 < m && TH[st.path[e]] - TH[st.path[e + 1]] >= opt.fallDrop * .5) e++;
        const lx = px[t - 1], lz = pz[t - 1], fx = px[e], fz = pz[e], dx = fx - lx, dz = fz - lz, dl = hyp(dx, dz) || 1, top = ps[t - 1], bottom = ps[e], hw = w[t - 1] / 2 + .6;
        falls.push({ x: +lx.toFixed(3), z: +lz.toFixed(3), foot: [+fx.toFixed(3), +fz.toFixed(3)], dir: [+(dx / dl).toFixed(4), +(dz / dl).toFixed(4)], lean: +dl.toFixed(3), width: +w[t - 1].toFixed(3), top: +top.toFixed(3), bottom: +bottom.toFixed(3) });
        for (let q = t - 1; q < e; q++) skip[q] = 1;
        for (let q = t; q < e; q++) onFace[q] = 1;
        // 崖の面：縁と滝つぼを結ぶ帯の、上と下の水面の間の高さのセル
        const i0 = Math.max(0, Math.floor((Math.min(lx, fx) - hw - 1 + HALF) / TS)), i1 = Math.min(TN - 1, Math.ceil((Math.max(lx, fx) + hw + 1 + HALF) / TS));
        const j0 = Math.max(0, Math.floor((Math.min(lz, fz) - hw - 1 + HALF) / TS)), j1 = Math.min(TN - 1, Math.ceil((Math.max(lz, fz) + hw + 1 + HALF) / TS));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const k = j * TN + i, qx = X(i) - lx, qz = X(j) - lz, u = clamp((qx * dx + qz * dz) / (dl * dl), 0, 1), d = hyp(qx - dx * u, qz - dz * u);
          if (d <= hw && TH[k] < top - .12 && TH[k] > bottom + .05) face[k] = 1;
        }
        t = e;
      }
      for (let t = 0; t < m; t++) {
        if (skip[t]) continue;
        const a = t, c = Math.min(t + 1, m - 1), hw = Math.max(w[a], w[c]) / 2, r = hw + .5 + TS;
        const i0 = Math.max(0, Math.floor((Math.min(px[a], px[c]) - r + HALF) / TS)), i1 = Math.min(TN - 1, Math.ceil((Math.max(px[a], px[c]) + r + HALF) / TS));
        const j0 = Math.max(0, Math.floor((Math.min(pz[a], pz[c]) - r + HALF) / TS)), j1 = Math.min(TN - 1, Math.ceil((Math.max(pz[a], pz[c]) + r + HALF) / TS));
        const sx = px[c] - px[a], sz = pz[c] - pz[a], L2 = sx * sx + sz * sz, L = Math.sqrt(L2) || 1;
        const slope = a === c ? 0 : Math.max(ps[a] - ps[c], 0) / L, sp = speedOf(slope);
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const k = j * TN + i; if (kind[k] >= 2 || sink(k) || face[k]) continue;
          const qx = X(i) - px[a], qz = X(j) - pz[a], u = L2 > 0 ? clamp((qx * sx + qz * sz) / L2, 0, 1) : 0, d = hyp(qx - sx * u, qz - sz * u);
          const hwu = (w[a] + (w[c] - w[a]) * u) / 2; if (d > Math.max(hwu + .5, TS * 1.1) || d >= best[k]) continue;   // 幅の外でも、岸が水面より低ければ 0.5m までは水（溝の岸の斜面で水際が決まる）
          let y = ps[a] + (ps[c] - ps[a]) * u;
          if (TH[k] >= y) { if (d > Math.max(hwu * .6, TS * 1.1)) continue; y = TH[k] + .03; }   // 幅の中ほど（と線の両隣のセル）は、横に傾いた所でも薄く水（格子で途切れない）
          best[k] = d; surf[k] = y; kind[k] = 1; body[k] = b; flow[k * 2] = sx / L * sp; flow[k * 2 + 1] = sz / L * sp;
        }
      }
      for (let t = 0; t < m; t++) { const k = st.path[t]; if (kind[k] || sink(k) || onFace[t] || face[k]) continue; surf[k] = ps[t]; kind[k] = 1; body[k] = b; }   // 細い所でも線の上は水
    });
    // 小川の水面をまわりの小川のセルとならす（曲がり角で、隣の区間の水面を取ったセルとの段を消す）。線の上は必ず水
    const onPath = new Uint8Array(n); bodies.forEach(st => { if (st.kind === 'stream') for (const k of st.path) if (kind[k] === 1) onPath[k] = 1; });
    for (let it = 0; it < 3; it++) {
      const s2 = surf.slice();
      for (let k = 0; k < n; k++) {
        if (kind[k] !== 1) continue; let sum = surf[k], c = 1;
        for (let d = 0; d < 8; d++) { const m = nbr(k, d); if (m >= 0 && kind[m] === 1) { sum += surf[m]; c++; } }
        s2[k] = sum / c;
      }
      surf.set(s2);
    }
    for (let k = 0; k < n; k++) if (kind[k] === 1) {
      if (onPath[k] || best[k] <= TS * 1.1) surf[k] = Math.max(surf[k], TH[k] + .03);
      else if (surf[k] <= TH[k]) { kind[k] = 0; surf[k] = NaN; body[k] = -1; flow[k * 2] = flow[k * 2 + 1] = 0; }
    }
    // 池・プールの中にも、流れ込み・あふれ口のまわりだけ弱い流れを広げる
    for (let it = 0; it < 8; it++) {
      const f2 = flow.slice();
      for (let k = 0; k < n; k++) {
        if (kind[k] < 2) continue; let sx = 0, sz = 0, c = 0;
        for (let d = 0; d < 4; d++) { const m = nbr(k, d); if (m < 0 || !kind[m]) continue; sx += flow[m * 2]; sz += flow[m * 2 + 1]; c++; }
        if (c) { f2[k * 2] = sx / c * .8; f2[k * 2 + 1] = sz / c * .8; }
      }
      flow.set(f2);
    }
    // 泡の帯：滝つぼのまわりと、そこから下流へ数 m（mask の R。water.js の泡の帯と同じ 0..0.65 の「覆う割合」）
    const trail = new Float32Array(n);
    for (const f of falls) {
      const [fx, fz] = f.foot, R = 8, i0 = Math.max(0, Math.floor((fx - R + HALF) / TS)), i1 = Math.min(TN - 1, Math.ceil((fx + R + HALF) / TS)), j0 = Math.max(0, Math.floor((fz - R + HALF) / TS)), j1 = Math.min(TN - 1, Math.ceil((fz + R + HALF) / TS));
      const h = f.top - f.bottom, strong = clamp(.35 + .12 * h, .35, .65);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const k = j * TN + i; if (!kind[k]) continue;
        const qx = X(i) - fx, qz = X(j) - fz, d = hyp(qx, qz), along = qx * f.dir[0] + qz * f.dir[1];
        const v = strong * (d < f.width ? 1 : along > -.5 ? Math.exp(-(d - f.width) / 3) : 0);
        if (v > trail[k]) trail[k] = v;
      }
    }
    const depth = new Float32Array(n), edge = new Float32Array(n).fill(NaN);
    let wetCount = 0;
    for (let k = 0; k < n; k++) if (kind[k]) { depth[k] = Math.max(surf[k] - TH[k], 0); edge[k] = surf[k]; wetCount++; }
    // 乾いた隣のセル: 隣の水面の高い方（ここで水深が負になるので、岸の線は辺の途中に出る）。プールの外は壁の下で切る
    for (let k = 0; k < n; k++) {
      if (kind[k]) continue; let y = -Infinity, pool = false;
      for (let d = 0; d < 8; d++) { const m = nbr(k, d); if (m >= 0 && kind[m]) { y = Math.max(y, surf[m]); if (kind[m] === 3) pool = true; } }
      if (y > -Infinity) edge[k] = Math.min(y, TH[k] - (pool ? .3 : .02));
    }
    // 岸からの距離(m)（水のセルから一番近い乾いたセルまで、斜めは √2 の 2 回走査）
    const bank = new Float32Array(n);
    for (let k = 0; k < n; k++) bank[k] = kind[k] ? 1e9 : 0;
    for (let pass = 0; pass < 2; pass++) {
      for (let k = 0; k < n; k++) { if (!bank[k]) continue; for (const d of [1, 3, 5, 7]) { const m = nbr(k, d); if (m >= 0) bank[k] = Math.min(bank[k], bank[m] + DL[d] * TS); } }
      for (let k = n - 1; k >= 0; k--) { if (!bank[k]) continue; for (const d of [0, 2, 4, 6]) { const m = nbr(k, d); if (m >= 0) bank[k] = Math.min(bank[k], bank[m] + DL[d] * TS); } }
    }
    for (let k = 0; k < n; k++) if (kind[k]) bank[k] = Math.max(Math.min(bank[k], 50) - .5 * TS, .02);
    for (const sp of outSprings) { const s = find(sp.sys); sp.end = sys[s].end || (sys[s].budget <= 0 ? 'dry' : 'open'); sp.wet = body[sp.cell] >= 0; delete sp.sys; }
    return { TN, TS, HALF, level, surf, depth, kind, body, flow, edge, bank, trail, wetCount, springs: outSprings, ponds, pools, streams, falls, warnings, options: opt };
  }

  // 小川の溝: 線から幅の半分までを溝の深さだけ下げ、岸まで 0.8m かけて元に戻す。溝の底（水面 - 水深 - 溝の深さ）より低い所は掘らない
  // （横に傾いた斜面の低い側を掘り込まない）。地面に浸み込んで終わる小川は最後の 2m で浅くなって消え、水へ入る小川は溝をその先 1.5m まで延ばす
  function carve(res, TH) {
    const { TN, TS, HALF } = res, n = TN * TN, out = new Float32Array(n), X = i => -HALF + i * TS;
    for (const st of res.streams) {
      const P = st.points.map(p => p.slice()), m = P.length;
      if (st.end === 'water' && m > 1) { const a = P[m - 2], c = P[m - 1], L = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1; P.push([c[0] + (c[0] - a[0]) / L * 1.5, c[1] + (c[1] - a[1]) / L * 1.5, c[2] - .1, c[3], c[4], 0]); }
      const S = [0]; for (let t = 1; t < P.length; t++) S.push(S[t - 1] + Math.hypot(P[t][0] - P[t - 1][0], P[t][1] - P[t - 1][1]));
      const len = S[S.length - 1]; if (st.end === 'dry') for (let t = 0; t < P.length; t++) P[t][5] *= sstep(0, 2, len - S[t]);
      for (let t = 0; t < P.length; t++) {
        const a = P[t], c = P[Math.min(t + 1, P.length - 1)], hw = Math.max(a[3], c[3]) / 2, r = hw + .9;
        const i0 = Math.max(0, Math.floor((Math.min(a[0], c[0]) - r + HALF) / TS)), i1 = Math.min(TN - 1, Math.ceil((Math.max(a[0], c[0]) + r + HALF) / TS));
        const j0 = Math.max(0, Math.floor((Math.min(a[1], c[1]) - r + HALF) / TS)), j1 = Math.min(TN - 1, Math.ceil((Math.max(a[1], c[1]) + r + HALF) / TS));
        const sx = c[0] - a[0], sz = c[1] - a[1], L2 = sx * sx + sz * sz;
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const k = j * TN + i; if (res.kind[k] >= 2) continue;
          const qx = X(i) - a[0], qz = X(j) - a[1], u = L2 > 0 ? clamp((qx * sx + qz * sz) / L2, 0, 1) : 0, d = hyp(qx - sx * u, qz - sz * u);
          const w = a[3] + (c[3] - a[3]) * u, y = a[2] + (c[2] - a[2]) * u, dep = a[4] + (c[4] - a[4]) * u, cv = (a[5] + (c[5] - a[5]) * u) * (1 - sstep(w / 2 * .9, w / 2 + .8, d));
          const bed = y - dep - cv;
          if (cv > 0 && TH[k] > bed) out[k] = Math.max(out[k], Math.min(TH[k] - bed, cv));
        }
      }
    }
    // 滝つぼ：落ちた所を丸く掘る（滝の高さに応じて 0.25〜0.5m）。崖の面より上は掘らない
    for (const f of res.falls || []) {
      if (!f.foot) continue;
      const [fx, fz] = f.foot, R = Math.max(f.width * .75, .8), D = clamp(.15 + .1 * (f.top - f.bottom), .25, .5), r = R + .6;
      const i0 = Math.max(0, Math.floor((fx - r + HALF) / TS)), i1 = Math.min(TN - 1, Math.ceil((fx + r + HALF) / TS)), j0 = Math.max(0, Math.floor((fz - r + HALF) / TS)), j1 = Math.min(TN - 1, Math.ceil((fz + r + HALF) / TS));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
        const k = j * TN + i; if (TH[k] > f.bottom + .3) continue;
        const v = D * (1 - sstep(R * .35, r, hyp(X(i) - fx, X(j) - fz))); if (v > out[k]) out[k] = v;
      }
    }
    return out;
  }

  // 水源の水を、water.js の pack と同じ形式の流れ・泡の画像（RGBA、同じ格子）へ上書きする（水源の水の所だけ）
  //   flow: R,G = 流れ(ux, -uz)/maxSpeed、B = 0.5、A = 岸からの距離/bankRange（水なら 4 以上）。mask: R = 泡の帯（滝つぼから下流）/trailMaxCover
  function packInto(res, flow, mask, o) {
    const maxSpeed = (o && o.maxSpeed) || 2, bankRange = (o && o.bankRange) || 1.5, n = res.TN * res.TN;
    for (let k = 0; k < n; k++) {
      if (!res.kind[k]) continue;
      flow[k * 4] = Math.round((0.5 + 0.5 * clamp(res.flow[k * 2] / maxSpeed, -1, 1)) * 255);
      flow[k * 4 + 1] = Math.round((0.5 + 0.5 * clamp(-res.flow[k * 2 + 1] / maxSpeed, -1, 1)) * 255);
      flow[k * 4 + 2] = 128; flow[k * 4 + 3] = Math.max(4, Math.round(clamp(res.bank[k] / bankRange, 0, 1) * 255));
      if (mask) { mask[k * 4] = Math.round(clamp((res.trail ? res.trail[k] : 0) / ((o && o.trailMaxCover) || .65), 0, 1) * 255); mask[k * 4 + 3] = 255; }
    }
  }

  const api = { PRESETS, DEFAULTS, solve, carve, packInto, widthOf, depthOf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TDSprings = api;
})(typeof window !== 'undefined' ? window : this);

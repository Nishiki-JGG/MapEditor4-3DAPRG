// 水の解析（マップエディター用）。エディターの画面と Unity への書き出しで同じデータを使うための、画面に依存しない関数だけを置く。
// ブラウザでは window.TDWater、node では module.exports で使う。
//
// 入力は「書き出しの格子」（TN×TN、間隔 TS、エディター座標: x = -HALF + i*TS, z = -HALF + j*TS）の高さ TH と水位。
//   analyze({ TN, TS, HALF, TH, level, falls:[{id,x,z,w}], options })
//     wet      水の所（水位より 2cm 以上低い）
//     depth    水深(m)。陸は 0
//     flow     流れ(ux, uz) m/s（エディター座標）。滝の着水点から出口（地図の端の水）へ。出口が無い池は小さな漏れ項で流れが広がって消える
//     psi      流れ関数 0..1（流線にそって一定。白い筋の横の座標）
//     bank     岸からの距離(m)（水のセルの中心から、一番近い陸のセルの縁まで）
//     trail    滝から流れの筋にそった泡の帯の「覆う割合」(0..0.65)
//   pack(res, opts) → { flow:Uint8Array(RGBA), mask:Uint8Array(RGBA) }  Unity の軸（z は逆向き）で、PNG の行 j は analyze と同じ並び
//   encodePngRGBA(w, h, rgba)  無圧縮(stored)の PNG（どのブラウザ・node でも同じバイト列になる）
//
// 流れの式（CAV-002 の水と同じ）: ∇・(D∇φ)=0 に漏れ項 ε・D・φ を足したものを共役勾配法で解く。入口 φ=1（滝の着水点のまわり）、出口 φ=0。
// 流れ u = -∇φ を、水の格子の速さの 95% 点が speedP95 になるよう全体を同じ倍率で合わせる。
(function (root) {
  'use strict';
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const hyp = (a, b) => Math.sqrt(a * a + b * b);   // Math.hypot は実装ごとに最後の1ビットが違い得るので使わない
  const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const DEFAULTS = {
    wetMin: 0.02,          // 水の所とみなす最小の水深(m)
    leakLength: 12,        // 漏れ項の長さ(m)。ε = 1/L²。出口の無い池で流れが消える距離の目安
    speedP95: 1.2,         // 水の格子の速さの95%点(m/s)
    maxSpeed: 2.0,         // 画像に入れる速さの上限(m/s)
    bankRange: 1.5,        // 岸からの距離の画像の最大(m)
    trailMaxCover: 0.65,   // 泡の帯の「覆う割合」の画像の最大
    trailReach: 16,        // 泡の帯の長さ(m)（CAV-002 と同じ）
    trailStep: 0.3,        // 流れの筋をたどる刻み(m)
    trailMaxLen: 24,       // 筋の最長(m)
    tol: 1e-9, maxIter: 6000,
  };

  function analyze(o) {
    const opt = Object.assign({}, DEFAULTS, o.options || {});
    const { TN, TS, HALF, TH, level } = o, falls = o.falls || [], n = TN * TN, warnings = [];
    const X = i => -HALF + i * TS;
    const wet = new Uint8Array(n), depth = new Float32Array(n);
    let wetCount = 0, maxDepth = 0;
    for (let k = 0; k < n; k++) { const d = level - TH[k]; if (d > opt.wetMin) { wet[k] = 1; depth[k] = d; wetCount++; if (d > maxDepth) maxDepth = d; } }
    const res = { TN, TS, HALF, level, wet, depth, options: opt, warnings, wetCount, maxDepth };
    const flow = new Float32Array(n * 2), psi = new Float32Array(n), bank = new Float32Array(n), trail = new Float32Array(n);
    Object.assign(res, { flow, psi, bank, trail, hasFlow: false, falls: [], paths: [], inflows: [] });
    if (!wetCount) { warnings.push('水位より低い所がありません（水は出ません）'); return res; }

    // ---- 岸からの距離（2回の走査の距離変換、斜めは √2）。地図の外側は陸としない（水が出ていく所）
    const INF = 1e9, dd = TS * Math.SQRT2, dist = new Float32Array(n);
    for (let k = 0; k < n; k++) dist[k] = wet[k] ? INF : 0;
    for (let pass = 0; pass < 2; pass++) {
      for (let j = 0; j < TN; j++) for (let i = 0; i < TN; i++) {
        const k = j * TN + i; if (!dist[k]) continue; let b = dist[k];
        if (i > 0) b = Math.min(b, dist[k - 1] + TS);
        if (j > 0) { b = Math.min(b, dist[k - TN] + TS); if (i > 0) b = Math.min(b, dist[k - TN - 1] + dd); if (i < TN - 1) b = Math.min(b, dist[k - TN + 1] + dd); }
        dist[k] = b;
      }
      for (let j = TN - 1; j >= 0; j--) for (let i = TN - 1; i >= 0; i--) {
        const k = j * TN + i; if (!dist[k]) continue; let b = dist[k];
        if (i < TN - 1) b = Math.min(b, dist[k + 1] + TS);
        if (j < TN - 1) { b = Math.min(b, dist[k + TN] + TS); if (i < TN - 1) b = Math.min(b, dist[k + TN + 1] + dd); if (i > 0) b = Math.min(b, dist[k + TN - 1] + dd); }
        dist[k] = b;
      }
    }
    for (let k = 0; k < n; k++) bank[k] = wet[k] ? (dist[k] >= INF / 2 ? opt.bankRange * 4 : Math.max(dist[k] - 0.5 * TS, 0.02)) : 0;

    // ---- 滝の着水点 → 流れの入口
    const D = new Float32Array(n); for (let k = 0; k < n; k++) D[k] = wet[k] ? clamp(depth[k], 0.05, 4) : 0;
    const src = new Uint8Array(n); let srcCount = 0;
    for (const f of falls) {
      const R = clamp(0.4 * (f.w || 2) + 0.2, 1.0, 2.4);
      const nearest = (cx, cz, r) => {
        let best = -1, bd = 1e9; const i0 = Math.max(0, Math.floor((cx - r + HALF) / TS)), i1 = Math.min(TN - 1, Math.ceil((cx + r + HALF) / TS));
        const j0 = Math.max(0, Math.floor((cz - r + HALF) / TS)), j1 = Math.min(TN - 1, Math.ceil((cz + r + HALF) / TS));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * TN + i; if (!wet[k]) continue; const d = hyp(X(i) - cx, X(j) - cz); if (d < bd) { bd = d; best = k; } }
        return best;
      };
      let cx = f.x, cz = f.z, k0 = nearest(cx, cz, R);
      let moved = false;
      if (k0 < 0) { k0 = nearest(cx, cz, 4); moved = k0 >= 0; if (k0 >= 0) { cx = X(k0 % TN); cz = X((k0 / TN) | 0); } }
      if (k0 < 0) { warnings.push(`滝 ${f.id || ''} の着水点（${f.x.toFixed(1)}, ${f.z.toFixed(1)}）の4m以内に水がありません（乾いた所に落ちています）`); res.falls.push({ id: f.id, x: f.x, z: f.z, radius: R, wetCells: 0, dry: true }); continue; }
      let cnt = 0;
      const i0 = Math.max(0, Math.floor((cx - R + HALF) / TS)), i1 = Math.min(TN - 1, Math.ceil((cx + R + HALF) / TS));
      const j0 = Math.max(0, Math.floor((cz - R + HALF) / TS)), j1 = Math.min(TN - 1, Math.ceil((cz + R + HALF) / TS));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * TN + i; if (wet[k] && hyp(X(i) - cx, X(j) - cz) <= R) { if (!src[k]) { src[k] = 1; srcCount++; } cnt++; } }
      if (!cnt) { src[k0] = 1; srcCount++; cnt = 1; }
      res.falls.push({ id: f.id, x: f.x, z: f.z, cx, cz, radius: R, wetCells: cnt, moved, dry: false });
    }
    // ---- 滝の無い水（川）：地図の端に2か所以上で接していれば、水底の高い端を入口、ほかの端を出口にする（水位は同じなので、水底が高い=上流）
    //   1か所だけで接する／端に接しない水（池・湖）は、流れの入口が無いので動かない。入口の選び方は res.inflows に残す。
    res.inflows = []; let compAll = null, compCount = 0;
    {
      const comp = new Int32Array(n).fill(-1); let nc = 0; const stack = []; compAll = comp;
      for (let s = 0; s < n; s++) {
        if (!wet[s] || comp[s] >= 0) continue; comp[s] = nc; stack.length = 0; stack.push(s);
        while (stack.length) {
          const k = stack.pop(), i = k % TN, j = (k / TN) | 0;
          if (i > 0 && wet[k - 1] && comp[k - 1] < 0) { comp[k - 1] = nc; stack.push(k - 1); }
          if (i < TN - 1 && wet[k + 1] && comp[k + 1] < 0) { comp[k + 1] = nc; stack.push(k + 1); }
          if (j > 0 && wet[k - TN] && comp[k - TN] < 0) { comp[k - TN] = nc; stack.push(k - TN); }
          if (j < TN - 1 && wet[k + TN] && comp[k + TN] < 0) { comp[k + TN] = nc; stack.push(k + TN); }
        }
        nc++;
      }
      compCount = nc;
      const hasSrc = new Uint8Array(nc); for (let k = 0; k < n; k++) if (src[k]) hasSrc[comp[k]] = 1;
      const onBorder = k => { const i = k % TN, j = (k / TN) | 0; return i === 0 || j === 0 || i === TN - 1 || j === TN - 1; };
      const seg = new Int32Array(n).fill(-1); const segs = [];   // 端に接する水のセルを、つながった区間（8近傍）にまとめる
      for (let s = 0; s < n; s++) {
        if (!wet[s] || !onBorder(s) || seg[s] >= 0 || hasSrc[comp[s]]) continue;
        const id = segs.length, cells = []; seg[s] = id; stack.length = 0; stack.push(s);
        while (stack.length) {
          const k = stack.pop(); cells.push(k); const i = k % TN, j = (k / TN) | 0;
          for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
            const ii = i + di, jj = j + dj; if ((!di && !dj) || ii < 0 || jj < 0 || ii >= TN || jj >= TN) continue;
            const q = jj * TN + ii; if (wet[q] && onBorder(q) && seg[q] < 0 && comp[q] === comp[s]) { seg[q] = id; stack.push(q); }
          }
        }
        let sum = 0; for (const k of cells) sum += TH[k];
        segs.push({ comp: comp[s], cells, meanBed: sum / cells.length });
      }
      for (let c = 0; c < nc; c++) {
        if (hasSrc[c]) continue; const mine = segs.filter(q => q.comp === c); if (mine.length < 2) continue;
        mine.sort((a, b) => b.meanBed - a.meanBed);
        for (const k of mine[0].cells) { src[k] = 1; srcCount++; }
        const cx = mine[0].cells.reduce((a, k) => a + X(k % TN), 0) / mine[0].cells.length, cz = mine[0].cells.reduce((a, k) => a + X((k / TN) | 0), 0) / mine[0].cells.length;
        res.inflows.push({ kind: 'river', x: +cx.toFixed(2), z: +cz.toFixed(2), cells: mine[0].cells.length, meanBed: +mine[0].meanBed.toFixed(3), outlets: mine.length - 1 });
      }
    }
    if (!srcCount) { warnings.push('流れの入口になる滝も、地図の端から端へ流れる川もありません（流れ・泡の帯は出ません。水際の線だけ出ます）'); return finish(res); }

    // ---- 流れ: ∇・(D∇φ) = ε D φ を共役勾配法で解く
    const sink = new Uint8Array(n);
    for (let j = 0; j < TN; j++) for (let i = 0; i < TN; i++) { if (i === 0 || j === 0 || i === TN - 1 || j === TN - 1) { const k = j * TN + i; if (wet[k] && !src[k]) sink[k] = 1; } }
    const kE = new Float32Array(n), kN = new Float32Array(n);   // 面の係数（両側の水深の平均、片側が陸なら 0）
    for (let j = 0; j < TN; j++) for (let i = 0; i < TN; i++) {
      const k = j * TN + i;
      if (i < TN - 1 && wet[k] && wet[k + 1]) kE[k] = (D[k] + D[k + 1]) * .5;
      if (j < TN - 1 && wet[k] && wet[k + TN]) kN[k] = (D[k] + D[k + TN]) * .5;
    }
    const eps = 1 / (opt.leakLength * opt.leakLength), leakK = new Float32Array(n);
    // 漏れ項は、出口の無い水（池・湖）だけ。出口（地図の端の水）がある水は、流れが出口へ通り抜けるので漏らさない
    const compSink = new Uint8Array(compCount); for (let k = 0; k < n; k++) if (sink[k]) compSink[compAll[k]] = 1;
    for (let k = 0; k < n; k++) leakK[k] = wet[k] && compSink[compAll[k]] ? 0 : eps * D[k] * TS * TS;
    const kW = k => (k % TN) > 0 ? kE[k - 1] : 0, kS = k => k >= TN ? kN[k - TN] : 0;
    const free = new Uint8Array(n), diag = new Float64Array(n);
    for (let k = 0; k < n; k++) {
      const s = kE[k] + kW(k) + kN[k] + kS(k);
      diag[k] = s + leakK[k];
      if (wet[k] && !src[k] && !sink[k] && s > 0) free[k] = 1;
    }
    const applyA = (f, out) => {
      for (let k = 0; k < n; k++) {
        if (!free[k]) { out[k] = 0; continue; }
        const i = k % TN; let v = diag[k] * f[k];
        if (i < TN - 1) v -= kE[k] * f[k + 1] * free[k + 1];
        if (i > 0) v -= kE[k - 1] * f[k - 1] * free[k - 1];
        if (k + TN < n) v -= kN[k] * f[k + TN] * free[k + TN];
        if (k >= TN) v -= kN[k - TN] * f[k - TN] * free[k - TN];
        out[k] = v;
      }
    };
    const b = new Float64Array(n);
    for (let k = 0; k < n; k++) {
      if (!free[k]) continue; const i = k % TN; let v = 0;
      if (i < TN - 1 && src[k + 1]) v += kE[k];
      if (i > 0 && src[k - 1]) v += kE[k - 1];
      if (k + TN < n && src[k + TN]) v += kN[k];
      if (k >= TN && src[k - TN]) v += kN[k - TN];
      b[k] = v;
    }
    const phi = new Float64Array(n), r = Float64Array.from(b), pv = Float64Array.from(b), Ap = new Float64Array(n);
    let rs = 0, bb = 0; for (let k = 0; k < n; k++) { rs += r[k] * r[k]; bb += b[k] * b[k]; }
    let it = 0;
    if (bb > 0) for (; it < opt.maxIter; it++) {
      applyA(pv, Ap); let pAp = 0; for (let k = 0; k < n; k++) pAp += pv[k] * Ap[k];
      const alpha = rs / Math.max(pAp, 1e-30); let rn = 0;
      for (let k = 0; k < n; k++) { phi[k] += alpha * pv[k]; r[k] -= alpha * Ap[k]; rn += r[k] * r[k]; }
      if (rn < opt.tol * bb) { rs = rn; it++; break; }
      const beta = rn / rs; for (let k = 0; k < n; k++) pv[k] = r[k] + beta * pv[k]; rs = rn;
    }
    res.cg = { iterations: it, relResidual: Math.sqrt(rs / Math.max(bb, 1e-30)) };
    if (res.cg.relResidual > 1e-3) warnings.push(`流れの計算が収束しきっていません（残差 ${res.cg.relResidual.toExponential(1)}）`);
    for (let k = 0; k < n; k++) if (src[k]) phi[k] = 1;
    // 流量の保存の確認用：入口から出る量 = 出口へ出る量 + 漏れ
    let fin = 0, fsink = 0, fleak = 0;
    for (let k = 0; k < n; k++) {
      const i = k % TN;
      if (src[k]) {
        if (i < TN - 1 && wet[k + 1] && !src[k + 1]) fin += kE[k] * (1 - phi[k + 1]);
        if (i > 0 && wet[k - 1] && !src[k - 1]) fin += kE[k - 1] * (1 - phi[k - 1]);
        if (k + TN < n && wet[k + TN] && !src[k + TN]) fin += kN[k] * (1 - phi[k + TN]);
        if (k >= TN && wet[k - TN] && !src[k - TN]) fin += kN[k - TN] * (1 - phi[k - TN]);
      }
      if (sink[k]) {
        if (i < TN - 1 && free[k + 1]) fsink += kE[k] * phi[k + 1];
        if (i > 0 && free[k - 1]) fsink += kE[k - 1] * phi[k - 1];
        if (k + TN < n && free[k + TN]) fsink += kN[k] * phi[k + TN];
        if (k >= TN && free[k - TN]) fsink += kN[k - TN] * phi[k - TN];
      }
      if (free[k]) fleak += leakK[k] * phi[k];
    }
    res.flux = { in: fin, sink: fsink, leak: fleak, balance: fin > 0 ? (fin - fsink - fleak) / fin : 0 };

    // u = -∇φ（水の所どうしの差分、岸は片側差分）
    const grad = (k, i, j, axis) => {
      const st = axis ? TN : 1, h = TS, okp = axis ? j < TN - 1 && wet[k + st] : i < TN - 1 && wet[k + st], okm = axis ? j > 0 && wet[k - st] : i > 0 && wet[k - st];
      if (okp && okm) return (phi[k + st] - phi[k - st]) / (2 * h);
      if (okp) return (phi[k + st] - phi[k]) / h;
      if (okm) return (phi[k] - phi[k - st]) / h;
      return 0;
    };
    let ux = new Float64Array(n), uz = new Float64Array(n);
    for (let j = 0; j < TN; j++) for (let i = 0; i < TN; i++) { const k = j * TN + i; if (!wet[k]) continue; ux[k] = -grad(k, i, j, 0); uz[k] = -grad(k, i, j, 1); }
    const smooth = a => {
      const out = new Float64Array(n);
      for (let j = 0; j < TN; j++) for (let i = 0; i < TN; i++) {
        const k = j * TN + i; if (!wet[k]) continue; let s = 0, c = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= TN || jj >= TN) continue; const q = jj * TN + ii; if (wet[q]) { s += a[q]; c++; } }
        out[k] = s / c;
      }
      return out;
    };
    ux = smooth(ux); uz = smooth(uz);
    const sp = []; for (let k = 0; k < n; k++) if (wet[k]) sp.push(hyp(ux[k], uz[k]));
    sp.sort((a, c) => a - c);
    const p95 = sp[Math.floor(sp.length * .95)] || 0;
    const scale = p95 > 1e-12 ? opt.speedP95 / p95 : 0;
    for (let k = 0; k < n; k++) { let a = ux[k] * scale, c = uz[k] * scale; const s = hyp(a, c); if (s > opt.maxSpeed) { a *= opt.maxSpeed / s; c *= opt.maxSpeed / s; } flow[k * 2] = a; flow[k * 2 + 1] = c; }
    res.hasFlow = scale > 0;

    // ---- 流れ関数 ψ: ∂ψ/∂x = -q_z, ∂ψ/∂z = q_x（q = D u）を、水の所どうしの差の最小二乗で解く
    {
      const gx = new Float64Array(n), gz = new Float64Array(n);
      for (let k = 0; k < n; k++) { gx[k] = -D[k] * flow[k * 2 + 1]; gz[k] = D[k] * flow[k * 2]; }
      const bp = new Float64Array(n), deg = new Float64Array(n);
      const eE = k => (k % TN) < TN - 1 && wet[k] && wet[k + 1], eN = k => k + TN < n && wet[k] && wet[k + TN];
      for (let k = 0; k < n; k++) {
        if (!wet[k]) continue;
        if (eE(k)) { const c = (gx[k] + gx[k + 1]) * .5 * TS; bp[k] -= c; bp[k + 1] += c; deg[k]++; deg[k + 1]++; }
        if (eN(k)) { const c = (gz[k] + gz[k + TN]) * .5 * TS; bp[k] -= c; bp[k + TN] += c; deg[k]++; deg[k + TN]++; }
      }
      const L = (f, out) => {
        for (let k = 0; k < n; k++) {
          if (!wet[k]) { out[k] = 0; continue; }
          const i = k % TN; let v = deg[k] * f[k] + 1e-6 * f[k];
          if (i < TN - 1 && wet[k + 1]) v -= f[k + 1];
          if (i > 0 && wet[k - 1]) v -= f[k - 1];
          if (k + TN < n && wet[k + TN]) v -= f[k + TN];
          if (k >= TN && wet[k - TN]) v -= f[k - TN];
          out[k] = v;
        }
      };
      const ps = new Float64Array(n), rr = Float64Array.from(bp), pp = Float64Array.from(bp), Lp = new Float64Array(n);
      let rs2 = 0, b2 = 0; for (let k = 0; k < n; k++) { rs2 += rr[k] * rr[k]; b2 += bp[k] * bp[k]; }
      if (b2 > 0) for (let q = 0; q < opt.maxIter; q++) {
        L(pp, Lp); let pL = 0; for (let k = 0; k < n; k++) pL += pp[k] * Lp[k];
        const al = rs2 / Math.max(pL, 1e-30); let rn = 0;
        for (let k = 0; k < n; k++) { ps[k] += al * pp[k]; rr[k] -= al * Lp[k]; rn += rr[k] * rr[k]; }
        if (rn < 1e-14 * b2) break;
        const be = rn / rs2; for (let k = 0; k < n; k++) pp[k] = rr[k] + be * pp[k]; rs2 = rn;
      }
      const vals = []; for (let k = 0; k < n; k++) if (wet[k] && hyp(flow[k * 2], flow[k * 2 + 1]) > 0.05) vals.push(ps[k]);
      vals.sort((a, c) => a - c);
      const lo = vals.length ? vals[Math.floor(vals.length * .02)] : 0, hi = vals.length ? vals[Math.floor(vals.length * .98)] : 1;
      for (let k = 0; k < n; k++) psi[k] = wet[k] ? clamp((ps[k] - lo) / Math.max(hi - lo, 1e-9), 0, 1) : 0;
    }

    // ---- 滝から流れの筋をたどり、その筋にそった細い泡の帯（CAV-002 の R126b と同じ式）
    const sampleFlow = (x, z) => {
      const i = clamp(Math.round((x + HALF) / TS), 0, TN - 1), j = clamp(Math.round((z + HALF) / TS), 0, TN - 1), k = j * TN + i;
      return wet[k] ? [flow[k * 2], flow[k * 2 + 1], k] : null;
    };
    for (const f of res.falls) {
      if (f.dry) continue;
      let bk = -1, bs = 0;
      for (let k = 0; k < n; k++) {
        if (!wet[k]) continue; const d = hyp(X(k % TN) - f.cx, X((k / TN) | 0) - f.cz);
        if (d < f.radius + 0.1 || d > f.radius + 0.7) continue;
        const s = hyp(flow[k * 2], flow[k * 2 + 1]); if (s > bs) { bs = s; bk = k; }
      }
      if (bk < 0) continue;
      let px = X(bk % TN), pz = X((bk / TN) | 0); const pts = [[px, pz]];
      for (let s = 0; s < Math.ceil(opt.trailMaxLen / opt.trailStep); s++) {
        const v = sampleFlow(px, pz); if (!v) break; const sp0 = hyp(v[0], v[1]); if (sp0 < 0.03) break;
        px += v[0] / sp0 * opt.trailStep; pz += v[1] / sp0 * opt.trailStep; pts.push([px, pz]);
        if (px < -HALF || pz < -HALF || px > HALF || pz > HALF) break;
      }
      res.paths.push({ fall: f.id, points: pts.map(p => [+p[0].toFixed(3), +p[1].toFixed(3)]) });
      if (pts.length < 3) continue;
      const best = new Float32Array(n).fill(1e9), along = new Float32Array(n); let base = 0;
      for (let s = 0; s < pts.length - 1; s++) {
        const [ax, az] = pts[s], [cx2, cz2] = pts[s + 1], abx = cx2 - ax, abz = cz2 - az, len = hyp(abx, abz), ab2 = abx * abx + abz * abz;
        const m = 3.6, i0 = Math.max(0, Math.floor((Math.min(ax, cx2) - m + HALF) / TS)), i1 = Math.min(TN - 1, Math.ceil((Math.max(ax, cx2) + m + HALF) / TS));
        const j0 = Math.max(0, Math.floor((Math.min(az, cz2) - m + HALF) / TS)), j1 = Math.min(TN - 1, Math.ceil((Math.max(az, cz2) + m + HALF) / TS));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const k = j * TN + i; if (!wet[k]) continue; const x = X(i), z = X(j);
          const t = clamp(((x - ax) * abx + (z - az) * abz) / Math.max(ab2, 1e-9), 0, 1), d = hyp(x - (ax + abx * t), z - (az + abz * t));
          if (d < best[k]) { best[k] = d; along[k] = base + t * len; }
        }
        base += len;
      }
      for (let k = 0; k < n; k++) {
        if (!wet[k] || best[k] > 3.6) continue;
        const a = clamp(along[k] / opt.trailReach, 0, 1), w = 0.6 + 0.6 * a, fromFall = hyp(X(k % TN) - f.cx, X((k / TN) | 0) - f.cz);
        const v = (0.60 + (0.42 - 0.60) * a) * Math.exp(-(best[k] * best[k]) / (w * w)) * sstep(1.5, 3, fromFall) * (1 - sstep(opt.trailReach, opt.trailMaxLen, along[k]));
        if (v > trail[k]) trail[k] = v;
      }
    }
    return finish(res);
  }

  function finish(res) {
    const { wet, flow, depth } = res, n = res.TN * res.TN, sp = [];
    for (let k = 0; k < n; k++) if (wet[k]) sp.push(hyp(flow[k * 2], flow[k * 2 + 1]));
    sp.sort((a, c) => a - c);
    const q = p => sp.length ? +sp[Math.min(sp.length - 1, Math.floor(sp.length * p))].toFixed(3) : 0;
    res.stats = { wetCells: res.wetCount, wetFraction: +(res.wetCount / n).toFixed(4), maxDepth: +res.maxDepth.toFixed(3), speedP50: q(.5), speedP90: q(.9), speedP95: q(.95), speedMax: q(.9999) };
    return res;
  }

  // Unity の軸で画像にする。PNG の行 j は analyze の j と同じ（行 0 = エディター z 最小 = Unity z 最大 = 画像の上端）。
  function pack(res, o) {
    const opt = Object.assign({}, res.options, o || {}), n = res.TN * res.TN, flow = new Uint8Array(n * 4), mask = new Uint8Array(n * 4);
    for (let k = 0; k < n; k++) {
      const ux = res.flow[k * 2], uzUnity = -res.flow[k * 2 + 1], w = res.wet[k];
      flow[k * 4] = w ? Math.round((0.5 + 0.5 * clamp(ux / opt.maxSpeed, -1, 1)) * 255) : 128;
      flow[k * 4 + 1] = w ? Math.round((0.5 + 0.5 * clamp(uzUnity / opt.maxSpeed, -1, 1)) * 255) : 128;
      flow[k * 4 + 2] = w ? Math.round(res.psi[k] * 255) : 0;
      flow[k * 4 + 3] = w ? Math.max(4, Math.round(clamp(res.bank[k] / opt.bankRange, 0, 1) * 255)) : 0;   // 0 = 陸、水なら必ず 4 以上
      mask[k * 4] = w ? Math.round(clamp(res.trail[k] / opt.trailMaxCover, 0, 1) * 255) : 0;
      mask[k * 4 + 3] = 255;
    }
    return { flow, mask };
  }

  // ---- PNG（無圧縮）。バイト列がどの環境でも同じになる。
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u => { let c = 0xFFFFFFFF; for (let i = 0; i < u.length; i++) c = CRC[(c ^ u[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  function encodePngRGBA(w, h, rgba) {
    const rowLen = 1 + w * 4, raw = new Uint8Array(rowLen * h);
    for (let y = 0; y < h; y++) { raw[y * rowLen] = 0; raw.set(rgba.subarray(y * w * 4, (y + 1) * w * 4), y * rowLen + 1); }
    const blocks = Math.ceil(raw.length / 65535) || 1, z = new Uint8Array(2 + raw.length + blocks * 5 + 4);
    let p = 0; z[p++] = 0x78; z[p++] = 0x01;
    for (let b = 0; b < blocks; b++) {
      const s = b * 65535, len = Math.min(65535, raw.length - s), last = b === blocks - 1 ? 1 : 0;
      z[p++] = last; z[p++] = len & 255; z[p++] = len >> 8; z[p++] = ~len & 255; z[p++] = (~len >> 8) & 255; z.set(raw.subarray(s, s + len), p); p += len;
    }
    let a = 1, bsum = 0; for (let i = 0; i < raw.length; i++) { a = (a + raw[i]) % 65521; bsum = (bsum + a) % 65521; }
    const ad = ((bsum << 16) | a) >>> 0; z[p++] = ad >>> 24; z[p++] = (ad >>> 16) & 255; z[p++] = (ad >>> 8) & 255; z[p++] = ad & 255;
    const chunk = (type, data) => {
      const out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer); dv.setUint32(0, data.length);
      for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
      out.set(data, 8); dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length))); return out;
    };
    const ihdr = new Uint8Array(13), dv = new DataView(ihdr.buffer); dv.setUint32(0, w); dv.setUint32(4, h); ihdr[8] = 8; ihdr[9] = 6;
    const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', z.subarray(0, p)), chunk('IEND', new Uint8Array(0))];
    const out = new Uint8Array(parts.reduce((s, q) => s + q.length, 0)); let o = 0; for (const q of parts) { out.set(q, o); o += q.length; }
    return out;
  }

  const api = { analyze, pack, encodePngRGBA, DEFAULTS, crc32 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.TDWater = api;
})(typeof window !== 'undefined' ? window : globalThis);

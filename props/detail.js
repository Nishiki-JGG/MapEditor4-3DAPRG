// Stone detail texture for rocks, cliffs and masonry (loaded after common.js). A tileable grey noise with fine cracks and
// pits, painted once at start-up (no image files). The rock and stone materials project it from three sides in world
// space, so the low-poly shapes need no texture coordinates and neighbouring rocks do not repeat the same pattern.
(() => {
'use strict';
const { rng, hash2 } = TDGeo;
const S = 256;
function paint() {
  const d = new Uint8Array(S * S * 4), f = new Float32Array(S * S);
  // periodic value noise: lattice coordinates wrap at the period, so the texture tiles
  const vn = (x, y, p) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const h = (i, j) => hash2(((i % p) + p) % p, ((j % p) + p) % p);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), e = h(xi + 1, yi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + e) * u * v;
  };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let n = 0, amp = .5, tot = 0;
    for (let o = 0; o < 5; o++) { const p = 4 << o; n += vn(x / S * p, y / S * p, p) * amp; tot += amp; amp *= .55; }
    // ridged layer: thin dark cracks where a mid-frequency noise crosses .5
    const r = 1 - Math.abs(vn(x / S * 8 + 3.1, y / S * 8 + 7.7, 8) * 2 - 1);
    f[y * S + x] = n / tot - Math.pow(r, 14) * .35;
  }
  const R = rng(77);
  for (let k = 0; k < 900; k++) { const x = (R() * S) | 0, y = (R() * S) | 0, s = R() < .8 ? 1 : 2; for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) f[((y + j) % S) * S + (x + i) % S] -= .12; }
  let lo = 1e9, hi = -1e9; for (const v of f) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  for (let i = 0; i < S * S; i++) { const v = Math.round((f[i] - lo) / (hi - lo) * 255); d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; }
  return d;
}
TDGeo.DETAIL = { size: S, paint };
})();

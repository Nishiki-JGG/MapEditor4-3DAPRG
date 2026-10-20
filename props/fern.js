// シダ（fern）
TDProps.add({
  id: 'fern', name: 'シダ',
  r: 0, min: 1, sc: [.8, 1.5], slope: .8, vis: .8, sway: .6,
  tags: ['jungle', 'forest'], height: 0.58, material: 'foliage',
  build() {
    const { clamp, rng, col, mixc, makeGeo, petalGeo, basisAt } = TDGeo;
    // fronds with pairs of leaflets that shrink toward the curled tip
    const R = rng(96), parts = [], C = [0, .15, 0];
    const leaf = (y, ny, Rr, pr) => mixc(col(0x23601f), col(0x58993a), clamp(pr * .5 + y * .7, 0, 1));
    for (let f = 0; f < 9; f++) {
      const a = f / 9 * 6.283 + R() * .3, L = .95 + R() * .35, segs = 6, len = L / segs;
      let x = 0, y = .04, z = 0;
      for (let s = 0; s < segs; s++) {
        const t = (s + .5) / segs, ang = 1.15 - 2.0 * t * t, dir = [Math.cos(a) * Math.cos(ang), Math.sin(ang), Math.sin(a) * Math.cos(ang)];
        x += dir[0] * len; y += dir[1] * len; z += dir[2] * len;
        const side = [-Math.sin(a), 0, Math.cos(a)], ll = .36 * (1 - t * .7) * (L / 1.1);
        for (const sd of [-1, 1]) {
          const d = [side[0] * sd + dir[0] * .55, side[1] * sd + dir[1] * .55 + .08, side[2] * sd + dir[2] * .55];
          parts.push({ g: petalGeo(ll, ll * .5, .3), m: basisAt([x, y, z], d, [0, 1, 0]), cfn: leaf, j: .1, sn: C, snw: .6 });
        }
      }
      parts.push({ g: petalGeo(.12, .05), m: basisAt([x, y, z], [Math.cos(a), -.6, Math.sin(a)]), cfn: leaf, sn: C, snw: .6 });
    }
    return makeGeo(parts, 96);
  },
});

// 針葉樹（pine）
TDProps.add({
  id: 'pine', name: '針葉樹',
  r: .45, min: 1.7, sc: [.8, 1.4], slope: .9, vis: 1.5, tree: true,
  sway: .6, tags: ['forest', 'mountain', 'canyon', 'snow', 'castle', 'graveyard'], height: 6.09, material: 'foliage', canopy: true,
  build() {
    const { col, mixc, mat4, makeGeo, limb, tierGeo } = TDGeo;
    const parts = [];
    limb(parts, [0, -.1, 0], [0, 2.2, 0], .22, .1, 6, (y, ny, R) => mixc(col(0x3e2a1a), col(0x5c4129), R()));
    const rs = [1.55, 1.36, 1.15, .94, .72, .5, .3];
    const top = (y, ny, R, pr) => ny > .55 ? mixc(col(0x4f8f4f), col(0x7fb366), R() * .7 + y * .03) : ny > .2 ? mixc(col(0x2c6a3c), col(0x3f7f47), R()) : mixc(col(0x173a25), col(0x214a2d), R());
    rs.forEach((r, k) => parts.push({ g: tierGeo(r, 1.35, 9 + (k % 2), k * 1.7), m: mat4(0, 1.45 + k * .66, 0, 1, 1, 1, k * .9), cfn: top, j: .1, sn: [0, 1.2 + k * .66, 0], snw: .55 }));
    return makeGeo(parts, 11, { ao: 1.6 });
  },
});

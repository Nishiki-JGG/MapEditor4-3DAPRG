// 茂み（bush）
TDProps.add({
  id: 'bush', name: '茂み',
  r: 0, min: 1.0, sc: [.7, 1.5], slope: .8, vis: .9,
  sway: .5, tags: ['grassland', 'forest', 'jungle', 'canyon', 'ruins', 'castle', 'beach'], height: 0.93, touch: true, material: 'cards',
  build() {
    const { rng, col, mixc, clamp, makeGeo, limb, quadGeo, crossGeo, faceOut, ATLAS } = TDGeo;
    // a low dome of leaf clumps on crossed cards over a few stems; darker toward the ground and the middle
    const R = rng(14), parts = [], C = [0, .3, 0];
    for (let k = 0; k < 5; k++) { const a = k * 1.3; limb(parts, [0, 0, 0], [Math.cos(a) * .45, .5, Math.sin(a) * .4], .04, .015, 4, () => col(0x5a4632)); }
    const leaf = (y, ny, Rr, pr, cx, cz) => mixc(col(0x627a44), col(0xb8c888), clamp(y * 1.1 + Math.hypot(cx, cz) * .5 + (pr - .5) * .25, 0, 1));
    for (let k = 0; k < 15; k++) {
      const th = k * 2.4 + R() * .5, ph = .15 + R() * 1.25, p = [Math.cos(th) * Math.sin(ph) * .58, .3 + Math.cos(ph) * .32, Math.sin(th) * Math.sin(ph) * .52];
      parts.push({ g: k < 3 ? crossGeo(1, 1) : quadGeo(1, 1), m: faceOut(p, [p[0], p[1] - .15, p[2]], [0, 1, 0], .7 + R() * .3, (R() - .5) * 1.4), cfn: leaf, uvr: ATLAS.uvr('leaf'), j: .06, sn: C, snw: .85 });
    }
    return makeGeo(parts, 14, { ao: .55, uv: ATLAS.white });
  },
});

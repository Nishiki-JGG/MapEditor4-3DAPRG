// 広葉樹（oak）
TDProps.add({
  id: 'oak', name: '広葉樹',
  r: .6, min: 3.2, sc: [.8, 1.3], slope: .8, vis: 2.1, tree: true,
  sway: .5, tags: ['grassland', 'forest', 'jungle', 'ruins', 'beach'], height: 5.53, material: 'cards', canopy: true,
  build() {
    const { rng, col, mixc, clamp, makeGeo, limb, quadGeo, crossGeo, faceOut, branches, ATLAS } = TDGeo;
    // a branching trunk (trunk -> 4 limbs -> 12 twigs) carrying leaf clumps on crossed cards; the crown is darker inside
    const R = rng(112), parts = [], C = [0, 3.75, 0], RX = 2.1, RY = 1.45;
    const bark = (y, ny, Rr) => mixc(col(0xc8b8a0), col(0xe0d0b8), Rr());
    const limbFn = (ps, a, b, r0, r1, seg) => limb(ps, a, b, r0, r1, seg, bark, { uvr: ATLAS.uvr('bark'), j: .05 });
    for (let k = 0; k < 4; k++) { const a = k * 1.57 + .5; limbFn(parts, [Math.cos(a) * .1, .45, Math.sin(a) * .1], [Math.cos(a) * .78, -.08, Math.sin(a) * .78], .17, .05, 5); }
    const tips = branches(parts, limbFn, [0, -.05, 0], [.03, 1, 0], 2.4, .3, 2, R, { taper: .58, seg0: 8, seg: 5, split0: 5, split: 3, spread: 1.15, rise: .45, straight: .4, shrink: .66 });
    const leaf = (y, ny, Rr, pr, cx, cz) => {
      const d = clamp(Math.hypot(cx / RX, (y - C[1]) / RY, cz / RX), 0, 1.2);
      return mixc(mixc(col(0x6f8a4e), col(0x93a866), pr), mixc(col(0xd0dc98), col(0xe6eaa8), pr), clamp(d * .9 - .15 + (y - C[1]) * .12, 0, 1));
    };
    // clumps face out of the crown (one card each; a few crossed ones deep inside fill the gaps seen through the crown)
    const card = (p, s, crossed) => {
      const out = [p[0] - C[0], (p[1] - C[1]) * 1.3 + .35, p[2] - C[2]];
      parts.push({ g: crossed ? crossGeo(1, 1) : quadGeo(1, 1), m: faceOut(p, out, [0, 1, 0], s, (R() - .5) * 1.2), cfn: leaf, uvr: ATLAS.uvr('leaf'), j: .06, sn: C, snw: .85 });
    };
    for (const t of tips) card(t, 1.7 + R() * .35);
    for (let k = 0; k < 22; k++) {
      const th = k * 2.4 + R() * .6, ph = .15 + R() * 1.55, rr = .8 + R() * .2;
      card([C[0] + Math.cos(th) * Math.sin(ph) * RX * rr, C[1] + Math.cos(ph) * RY * rr, C[2] + Math.sin(th) * Math.sin(ph) * RX * rr], 1.55 + R() * .35);
    }
    for (let k = 0; k < 4; k++) { const th = k * 1.57 + .8; card([C[0] + Math.cos(th) * RX * .4, C[1] - .1, C[2] + Math.sin(th) * RX * .4], 1.5, true); }
    return makeGeo(parts, 12, { ao: 1.4, uv: ATLAS.white });
  },
});

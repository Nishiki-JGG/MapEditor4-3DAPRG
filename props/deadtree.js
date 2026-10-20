// 枯れ木（deadtree）
TDProps.add({
  id: 'deadtree', name: '枯れ木',
  r: .3, min: 2.4, sc: [.8, 1.3], slope: .8, vis: 1.1, anyGround: true,
  sway: .2, tags: ['wasteland', 'desert', 'volcano', 'castle', 'snow', 'demon', 'ruins', 'graveyard'], height: 3.44, material: 'cards',
  build() {
    const { rng, col, mixc, makeGeo, limb, branches, ATLAS } = TDGeo;
    // bare, gnarled branching with weathered grey bark; roots grip the ground
    const R = rng(45), parts = [], bark = (y, ny, Rr) => mixc(col(0xc8c0b4), col(0xe0d8cc), Rr());
    const limbFn = (ps, a, b, r0, r1, seg) => limb(ps, a, b, r0, r1, seg, bark, { uvr: ATLAS.uvr('bark'), j: .06 });
    for (let k = 0; k < 3; k++) { const a = k * 2.1 + .3; limbFn(parts, [Math.cos(a) * .1, .35, Math.sin(a) * .1], [Math.cos(a) * .6, -.06, Math.sin(a) * .6], .11, .03, 5); }
    branches(parts, limbFn, [0, -.05, 0], [.06, 1, .02], 1.7, .24, 3, R, { taper: .55, seg0: 7, seg: 4, split0: 3, split: 2, spread: .95, rise: .35, straight: .55, shrink: .62 });
    return makeGeo(parts, 45, { ao: .8, uv: ATLAS.white });
  },
});

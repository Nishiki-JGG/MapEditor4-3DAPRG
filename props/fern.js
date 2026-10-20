// シダ（fern）
TDProps.add({
  id: 'fern', name: 'シダ',
  r: 0, min: 1, sc: [.8, 1.5], slope: .8, vis: .8, sway: .6,
  tags: ['jungle', 'forest'], height: 0.58, material: 'cards',
  build() {
    const { rng, col, mixc, makeGeo, basisAt, stripGeo, ATLAS } = TDGeo;
    // a rosette of arching pinnate fronds (atlas: fern) on bent strips
    const R = rng(96), parts = [], leaf = (y, ny, Rr, pr) => mixc(col(0x98b078), col(0xd0e0a0), pr * .7 + y * .4);
    for (let f = 0; f < 11; f++) {
      const a = f / 11 * 6.283 + R() * .3, up = f % 3 === 0;
      parts.push({ g: stripGeo(.85 + R() * .3, .4, 5, up ? 1.25 : .95, up ? 2.2 : 2.0, .55), m: basisAt([0, .03, 0], [Math.cos(a), 0, Math.sin(a)], [0, 1, 0]), cfn: leaf, uvr: ATLAS.uvr('fern'), j: .06, sn: [0, -.2, 0], snw: .5 });
    }
    return makeGeo(parts, 96, { uv: ATLAS.white });
  },
});

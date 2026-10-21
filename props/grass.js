// 草むら（grass）。地面を覆う丈の高い草の株。歩くと押しのけられる
TDProps.add({
  id: 'grass', name: '草むら',
  r: 0, min: .5, sc: [.7, 1.4], slope: 1, vis: .55,
  sway: 1, tags: ['grassland', 'forest', 'jungle', 'ruins', 'graveyard', 'beach', 'canyon', 'castle'], height: .75, touch: true, material: 'cards2',
  build() {
    const { rng, col, mixc, makeGeo, crossGeo, faceOut, ATLAS2 } = TDGeo;
    // three crossed cards of meadow grass (atlas 2) at different turns and heights, lit from the clump's centre
    const R = rng(301), parts = [], g = (y, ny, Rr, pr) => mixc(col(0xb8c898), col(0xe8f0c8), pr * .6 + y * .4);
    for (let k = 0; k < 3; k++) {
      const a = k * 1.05 + R() * .4, s = .78 - k * .1;
      parts.push({ g: crossGeo(1.25, 1, .5), m: faceOut([(R() - .5) * .18, -.02, (R() - .5) * .18], [Math.cos(a), 0, Math.sin(a)], [0, 1, 0], s), cfn: g, uvr: ATLAS2.uvr('meadow'), j: .05, sn: [0, -.5, 0], snw: .55 });
    }
    return makeGeo(parts, 301, { uv: ATLAS2.white });
  },
});

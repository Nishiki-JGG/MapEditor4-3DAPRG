// 花（flowers）
TDProps.add({
  id: 'flowers', name: '花',
  r: 0, min: .6, sc: [.8, 1.4], slope: .8, vis: .45,
  sway: .8, tags: ['grassland', 'forest', 'ruins'], height: 0.43, material: 'foliage',
  build() {
    const { rng, col, mixc, mat4, makeGeo, leafGeo, petalGeo, basisAt, limb } = TDGeo;
    // a rosette of leaves and stems with five-petal heads
    const R = rng(46), parts = [], cols = [0xf2d23c, 0xf6f2e6, 0xe887b8, 0xa58ae0, 0xf08a4b].map(col);
    const leafC = (y, ny, Rr) => mixc(col(0x356b24), col(0x62983a), Rr());
    for (let k = 0; k < 6; k++) { const a = k * 1.05 + R() * .4; parts.push({ g: leafGeo(.26, .11, .3, .03), m: basisAt([0, .02, 0], [Math.cos(a), .35, Math.sin(a)], [0, 1, 0], .8 + R() * .4), cfn: leafC, sn: [0, -.2, 0], snw: .5 }); }
    const c0 = cols[(R() * cols.length) | 0], c1 = cols[(R() * cols.length) | 0];
    for (let k = 0; k < 7; k++) {
      const a = R() * 6.283, d = .08 + R() * .26, x = Math.cos(a) * d, z = Math.sin(a) * d, h = .2 + R() * .24, hc = R() < .6 ? c0 : c1;
      limb(parts, [x * .3, 0, z * .3], [x, h, z], .012, .009, 3, () => col(0x4f7a2a));
      const tilt = [x * .8, 1, z * .8], s = .085 + R() * .03;
      for (let q = 0; q < 5; q++) {
        const pa = q * 1.2566 + a, dir = [Math.cos(pa), 0, Math.sin(pa)];
        // petals spread out from the head, tilted up a little toward the head's facing
        parts.push({ g: petalGeo(s, s * .62, .55), m: basisAt([x, h, z], [dir[0] + tilt[0] * .3, .35, dir[2] + tilt[2] * .3], tilt), c: hc, j: .06, sn: [x, h - .3, z], snw: .5 });
      }
      parts.push({ g: new THREE.OctahedronGeometry(.026, 0), m: mat4(x, h + .012, z, 1, .6, 1), c: hc === cols[0] ? col(0xb06a20) : col(0xf2c440), j: .05 });
    }
    return makeGeo(parts, 46);
  },
});

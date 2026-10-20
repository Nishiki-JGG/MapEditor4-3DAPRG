// 丸サボテン（barrelcactus）
TDProps.add({
  id: 'barrelcactus', name: '丸サボテン',
  r: 0, min: .8, sc: [.8, 1.5], slope: .8, vis: .5, anyGround: true,
  tags: ['desert', 'wasteland'], height: 0.55,
  build() {
    const { clamp, rng, col, mixc, mat4, makeGeo, petalGeo, basisAt, ribbed } = TDGeo;
    const R = rng(79), parts = [];
    for (let k = 0; k < 3; k++) {
      const x = (R() - .5) * .6, z = (R() - .5) * .6, r = .18 + R() * .14, fc = R() < .5 ? col(0xf06aa0) : col(0xf6d040);
      parts.push({ g: ribbed(new THREE.SphereGeometry(r, 12, 5), 12, .84), m: mat4(x, r * .8, z, 1, 1.1, 1), cfn: (y, ny, Rr) => mixc(col(0x467f3c), col(0x7aaa5a), clamp(Rr() * .6 + (ny > .4 ? .35 : 0), 0, 1)), j: .08 });
      for (let q = 0; q < 5; q++) { const a = q * 1.2566 + k; parts.push({ g: petalGeo(.07, .05, .55), m: basisAt([x, r * 1.84, z], [Math.cos(a), .6, Math.sin(a)]), c: fc, j: .05 }); }
    }
    return makeGeo(parts, 79, { ao: .3 });
  },
});

// 光るきのこ（glowmush）
TDProps.add({
  id: 'glowmush', name: '光るきのこ',
  r: 0, min: .6, sc: [.8, 1.6], slope: 1, vis: .4, anyGround: true, light: [0x6fffd8, 6, .4],
  tags: ['cave', 'jungle', 'demon'], height: 0.48,
  build() {
    const { rng, col, mat4, makeGeo } = TDGeo;
    const R = rng(53), parts = [];
    for (let k = 0; k < 5; k++) {
      const x = (R() - .5) * .6, z = (R() - .5) * .6, h = .15 + R() * .3, r = .07 + R() * .1;
      parts.push({ g: new THREE.CylinderGeometry(r * .25, r * .35, h, 5), m: mat4(x, h / 2, z, 1, 1, 1), c: col(0xcfe8e0) });
      parts.push({ g: new THREE.SphereGeometry(r, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2), m: mat4(x, h - .01, z, 1, .7, 1), c: R() < .5 ? col(0x5ff0d0) : col(0x7fb8ff), glow: 1.5, j: .06 });
    }
    return makeGeo(parts, 53);
  },
});

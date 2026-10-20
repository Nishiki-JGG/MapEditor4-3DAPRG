// 水晶（crystal）
TDProps.add({
  id: 'crystal', name: '水晶',
  r: .35, min: 1.2, sc: [.7, 1.5], slope: 1.2, vis: .6, anyGround: true, light: [0x7fd8ff, 14, .8],
  tags: ['cave', 'demon'], height: 1.63,
  build() {
    const { rng, col, mixc, mat4, displace, makeGeo } = TDGeo;
    const R = rng(52), parts = [], glowC = (y, ny, Rr) => mixc(col(0x6fe3ff), col(0xc39bff), Rr() * .6);
    for (let k = 0; k < 6; k++) {
      const a = k * 1.05 + R() * .4, lean = .15 + R() * .45, h = .6 + R() * 1.1, r = .12 + R() * .1;
      parts.push({ g: new THREE.OctahedronGeometry(1, 0), m: mat4(Math.cos(a) * .18, h * .45, Math.sin(a) * .18, r, h * .55, r, a, Math.cos(a) * lean, Math.sin(a) * lean), cfn: glowC, j: .15, glow: 1.3 });
    }
    parts.push({ g: displace(new THREE.IcosahedronGeometry(.45, 0), .4, 3), m: mat4(0, .05, 0, 1.2, .4, 1.1), c: col(0x4a4650), j: .1 });
    return makeGeo(parts, 52);
  },
});

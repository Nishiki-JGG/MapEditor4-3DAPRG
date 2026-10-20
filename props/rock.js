// 岩（rock）
TDProps.add({
  id: 'rock', name: '岩',
  r: .8, min: 1.4, sc: [.6, 1.9], slope: 4, vis: 1.2, anyGround: true,
  tags: ['common'], height: 1.1, material: 'rock',
  build() {
    const { clamp, col, mixc, mat4, displace, makeGeo, chisel } = TDGeo;
    const parts = [];
    const cf = (y, ny, R, pr) => ny > .78 && R() < .3 ? mixc(col(0x5d7a33), col(0x78924a), R())
      : mixc(col(0x56514a), col(0xa59c8e), clamp(.3 + y * .3 + (Math.floor(y * 4.2 + pr * 3) % 2 ? .1 : -.06) + (R() - .5) * .25 + (ny > .5 ? .12 : 0), 0, 1));
    parts.push({ g: chisel(displace(new THREE.IcosahedronGeometry(1, 1), .18, 1.7), 9, 13, .6, .2), m: mat4(0, .4, 0, 1.05, .62, .85, .3), cfn: cf, j: .08 });
    parts.push({ g: chisel(new THREE.IcosahedronGeometry(1, 0), 4, 14, .6), m: mat4(.95, .2, .45, .55, .45, .5, 1.1), cfn: cf, j: .08 });
    parts.push({ g: chisel(new THREE.IcosahedronGeometry(1, 0), 4, 15, .6), m: mat4(-.8, .15, -.55, .42, .35, .4, 2.3), cfn: cf, j: .08 });
    return makeGeo(parts, 13, { ao: .45 });
  },
});

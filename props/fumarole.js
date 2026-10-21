// 噴気孔（fumarole）
TDProps.add({
  id: 'fumarole', name: '噴気孔',
  r: .9, min: 2.5, sc: [.8, 1.3], slope: .8, vis: 1, anyGround: true, shape: true, light: [0xff7a2a, 14, 1.2],
  tags: ['volcano'], height: 0.88, material: 'stone',
  build() {
    const { col, mixc, mat4, displace, makeGeo } = TDGeo;
    return makeGeo([
      { g: displace(new THREE.ConeGeometry(1.0, .9, 9, 2, true), .15, 3), m: mat4(0, .45, 0, 1, 1, 1), cfn: (y, ny, Rr) => mixc(col(0x2a201b), col(0x4a3a30), Rr()), j: .1 },
      { g: new THREE.CylinderGeometry(.32, .32, .05, 9), m: mat4(0, .78, 0, 1, 1, 1), c: col(0xff8a2a), glow: 2.6 },
      { g: displace(new THREE.IcosahedronGeometry(.3, 0), .3, 6), m: mat4(.8, .1, .3, 1, .5, 1), c: col(0xd8c060), j: .1 },
    ], 82);
  },
});

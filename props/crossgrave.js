// 十字の墓（crossgrave）
TDProps.add({
  id: 'crossgrave', name: '十字の墓',
  r: .3, min: 1.2, sc: [.8, 1.2], slope: .5, vis: .5, anyGround: true,
  tags: ['graveyard'], height: 1.18,
  build() {
    const { col, mixc, mat4, displace, makeGeo } = TDGeo;
    const cf = (y, ny, R) => mixc(col(0x75716a), col(0xb0aba0), R() * .7);
    return makeGeo([
      { g: displace(new THREE.IcosahedronGeometry(.45, 1), .2, 2), m: mat4(0, 0, .25, 1, .3, 1.7), c: col(0x4a3d2c), j: .12 },
      { g: new THREE.BoxGeometry(.13, 1.15, .13), m: mat4(0, .6, -.15, 1, 1, 1, 0, 0, .05), cfn: cf },
      { g: new THREE.BoxGeometry(.6, .13, .13), m: mat4(0, .85, -.15, 1, 1, 1, 0, 0, .05), cfn: cf },
    ], 63);
  },
});

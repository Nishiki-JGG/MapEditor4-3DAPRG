// 小石（pebble）
TDProps.add({
  id: 'pebble', name: '小石',
  r: 0, min: .45, sc: [.6, 1.6], slope: 3, vis: .4, anyGround: true,
  tags: ['common'], height: 0.23, material: 'rock',
  build() {
    const { clamp, col, mixc, mat4, displace, makeGeo, chisel } = TDGeo;
    const cf = (y, ny, R, pr) => mixc(col(0x6d675e), col(0xb3ab9c), clamp(pr * .7 + (ny > .6 ? .25 : 0) + (R() - .5) * .2, 0, 1));
    return makeGeo([{ g: chisel(displace(new THREE.IcosahedronGeometry(1, 0), .3, 2.2), 3, 41, .65, .5), m: mat4(0, .1, 0, .3, .17, .24, .4), cfn: cf, j: .08 },
      { g: chisel(displace(new THREE.IcosahedronGeometry(1, 0), .3, 5.1), 3, 42, .65, .5), m: mat4(.38, .06, .2, .16, .1, .14, 1.3), cfn: cf, j: .08 }], 41);
  },
});

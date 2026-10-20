// 倒木（log）
TDProps.add({
  id: 'log', name: '倒木',
  r: .5, offs: [-1.1, 0, 1.1], min: 2.6, sc: [.8, 1.2], slope: .6, vis: 1.7,
  tags: ['grassland', 'forest', 'jungle'], height: 0.85,
  build() {
    const { col, mixc, mat4, displace, makeGeo, ribbed } = TDGeo;
    const bark = (y, ny, R) => mixc(col(0x3e2a19), col(0x6a4a2e), R());
    return makeGeo([
      { g: displace(ribbed(new THREE.CylinderGeometry(.3, .34, 3.2, 12, 3), 12, .93), .06, 3.3), m: mat4(0, .3, 0, 1, 1, 1, 0, 0, Math.PI / 2), cfn: bark, j: .1 },
      { g: new THREE.CylinderGeometry(.25, .25, .03, 9), m: mat4(1.61, .3, 0, 1, 1, 1, 0, 0, Math.PI / 2), c: col(0xc9a274), j: .05 },
      { g: new THREE.CylinderGeometry(.12, .12, .04, 7), m: mat4(1.615, .3, 0, 1, 1, 1, 0, 0, Math.PI / 2), c: col(0xa07a50), j: .05 },
      { g: new THREE.CylinderGeometry(.28, .28, .03, 9), m: mat4(-1.61, .3, 0, 1, 1, 1, 0, 0, Math.PI / 2), c: col(0xc9a274), j: .05 },
      { g: new THREE.CylinderGeometry(.13, .13, .04, 7), m: mat4(-1.615, .3, 0, 1, 1, 1, 0, 0, Math.PI / 2), c: col(0xa07a50), j: .05 },
      { g: new THREE.CylinderGeometry(.04, .07, .7, 5), m: mat4(.5, .55, .15, 1, 1, 1, 0, .6, .3), cfn: bark, j: .1 },
      { g: displace(new THREE.IcosahedronGeometry(.28, 0), .3, 1.1), m: mat4(-.6, .55, 0, 1.4, .35, 1, 0), c: col(0x4f7a2a), j: .15 },
      { g: displace(new THREE.IcosahedronGeometry(.22, 0), .3, 2.7), m: mat4(.2, .58, -.05, 1.6, .3, .9, .4), c: col(0x5f8a32), j: .15 },
    ], 43, { ao: .5 });
  },
});

// 石柱（column）
TDProps.add({
  id: 'column', name: '石柱',
  r: .5, min: 2.2, sc: [.85, 1.15], slope: .5, vis: .6, anyGround: true,
  tags: ['ruins', 'castle', 'desert'], height: 3.54,
  build() {
    const { mat4, displace, makeGeo, ribbed, RUIN_STONE, MOSS } = TDGeo;
    const cf = RUIN_STONE;
    return makeGeo([
      { g: new THREE.BoxGeometry(1, .3, 1), m: mat4(0, .15, 0, 1, 1, 1), cfn: cf, j: .06 },
      { g: new THREE.BoxGeometry(.85, .15, .85), m: mat4(0, .37, 0, 1, 1, 1), cfn: cf, j: .06 },
      { g: displace(ribbed(new THREE.CylinderGeometry(.34, .38, 2.7, 16, 4, true), 16, .9), .02, 5), m: mat4(0, 1.8, 0, 1, 1, 1), cfn: cf, j: .05 },
      { g: new THREE.CylinderGeometry(.42, .36, .14, 12), m: mat4(0, 3.1, 0, 1, 1, 1), cfn: cf, j: .05 },
      { g: new THREE.BoxGeometry(.85, .18, .85), m: mat4(0, 3.24, 0, 1, 1, 1), cfn: cf, j: .06 },
      { g: new THREE.BoxGeometry(1.05, .22, 1.05), m: mat4(0, 3.43, 0, 1, 1, 1), cfn: cf, j: .06 },
      { g: displace(new THREE.IcosahedronGeometry(.3, 0), .4, 2), m: mat4(.35, .32, .3, 1.2, .35, 1, .4), cfn: MOSS, j: .1 },
      { g: displace(new THREE.IcosahedronGeometry(.25, 0), .4, 7), m: mat4(-.2, 3.56, -.15, 1.4, .3, 1.2, .4), cfn: MOSS, j: .1 },
    ], 55, { ao: .9 });
  },
});

// 石像（statue）
TDProps.add({
  id: 'statue', name: '石像',
  r: .6, min: 2.5, sc: [.9, 1.2], slope: .4, vis: .7, anyGround: true,
  tags: ['ruins', 'castle', 'graveyard'], height: 2.95, material: 'stone',
  build() {
    const { clamp, col, mixc, mat4, displace, makeGeo } = TDGeo;
    const cf = (y, ny, R) => ny > .75 && R() < .35 ? mixc(col(0x56743a), col(0x7d9a4c), R()) : mixc(col(0x7c776e), col(0xbdb6a6), clamp(R() * .4 + y * .08, 0, 1));
    return makeGeo([
      { g: new THREE.BoxGeometry(1.1, .6, 1.1), m: mat4(0, .3, 0, 1, 1, 1), cfn: cf },
      { g: new THREE.BoxGeometry(.9, .15, .9), m: mat4(0, .67, 0, 1, 1, 1), cfn: cf },
      { g: displace(new THREE.CylinderGeometry(.26, .42, 1.5, 8, 3), .05, 3), m: mat4(0, 1.5, 0, 1, 1, 1), cfn: cf },
      { g: displace(new THREE.IcosahedronGeometry(.2, 1), .08, 5), m: mat4(0, 2.42, 0, 1, 1.1, 1), cfn: cf },
      { g: new THREE.BoxGeometry(.12, .7, .14), m: mat4(-.32, 1.75, .08, 1, 1, 1, 0, -.5, .25), cfn: cf },
      { g: new THREE.BoxGeometry(.12, .75, .14), m: mat4(.3, 1.95, 0, 1, 1, 1, 0, 0, -.2), cfn: cf },
      { g: new THREE.CylinderGeometry(.03, .03, 2.1, 5), m: mat4(.36, 1.9, 0, 1, 1, 1), cfn: cf },
    ], 59);
  },
});

// 墓石（gravestone）
TDProps.add({
  id: 'gravestone', name: '墓石',
  r: .3, min: 1.1, sc: [.8, 1.2], slope: .5, vis: .45, anyGround: true,
  tags: ['graveyard'], height: 1.13,
  build() {
    const { col, mixc, mat4, displace, makeGeo, halfDisc } = TDGeo;
    const cf = (y, ny, R) => ny > .7 && R() < .3 ? mixc(col(0x56743a), col(0x7d9a4c), R()) : mixc(col(0x6e6b66), col(0xa9a59c), R() * .7);
    return makeGeo([
      { g: new THREE.BoxGeometry(.8, .12, .5), m: mat4(0, .06, .15, 1, 1, 1), cfn: cf },
      { g: new THREE.BoxGeometry(.6, .75, .14), m: mat4(0, .45, -.05, 1, 1, 1, 0, -.06), cfn: cf },
      { g: halfDisc(.3, .14), m: mat4(0, .83, -.07, 1, 1, 1, 0, Math.PI / 2 - .06), cfn: cf },
      { g: displace(new THREE.IcosahedronGeometry(.3, 0), .3, 4), m: mat4(0, .02, .55, 1.3, .25, 1.6), c: col(0x4a3d2c), j: .1 },
    ], 62);
  },
});

// 霊廟（mausoleum）
TDProps.add({
  id: 'mausoleum', name: '霊廟',
  r: 1.5, offs: [-.7, .7], min: 4.5, sc: [.9, 1.1], slope: .3, vis: 1.9, anyGround: true,
  tags: ['graveyard'], height: 3.6, material: 'stone',
  build() {
    const { clamp, col, mixc, mat4, makeGeo, halfDisc } = TDGeo;
    const cf = (y, ny, R, pr) => ny > .7 && R() < .2 ? mixc(col(0x4e6a34), col(0x6f8c46), R()) : mixc(col(0x6c6a66), col(0xa6a29a), clamp(pr * .4 + R() * .4, 0, 1));
    return makeGeo([
      { g: new THREE.BoxGeometry(2.8, .35, 3.2), m: mat4(0, .17, 0, 1, 1, 1), cfn: cf },
      { g: new THREE.BoxGeometry(2.2, 2.0, 2.6), m: mat4(0, 1.35, 0, 1, 1, 1), cfn: cf },
      { g: new THREE.CylinderGeometry(1.62, 1.62, 3.0, 3, 1, false, Math.PI), m: mat4(0, 2.62, 0, 1, 1, .55, 0, Math.PI / 2), cfn: cf },
      { g: new THREE.BoxGeometry(.8, 1.35, .06), m: mat4(0, 1.03, 1.31, 1, 1, 1), c: col(0x1c1a18), j: .03 },
      { g: halfDisc(.4, .06), m: mat4(0, 1.7, 1.31, 1, 1, 1, 0, Math.PI / 2), c: col(0x1c1a18), j: .03 },
      { g: new THREE.CylinderGeometry(.13, .15, 2, 8), m: mat4(-.75, 1.35, 1.38, 1, 1, 1), cfn: cf },
      { g: new THREE.CylinderGeometry(.13, .15, 2, 8), m: mat4(.75, 1.35, 1.38, 1, 1, 1), cfn: cf },
      { g: new THREE.BoxGeometry(.12, .5, .12), m: mat4(0, 3.35, 0, 1, 1, 1), cfn: cf },
      { g: new THREE.BoxGeometry(.36, .1, .1), m: mat4(0, 3.45, 0, 1, 1, 1), cfn: cf },
    ], 66);
  },
});

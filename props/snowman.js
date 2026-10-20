// 雪だるま（snowman）
TDProps.add({
  id: 'snowman', name: '雪だるま',
  r: .4, min: 2, sc: [.9, 1.2], slope: .5, vis: .6, anyGround: true,
  tags: ['snow'], height: 2.1,
  build() {
    const { col, mixc, mat4, makeGeo, WOOD_C } = TDGeo;
    const sn = (y, ny, R) => mixc(col(0xe6eef7), col(0xffffff), R());
    return makeGeo([
      { g: new THREE.IcosahedronGeometry(.5, 1), m: mat4(0, .45, 0, 1, 1, 1), cfn: sn }, { g: new THREE.IcosahedronGeometry(.37, 1), m: mat4(0, 1.12, 0, 1, 1, 1), cfn: sn },
      { g: new THREE.IcosahedronGeometry(.27, 1), m: mat4(0, 1.62, 0, 1, 1, 1), cfn: sn },
      { g: new THREE.ConeGeometry(.05, .3, 6), m: mat4(0, 1.62, .38, 1, 1, 1, 0, Math.PI / 2), c: col(0xf07a20) },
      { g: new THREE.CylinderGeometry(.2, .22, .3, 8), m: mat4(0, 1.95, 0, 1, 1, 1), c: col(0x2a2a30) },
      { g: new THREE.CylinderGeometry(.015, .02, .7, 4), m: mat4(.55, 1.25, 0, 1, 1, 1, 0, 0, -1.0), cfn: WOOD_C },
      { g: new THREE.CylinderGeometry(.015, .02, .7, 4), m: mat4(-.55, 1.25, 0, 1, 1, 1, 0, 0, 1.0), cfn: WOOD_C },
    ], 86);
  },
});

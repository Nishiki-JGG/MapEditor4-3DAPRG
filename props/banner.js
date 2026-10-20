// 旗（banner）
TDProps.add({
  id: 'banner', name: '旗',
  r: .1, min: 2, sc: [.9, 1.1], slope: .6, vis: .5, anyGround: true, sway: .5,
  tags: ['castle'], height: 3.72,
  build() {
    const { col, mat4, makeGeo, WOOD_C } = TDGeo;
    return makeGeo([
      { g: new THREE.CylinderGeometry(.04, .05, 3.6, 6), m: mat4(0, 1.8, 0, 1, 1, 1), cfn: WOOD_C },
      { g: new THREE.SphereGeometry(.07, 6, 4), m: mat4(0, 3.65, 0, 1, 1, 1), c: col(0xd8b040) },
      { g: new THREE.BoxGeometry(.06, .06, .9), m: mat4(0, 3.4, .42, 1, 1, 1), cfn: WOOD_C },
      { g: new THREE.BoxGeometry(.02, 1.3, .8), m: mat4(0, 2.72, .45, 1, 1, 1), c: col(0x9a1e24), j: .05 },
      { g: new THREE.BoxGeometry(.03, .22, .22), m: mat4(.005, 2.9, .45, 1, 1, 1, 0, Math.PI / 4), c: col(0xe0b840), j: .05 },
    ], 91);
  },
});

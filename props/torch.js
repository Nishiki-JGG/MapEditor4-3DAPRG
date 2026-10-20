// 松明（torch）
TDProps.add({
  id: 'torch', name: '松明',
  r: .15, min: 2, sc: [1, 1], slope: .8, vis: .3, anyGround: true, light: [0xff9a40, 26, 1.9],
  tags: ['cave', 'castle', 'ruins', 'graveyard'], height: 2.07,
  build() {
    const { col, mixc, mat4, makeGeo } = TDGeo;
    const wood = (y, ny, R) => mixc(col(0x3e2a19), col(0x6a4a2e), R());
    return makeGeo([
      { g: new THREE.CylinderGeometry(.06, .08, 1.5, 6), m: mat4(0, .75, 0, 1, 1, 1), cfn: wood, j: .1 },
      { g: new THREE.CylinderGeometry(.13, .07, .22, 7), m: mat4(0, 1.58, 0, 1, 1, 1), c: col(0x2e2a26), j: .05 },
      { g: new THREE.ConeGeometry(.12, .42, 7), m: mat4(0, 1.86, 0, 1, 1, 1), c: col(0xffa030), glow: 2.6, j: .1 },
      { g: new THREE.ConeGeometry(.06, .28, 6), m: mat4(0, 1.9, 0, 1, 1, 1), c: col(0xfff0a0), glow: 3, j: .05 },
    ], 54);
  },
});

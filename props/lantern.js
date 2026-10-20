// ランタン（lantern）
TDProps.add({
  id: 'lantern', name: 'ランタン',
  r: .15, min: 2.5, sc: [1, 1], slope: .6, vis: .4, anyGround: true, light: [0xffc070, 20, 1.6],
  tags: ['graveyard', 'castle'], height: 1.9,
  build() {
    const { col, mixc, mat4, makeGeo } = TDGeo;
    const iron = (y, ny, R) => mixc(col(0x23252a), col(0x3e4148), R());
    return makeGeo([
      { g: new THREE.CylinderGeometry(.06, .08, 1.9, 6), m: mat4(0, .95, 0, 1, 1, 1), cfn: iron },
      { g: new THREE.BoxGeometry(.5, .05, .05), m: mat4(.22, 1.85, 0, 1, 1, 1), cfn: iron },
      { g: new THREE.BoxGeometry(.2, .26, .2), m: mat4(.42, 1.6, 0, 1, 1, 1), c: col(0xffd27a), glow: 2.2, j: .05 },
      { g: new THREE.ConeGeometry(.17, .14, 4), m: mat4(.42, 1.8, 0, 1, 1, 1, Math.PI / 4), cfn: iron },
    ], 65);
  },
});

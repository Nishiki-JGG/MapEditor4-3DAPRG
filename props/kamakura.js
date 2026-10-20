// かまくら（kamakura）
TDProps.add({
  id: 'kamakura', name: 'かまくら',
  r: 1.3, min: 4, sc: [.9, 1.1], slope: .3, vis: 1.5, anyGround: true, light: [0xffb060, 10, .4],
  tags: ['snow'], height: 1.19,
  build() {
    const { col, mixc, mat4, makeGeo } = TDGeo;
    const sn = (y, ny, R) => mixc(col(0xdce6f0), col(0xffffff), R());
    return makeGeo([
      { g: new THREE.SphereGeometry(1.4, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), m: mat4(0, 0, 0, 1, .85, 1), cfn: sn, j: .05 },
      { g: new THREE.CylinderGeometry(.5, .5, .5, 10, 1, false, Math.PI / 2, Math.PI), m: mat4(0, .45, 1.3, 1, 1, 1, 0, Math.PI / 2), c: col(0x101418) },
      { g: new THREE.BoxGeometry(1.0, .45, .4), m: mat4(0, .22, 1.3, 1, 1, 1), c: col(0x101418) },
      { g: new THREE.BoxGeometry(.2, .2, .2), m: mat4(.2, .15, .6, 1, 1, 1), c: col(0xffb860), glow: 2.4 },
    ], 87);
  },
});

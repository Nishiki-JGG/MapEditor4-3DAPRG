// オベリスク（obelisk）
TDProps.add({
  id: 'obelisk', name: 'オベリスク',
  r: .5, min: 2.5, sc: [.9, 1.2], slope: .5, vis: .6, anyGround: true,
  tags: ['desert', 'ruins'], height: 4.95,
  build() {
    const { col, mat4, makeGeo, SANDSTONE } = TDGeo;
    const r = .3 * Math.SQRT2;
    return makeGeo([
      { g: new THREE.BoxGeometry(1.1, .4, 1.1), m: mat4(0, .2, 0, 1, 1, 1), cfn: SANDSTONE },
      { g: new THREE.CylinderGeometry(r * .75, r, 4, 4), m: mat4(0, 2.4, 0, 1, 1, 1, Math.PI / 4), cfn: SANDSTONE, j: .05 },
      { g: new THREE.ConeGeometry(r * .75, .55, 4), m: mat4(0, 4.67, 0, 1, 1, 1, Math.PI / 4), c: col(0xe8c460), j: .05 },
      { g: new THREE.BoxGeometry(.12, 2.8, .02), m: mat4(0, 2.3, .29, 1, 1, 1, 0, -.02), c: col(0x6a4e2a), j: .05 },
    ], 77);
  },
});

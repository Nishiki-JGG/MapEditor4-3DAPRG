// 松明（torch）
TDProps.add({
  id: 'torch', name: '松明',
  r: .15, min: 2, sc: [1, 1], slope: .8, vis: .3, anyGround: true, light: [0xff9a40, 26, 1.9],
  tags: ['cave', 'castle', 'ruins', 'graveyard'], height: 2.07, material: 'cards2',
  build() {
    const { col, mixc, mat4, displace, makeGeo, ATLAS2 } = TDGeo;
    // a rough wooden pole (atlas 2 wood) with an iron cup bound in rope, a layered flame and charred wrap
    const wood = (y, ny, R, pr) => mixc(col(0xd8c4ac), col(0xf0e0cc), pr);
    return makeGeo([
      { g: displace(new THREE.CylinderGeometry(.055, .075, 1.5, 7, 3), .05, 2), m: mat4(0, .75, 0, 1, 1, 1), cfn: wood, uvr: ATLAS2.uvr('wood'), j: .05 },
      { g: new THREE.TorusGeometry(.07, .015, 4, 10), m: mat4(0, 1.32, 0, 1, 1, 1, 0, Math.PI / 2), c: col(0x8a7450) },
      { g: new THREE.TorusGeometry(.068, .015, 4, 10), m: mat4(0, 1.38, 0, 1, 1, 1, 0, Math.PI / 2), c: col(0x8a7450) },
      { g: new THREE.CylinderGeometry(.13, .07, .22, 8, 1, true), m: mat4(0, 1.58, 0, 1, 1, 1), c: col(0x2e2a26), j: .05 },
      { g: displace(new THREE.CylinderGeometry(.11, .11, .08, 8), .2, 3), m: mat4(0, 1.66, 0, 1, 1, 1), c: col(0x1a1410), j: .1 },
      { g: new THREE.ConeGeometry(.13, .46, 8), m: mat4(0, 1.88, 0, 1, 1, 1), c: col(0xff8a20), glow: 2.6, j: .1 },
      { g: new THREE.ConeGeometry(.08, .34, 7), m: mat4(.02, 1.9, .01, 1, 1, 1), c: col(0xffc040), glow: 3, j: .05 },
      { g: new THREE.ConeGeometry(.04, .2, 6), m: mat4(0, 1.86, 0, 1, 1, 1), c: col(0xfff6c8), glow: 3.4, j: .03 },
    ], 54, { uv: ATLAS2.white });
  },
});

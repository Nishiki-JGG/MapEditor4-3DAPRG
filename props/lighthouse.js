// 灯台（lighthouse）
TDProps.add({
  id: 'lighthouse', name: '灯台',
  r: 1.5, min: 6, sc: [.9, 1.1], slope: .4, vis: 1.8, anyGround: true, light: [0xfff0c0, 60, 7.5],
  tags: ['beach'], height: 8.48,
  build() {
    const { col, mixc, mat4, displace, makeGeo } = TDGeo;
    const parts = [], white = (y, ny, R) => mixc(col(0xe9e6e0), col(0xffffff), R() * .5), red = (y, ny, R) => mixc(col(0xa8302a), col(0xc8443a), R());
    parts.push({ g: displace(new THREE.CylinderGeometry(1.6, 1.8, .6, 10), .08, 2), m: mat4(0, .3, 0, 1, 1, 1), c: col(0x8a857c) });
    for (let k = 0; k < 4; k++) { const y0 = .6 + k * 1.6, r0 = 1.15 - k * .14, r1 = r0 - .14; parts.push({ g: new THREE.CylinderGeometry(r1, r0, 1.6, 14), m: mat4(0, y0 + .8, 0, 1, 1, 1), cfn: k % 2 ? red : white, j: .04 }); }
    parts.push({ g: new THREE.CylinderGeometry(.85, .85, .12, 14), m: mat4(0, 7.06, 0, 1, 1, 1), c: col(0x2c2c30) });
    parts.push({ g: new THREE.CylinderGeometry(.5, .5, .8, 10), m: mat4(0, 7.52, 0, 1, 1, 1), c: col(0xfff2b8), glow: 2.4 });
    parts.push({ g: new THREE.ConeGeometry(.65, .55, 10), m: mat4(0, 8.2, 0, 1, 1, 1), cfn: red });
    parts.push({ g: new THREE.BoxGeometry(.4, .7, .06), m: mat4(0, 1.0, 1.12, 1, 1, 1), c: col(0x3a2a1e) });
    return makeGeo(parts, 75);
  },
});

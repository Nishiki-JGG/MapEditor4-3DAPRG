// 塔（tower）
TDProps.add({
  id: 'tower', name: '塔',
  r: 1.3, min: 4, sc: [.9, 1.15], slope: .4, vis: 1.3, anyGround: true,
  tags: ['castle'], height: 7.45,
  build() {
    const { col, mixc, mat4, displace, makeGeo, masonC, CASTLE_C } = TDGeo;
    const parts = [], cf = masonC(0x5e5c57, 0xa8a59c, 5 / 12, 12);
    parts.push({ g: displace(new THREE.CylinderGeometry(1.1, 1.25, 5, 12, 12, true), .015, 3), m: mat4(0, 2.5, 0, 1, 1, 1), cfn: cf, j: .05 });
    parts.push({ g: new THREE.CylinderGeometry(1.3, 1.15, .3, 12), m: mat4(0, 5.15, 0, 1, 1, 1), cfn: CASTLE_C });
    for (let k = 0; k < 8; k++) { const a = k / 8 * 6.283; parts.push({ g: new THREE.BoxGeometry(.4, .45, .35), m: mat4(Math.cos(a) * 1.18, 5.52, Math.sin(a) * 1.18, 1, 1, 1, -a), cfn: CASTLE_C }); }
    parts.push({ g: new THREE.ConeGeometry(1.15, 1.9, 12), m: mat4(0, 6.5, 0, 1, 1, 1), cfn: (y, ny, R) => mixc(col(0x2e3648), col(0x46526a), (Math.floor(y * 3) % 2 ? .7 : .2) + R() * .2), j: .05 });
    for (const [y, a] of [[2.2, .6], [3.6, 2.4], [3.0, 4.2]]) parts.push({ g: new THREE.BoxGeometry(.12, .5, .1), m: mat4(Math.cos(a) * 1.16, y, Math.sin(a) * 1.16, 1, 1, 1, -a + Math.PI / 2), c: col(0x14120f) });
    parts.push({ g: new THREE.BoxGeometry(.7, 1.1, .2), m: mat4(0, .55, 1.2, 1, 1, 1), c: col(0x3a2a1e) });   // door
    parts.push({ g: displace(new THREE.IcosahedronGeometry(.4, 0), .4, 4), m: mat4(-.9, .1, .7, 1.4, .35, 1, .3), c: col(0x4e6a34), j: .1 });
    return makeGeo(parts, 89, { ao: .9 });
  },
});

// サボテン（cactus）
TDProps.add({
  id: 'cactus', name: 'サボテン',
  r: .3, min: 1.8, sc: [.7, 1.3], slope: .7, vis: .8, anyGround: true,
  tags: ['desert', 'wasteland', 'canyon'], height: 2.82,
  build() {
    const { clamp, col, mixc, mat4, makeGeo, petalGeo, basisAt, ribbed } = TDGeo;
    const g = (y, ny, R) => mixc(col(0x4a8a42), col(0x7cb864), clamp(R() * .6 + (ny > .5 ? .3 : 0), 0, 1));
    const parts = [{ g: ribbed(new THREE.CylinderGeometry(.22, .25, 2.6, 12, 2, true), 12, .8), m: mat4(0, 1.3, 0, 1, 1, 1), cfn: g, j: .06 },
      { g: ribbed(new THREE.SphereGeometry(.22, 12, 3, 0, Math.PI * 2, 0, Math.PI / 2), 12, .8), m: mat4(0, 2.6, 0, 1, 1, 1), cfn: g }];
    for (const [sx, y0, h] of [[1, 1.0, .9], [-1, 1.35, .7]]) {
      parts.push({ g: ribbed(new THREE.CylinderGeometry(.13, .13, .5, 8, 1, true), 8, .82), m: mat4(sx * .38, y0, 0, 1, 1, 1, 0, 0, Math.PI / 2), cfn: g });
      parts.push({ g: new THREE.IcosahedronGeometry(.14, 0), m: mat4(sx * .6, y0, 0, 1, 1, 1), cfn: g });
      parts.push({ g: ribbed(new THREE.CylinderGeometry(.14, .14, h, 8, 1, true), 8, .82), m: mat4(sx * .6, y0 + h / 2 - .05, 0, 1, 1, 1), cfn: g });
      parts.push({ g: ribbed(new THREE.SphereGeometry(.14, 8, 2, 0, Math.PI * 2, 0, Math.PI / 2), 8, .82), m: mat4(sx * .6, y0 + h - .05, 0, 1, 1, 1), cfn: g });
    }
    for (let q = 0; q < 5; q++) { const a = q * 1.2566; parts.push({ g: petalGeo(.1, .07, .55), m: basisAt([.05, 2.8, .05], [Math.cos(a), .5, Math.sin(a)]), c: col(0xf0709a), j: .05 }); }
    return makeGeo(parts, 78, { ao: .8 });
  },
});

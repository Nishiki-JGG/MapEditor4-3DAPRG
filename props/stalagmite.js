// 石筍（stalagmite）
TDProps.add({
  id: 'stalagmite', name: '石筍',
  r: .9, min: 1.6, sc: [.7, 1.4], slope: 1.2, vis: 1, anyGround: true,
  tags: ['cave', 'volcano', 'mountain'], height: 2.29, material: 'stone',
  build() {
    const { clamp, col, mixc, mat4, displace, makeGeo, chisel } = TDGeo;
    const cf = (y, ny, R) => mixc(col(0x5a5650), col(0xa8a092), clamp(.25 + y * .16 + (Math.floor(y * 3.3) % 2 ? .1 : -.05) + (R() - .5) * .25, 0, 1));
    const parts = [];
    [[0, 0, 2.4, .5], [.55, .2, 1.4, .32], [-.4, .35, 1.0, .26], [.15, -.5, .8, .22]].forEach(([x, z, h, r], k) =>
      parts.push({ g: displace(new THREE.ConeGeometry(r, h, 7, 4), .18, k * 2.3), m: mat4(x, h / 2 - .05, z, 1, 1, 1, k), cfn: cf, j: .08 }));
    parts.push({ g: chisel(displace(new THREE.CylinderGeometry(.9, 1.05, .25, 9), .2, 9), 3, 51, .8), m: mat4(0, .05, 0, 1, 1, 1), cfn: cf, j: .1 });
    return makeGeo(parts, 51, { ao: .9 });
  },
});

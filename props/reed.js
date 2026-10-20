// 葦（reed）
TDProps.add({
  id: 'reed', name: '葦',
  r: 0, min: .7, sc: [.8, 1.3], slope: .7, vis: .5, anyGround: true,
  sway: 1, tags: ['grassland', 'forest', 'jungle', 'beach'], height: 1.72, material: 'foliage',
  build() {
    const { clamp, rng, col, mixc, mat4, makeGeo, stripLeafGeo, basisAt, limb } = TDGeo;
    const R = rng(42), parts = [];
    const blade = (y, ny, Rr) => mixc(col(0x4a7426), col(0x8aa848), clamp(y * .5 + (Rr() - .5) * .3, 0, 1));
    for (let k = 0; k < 9; k++) {
      const a = R() * 6.283, h = .9 + R() * .7;
      parts.push({ g: stripLeafGeo(h, .07, 3, 1.35 - R() * .15, .7 + R() * .5, 0, .4), m: basisAt([Math.cos(a) * R() * .2, 0, Math.sin(a) * R() * .2], [Math.cos(a), 0, Math.sin(a)], [0, 1, 0]), cfn: blade, j: .1, sn: [0, -.3, 0], snw: .4 });
    }
    for (let k = 0; k < 5; k++) {
      const a = R() * 6.283, r = R() * .28, x = Math.cos(a) * r, z = Math.sin(a) * r, h = 1.15 + R() * .55, lx = x + (R() - .5) * .15, lz = z + (R() - .5) * .15;
      limb(parts, [x, 0, z], [lx, h, lz], .014, .01, 3, () => col(0x6a8a34));
      parts.push({ g: new THREE.CylinderGeometry(.04, .045, .22, 6), m: mat4(lx, h - .12, lz, 1, 1, 1), c: col(0x5a3a1e), j: .1 });
      limb(parts, [lx, h - .01, lz], [lx, h + .12, lz], .008, .004, 3, () => col(0x8a7a50));
    }
    return makeGeo(parts, 42, { ao: .5 });
  },
});

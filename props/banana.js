// バナナの木（banana）
TDProps.add({
  id: 'banana', name: 'バナナの木',
  r: .3, min: 2.6, sc: [.8, 1.2], slope: .7, vis: 1.6, tree: true, sway: 1,
  tags: ['jungle'], height: 2.97, material: 'foliage', canopy: true,
  build() {
    const { clamp, rng, col, mixc, mat4, makeGeo, stripLeafGeo, basisAt, limb } = TDGeo;
    const R = rng(97), parts = [], st = (y, ny, Rr) => mixc(col(0x5a6a2c), col(0x8a9a4a), Rr());
    const leaf = (y, ny, Rr, pr) => mixc(col(0x3a8a2c), col(0x86c050), clamp(pr * .6 + Rr() * .25, 0, 1));
    limb(parts, [0, -.05, 0], [0, 2.35, 0], .22, .15, 8, st);
    for (let k = 0; k < 7; k++) {
      const a = k / 7 * 6.283 + R() * .4;
      parts.push({ g: stripLeafGeo(1.7 + R() * .4, .62, 4, .55, 1.35 + R() * .4, .14, .6), m: basisAt([0, 2.2 + R() * .2, 0], [Math.cos(a), 0, Math.sin(a)], [0, 1, 0]), cfn: leaf, j: .08, sn: [0, 1.6, 0], snw: .55 });
    }
    for (let k = 0; k < 6; k++) parts.push({ g: new THREE.CylinderGeometry(.03, .04, .22, 5, 1, true), m: mat4(.2 + Math.cos(k) * .06, 1.9 - k * .05, Math.sin(k) * .06, 1, 1, 1, 0, .3, -.5), c: col(0xd8c040) });
    parts.push({ g: new THREE.ConeGeometry(.07, .2, 6), m: mat4(.24, 1.55, 0, 1, 1, 1, 0, 0, Math.PI), c: col(0x7a2a4a) });
    return makeGeo(parts, 97, { ao: 1 });
  },
});

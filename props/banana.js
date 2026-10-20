// バナナの木（banana）
TDProps.add({
  id: 'banana', name: 'バナナの木',
  r: .3, min: 2.6, sc: [.8, 1.2], slope: .7, vis: 1.6, tree: true, sway: 1,
  tags: ['jungle'], height: 2.97, material: 'cards', canopy: true,
  build() {
    const { rng, col, mixc, makeGeo, limb, basisAt, stripGeo, ATLAS } = TDGeo;
    // a green pseudo-stem with broad torn leaves (atlas: banana), a hanging bunch and a purple bud
    const R = rng(97), parts = [], st = (y, ny, Rr) => mixc(col(0x5a6a2c), col(0x8a9a4a), Rr());
    limb(parts, [0, -.05, 0], [0, 2.25, 0], .22, .15, 8, st);
    const leaf = (y, ny, Rr, pr) => mixc(col(0xb8d098), col(0xe0ecc0), pr);
    for (let k = 0; k < 7; k++) {
      const a = k / 7 * 6.283 + R() * .4;
      parts.push({ g: stripGeo(1.8 + R() * .35, .78, 6, .75 + R() * .2, 1.55 + R() * .35, .15, .18), m: basisAt([0, 2.15 + R() * .15, 0], [Math.cos(a), 0, Math.sin(a)], [0, 1, 0]), cfn: leaf, uvr: ATLAS.uvr('banana'), j: .05, sn: [0, 1.5, 0], snw: .55 });
    }
    for (let k = 0; k < 6; k++) parts.push({ g: new THREE.CylinderGeometry(.03, .04, .22, 5, 1, true), m: new THREE.Matrix4().compose(new THREE.Vector3(.2 + Math.cos(k) * .06, 1.9 - k * .05, Math.sin(k) * .06), new THREE.Quaternion().setFromEuler(new THREE.Euler(.3, 0, -.5)), new THREE.Vector3(1, 1, 1)), c: col(0xd8c040) });
    parts.push({ g: new THREE.ConeGeometry(.07, .2, 6), m: new THREE.Matrix4().compose(new THREE.Vector3(.24, 1.55, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI)), new THREE.Vector3(1, 1, 1)), c: col(0x7a2a4a) });
    return makeGeo(parts, 97, { ao: 1, uv: ATLAS.white });
  },
});

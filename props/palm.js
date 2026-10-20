// ヤシ（palm）
TDProps.add({
  id: 'palm', name: 'ヤシ',
  r: .35, min: 2.6, sc: [.8, 1.25], slope: .7, vis: 2, anyGround: true, sway: 1,
  tags: ['beach', 'jungle'], height: 4.77, material: 'cards', canopy: true,
  build() {
    const { rng, col, mixc, makeGeo, limb, basisAt, stripGeo, ATLAS } = TDGeo;
    // a leaning ringed trunk; the crown is pinnate fronds on bent strips, the oldest ones hanging and drying
    const R = rng(71), parts = [];
    const bark = (y, ny, Rr) => mixc(col(0xa08a6e), col(0xc0a886), Rr());
    let x = 0, y = 0;
    for (let k = 0; k < 8; k++) { const h = .58, bend = k * .065; limb(parts, [x, y - .04, 0], [x + Math.sin(bend) * (h + .04), y + Math.cos(bend) * (h + .04), 0], .17 - k * .009, .13 - k * .009, 7, bark, { uvr: ATLAS.uvr('bark'), j: .08 }); x += Math.sin(bend) * h; y += Math.cos(bend) * h; }
    const C = [x, y - .5, 0], green = (yy, ny, Rr, pr) => mixc(col(0xa8c27c), col(0xd2e0a0), pr), dry = (yy, ny, Rr, pr) => mixc(col(0xb89a64), col(0xd4b880), pr);
    for (let f = 0; f < 13; f++) {
      const old = f >= 10, a = f / 10 * 6.283 + R() * .3, L = old ? 1.9 : 2.2 + R() * .5;
      parts.push({ g: stripGeo(L, old ? .7 : 1.05, 7, old ? -.3 : .55 + R() * .2, old ? 1.4 : 1.7 + R() * .3, .35, .25), m: basisAt([x, y, 0], [Math.cos(a), 0, Math.sin(a)], [0, 1, 0]), cfn: old ? dry : green, uvr: ATLAS.uvr('palm'), j: .06, sn: C, snw: .6 });
    }
    for (let k = 0; k < 4; k++) parts.push({ g: new THREE.IcosahedronGeometry(.12, 0), m: new THREE.Matrix4().makeTranslation(x + Math.cos(k * 1.7) * .17, y - .16, Math.sin(k * 1.7) * .17), c: col(0x6a4a24), j: .1 });
    return makeGeo(parts, 71, { ao: 1.2, uv: ATLAS.white });
  },
});

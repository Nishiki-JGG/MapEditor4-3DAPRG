// 花（flowers）
TDProps.add({
  id: 'flowers', name: '花',
  r: 0, min: .6, sc: [.8, 1.4], slope: .8, vis: .45,
  sway: .8, tags: ['grassland', 'forest', 'ruins'], height: 0.43, touch: true, material: 'cards2',
  build() {
    const { rng, col, mixc, makeGeo, quadGeo, crossGeo, faceOut, limb, ATLAS2 } = TDGeo;
    // a clump of wild flowers (atlas 2: daisy, buttercup, cosmos, bellflower) over a rosette of lance leaves
    const R = rng(46), parts = [], kinds = ['flower0', 'flower1', 'flower2', 'flower3'];
    const leaf = (y, ny, Rr, pr) => mixc(col(0xa8c088), col(0xdce8bc), pr);
    parts.push({g:TDPlantShapes.grass(7,.16,.28),m:new THREE.Matrix4(),c:col(0x73994d),j:.04});
    const main = kinds[(R() * 4) | 0], other = kinds[(R() * 4) | 0];
    for (let k = 0; k < 8; k++) {
      const a = R() * 6.283, d = .05 + R() * .24, x = Math.cos(a) * d, z = Math.sin(a) * d, h = .18 + R() * .25;
      limb(parts, [x * .3, 0, z * .3], [x, h, z], .01, .007, 3, () => col(0x557a30));
      parts.push({ g: quadGeo(1, 1), m: faceOut([x, h + .005, z], [x * 1.2, 1, z * 1.2], [Math.cos(a), 0, Math.sin(a)], .14 + R() * .06, R() * 6.28), c: col(0xffffff), uvr: ATLAS2.uvr(R() < .7 ? main : other), j: .04, sn: [x, h - .4, z], snw: .4 });
    }
    return makeGeo(parts, 46, { uv: ATLAS2.white });
  },
});

// 茂み（bush）
TDProps.add({
  id: 'bush', name: '茂み',
  r: 0, min: 1.0, sc: [.7, 1.5], slope: .8, vis: .9,
  sway: .5, tags: ['grassland', 'forest', 'jungle', 'canyon', 'ruins', 'castle', 'beach'], height: 0.93, material: 'foliage',
  build() {
    const { clamp, rng, col, mixc, mat4, displace, makeGeo, leafGeo, basisAt } = TDGeo;
    const R = rng(14), parts = [], C = [0, .3, 0];
    const leaf = (y, ny, Rr, pr) => mixc(col(0x2c5e22), col(0x6aa63c), clamp(y * 1.2 + (Rr() - .5) * .4, 0, 1));
    [[0, .42, 0, .62], [.45, .3, .25, .45], [-.42, .3, -.18, .46]].forEach(([x, y, z, r], k) => parts.push({ g: displace(new THREE.IcosahedronGeometry(1, 0), .25, k * 5.3), m: mat4(x, y, z, r, r * .8, r, k), cfn: leaf, j: .1, sn: C, snw: .85 }));
    for (let k = 0; k < 26; k++) {
      const th = R() * 6.283, ph = .25 + R() * 1.35, d = [Math.cos(th) * Math.sin(ph), Math.cos(ph), Math.sin(th) * Math.sin(ph)];
      const p = [d[0] * .6, .32 + d[1] * .42, d[2] * .55];
      parts.push({ g: leafGeo(.34, .22, .25, .05), m: basisAt(p, [d[0], d[1] * .3 - .1, d[2]], [0, 1, 0], .8 + R() * .5), cfn: leaf, j: .12, sn: C, snw: .7 });
    }
    for (let k = 0; k < 4; k++) { const th = k * 1.7 + R(), p = [Math.cos(th) * .48, .55 + R() * .25, Math.sin(th) * .44]; parts.push({ g: new THREE.OctahedronGeometry(.045, 0), m: mat4(...p, 1, .8, 1), c: R() < .5 ? col(0xf4f0e0) : col(0xd04040), j: .05 }); }
    return makeGeo(parts, 14, { ao: .55 });
  },
});

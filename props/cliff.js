// 崖石（cliff）
TDProps.add({
  id: 'cliff', name: '崖石',
  r: .6, offs: [-.8, 0, .8], min: 1.0, sc: [.9, 1.2], slope: 9, vis: 1.25, anyGround: true,
  tags: ['common'], height: 2.36, material: 'rock',
  build() {
    const { clamp, hash2, rng, col, mixc, mat4, displace, makeGeo, chisel, strata, dropBottom } = TDGeo;
    // angular rock columns with horizontal strata; grass and moss on the tops
    const R = rng(77), parts = [];
    const cf = (y, ny, Rr, pr) => ny > .7 ? mixc(col(0x8a8274), col(0xa29a8a), pr)
      : mixc(col(0x6e665b), col(0xcfc5b0), clamp(.35 + y * .12 + (hash2(Math.floor(y / .44 + .5), 3) - .5) * .4 + (Rr() - .5) * .22 + (ny < -.2 ? -.2 : 0), 0, 1));
    let x = -1.15, k = 0;
    while (x < 1.1) {
      const w = .62 + R() * .5, h = 1.9 + R() * .55, d = .8 + R() * .4;
      const g = dropBottom(chisel(strata(displace(new THREE.CylinderGeometry(w * .5, w * .62, h, 5, 2), .12, x * 9.1), .16, k), 4, 300 + k++, .78, .5));   // rough five-sided column, 25 triangles
      g.scale(1, 1, d / w);
      parts.push({ g, m: mat4(x + w / 2, h / 2 - .1, (R() - .5) * .3, 1, 1, 1, (R() - .5) * .5, (R() - .5) * .08, (R() - .5) * .08), cfn: cf, j: .08 });
      if (R() < .12) {
        const h2 = .2 + R() * .25, g2 = chisel(new THREE.IcosahedronGeometry(.5, 0), 3, 400 + k, .7, .3).scale(w * .9, h2 * 1.4, d * .8);
        parts.push({ g: g2, m: mat4(x + w / 2 + (R() - .5) * .1, h + h2 / 2 - .12, (R() - .5) * .2, 1, 1, 1, (R() - .5) * .4), cfn: cf, j: .1 });
      }
      x += w * .92;
    }
    return makeGeo(parts, 15, { ao: 1.1, smooth: 50 });
  },
});

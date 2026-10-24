// 打ち上げられた海藻（wrack）：満ち潮が残した線。もつれた黒っぽいオリーブ色の海藻の帯に、小枝と殻のかけらが混じる（参考：海藻の打ち上げ線の写真）
TDProps.add({
  id: 'wrack', name: '打ち上げられた海藻',
  r: 0, min: .9, sc: [.9, 1.3], slope: .5, vis: .9, anyGround: true, shore: [.3, .65], groundSink: .003,
  tags: ['beach'], height: .03,
  build() {
    const { rng, col, mixc, mat4, makeGeo } = TDGeo;
    const R = rng(87), parts = [], weed = (y, ny, Rr) => mixc(col(0x2f2c16), col(0x5d5428), Rr() * .8), dry = (y, ny, Rr) => mixc(col(0x6b5f3c), col(0x8f8158), Rr());
    // ribbons of weed: short flat pieces following a wandering curve, lying along the line (x) and tangled over each other
    for (let k = 0; k < 30; k++) {
      let x = (R() - .5) * 1.5, z = (R() - .5) * .3, a = (R() - .5) * 1.2;
      const n = 4 + ((R() * 5) | 0), w = .012 + R() * .018, seg = .1 + R() * .08, cf = R() < .25 ? dry : weed;
      for (let s = 0; s < n; s++) {
        a += (R() - .5) * .5; const dx = Math.cos(a) * seg, dz = Math.sin(a) * seg;
        parts.push({ g: new THREE.BoxGeometry(seg * 1.1, .005, w), m: mat4(x + dx / 2, .003 + k * .0006, z + dz / 2, 1, 1, 1, -a), cfn: cf, j: .12 });
        x += dx; z += dz;
      }
    }
    // a few twigs and bits of shell caught in it
    for (let k = 0; k < 3; k++) parts.push({ g: new THREE.CylinderGeometry(.006, .008, .18 + R() * .2, 4), m: mat4((R() - .5) * 1.2, .008, (R() - .5) * .16, 1, 1, 1, R() * 3, 0, Math.PI / 2), cfn: (y, ny, Rr) => mixc(col(0x8a7356), col(0xb7a283), Rr()), j: .1 });
    for (let k = 0; k < 8; k++) parts.push({ g: new THREE.IcosahedronGeometry(1, 0), m: mat4((R() - .5) * 1.4, .005, (R() - .5) * .26, .016, .005, .012, R() * 6), c: col(0xf0e6d6), j: .08 });
    return makeGeo(parts, 87);
  },
});

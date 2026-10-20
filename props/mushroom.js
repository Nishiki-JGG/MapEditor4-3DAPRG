// きのこ（mushroom）
TDProps.add({
  id: 'mushroom', name: 'きのこ',
  r: 0, min: .5, sc: [.8, 1.5], slope: .9, vis: .3, anyGround: true,
  tags: ['forest', 'jungle', 'cave', 'demon', 'graveyard'], height: 0.23,
  build() {
    const { rng, col, mat4, makeGeo } = TDGeo;
    const R = rng(47), parts = [];
    for (let k = 0; k < 4; k++) {
      const x = (R() - .5) * .45, z = (R() - .5) * .45, h = .1 + R() * .14, r = .06 + R() * .07, red = R() < .5;
      parts.push({ g: new THREE.CylinderGeometry(r * .3, r * .4, h, 5, 1, true), m: mat4(x, h / 2, z, 1, 1, 1), c: col(0xe8ddc8) });
      parts.push({ g: new THREE.SphereGeometry(r, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2), m: mat4(x, h - .01, z, 1, .8, 1), c: red ? col(0xc8402e) : col(0x9a6a3e), j: .08 });
      parts.push({ g: new THREE.CircleGeometry(r * .97, 7), m: mat4(x, h - .012, z, 1, 1, 1, 0, Math.PI / 2), c: col(0xd9c9a8), j: .05 });   // gills, seen from below
      if (red) for (let s = 0; s < 3; s++) { const a = s * 2.1 + R(), e = .55 + R() * .2; parts.push({ g: new THREE.OctahedronGeometry(r * .16, 0), m: mat4(x + Math.cos(a) * r * e, h - .01 + r * .8 * Math.sqrt(1 - e * e) + .004, z + Math.sin(a) * r * e, 1, .4, 1), c: col(0xf6f0e4), j: .03 }); }
    }
    return makeGeo(parts, 47);
  },
});

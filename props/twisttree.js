// 異形の木（twisttree）
TDProps.add({
  id: 'twisttree', name: '異形の木',
  r: .35, min: 2.4, sc: [.8, 1.3], slope: .8, vis: 1.3, anyGround: true, light: [0xb050ff, 6, 2.5],
  tags: ['demon', 'graveyard'], height: 4.06,
  build() {
    const { rng, col, mat4, makeGeo, DARK_C } = TDGeo;
    const R = rng(92), parts = [];
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < 7; k++) { const h = .55, ax = Math.sin(k * 1.3) * .35, az = Math.cos(k * 1.7) * .35; parts.push({ g: new THREE.CylinderGeometry(.16 - k * .016, .2 - k * .016, h + .08, 6), m: mat4(x, y + h / 2, z, 1, 1, 1, k, ax, az), cfn: DARK_C, j: .1 }); x += Math.sin(az) * -h * .5; z += Math.sin(ax) * h * .5; y += h * .95; }
    for (let k = 0; k < 6; k++) { const a = k * 1.05 + R(), L = .8 + R() * .7, y0 = 1.6 + R() * 2.2; parts.push({ g: new THREE.CylinderGeometry(.02, .06, L, 5), m: mat4(x * .6 + Math.cos(a) * L * .4, y0 + L * .2, z * .6 + Math.sin(a) * L * .4, 1, 1, 1, -a, 0, -Math.PI / 2.6), cfn: DARK_C });
      parts.push({ g: new THREE.IcosahedronGeometry(.09, 0), m: mat4(x * .6 + Math.cos(a) * L * .8, y0 + L * .32, z * .6 + Math.sin(a) * L * .8, 1, 1.2, 1), c: col(0xc050ff), glow: 2.2 }); }
    return makeGeo(parts, 92);
  },
});

// 溶岩岩（lavarock）
TDProps.add({
  id: 'lavarock', name: '溶岩岩',
  r: .7, min: 1.8, sc: [.6, 1.6], slope: 2, vis: 1, anyGround: true, shape: true, light: [0xff6a20, 8, .9],
  tags: ['volcano', 'demon'], height: 0.82, material: 'stone',
  build() {
    const { clamp, rng, col, mixc, mat4, displace, makeGeo, chisel } = TDGeo;
    const R = rng(81), parts = [{ g: chisel(displace(new THREE.IcosahedronGeometry(.8, 1), .25, 4), 7, 81, .62, .2), m: mat4(0, .35, 0, 1.1, .62, .95, .3), cfn: (y, ny, Rr) => mixc(col(0x17120f), col(0x3a2e27), clamp(Rr() * .7 + (ny > .6 ? .3 : 0), 0, 1)), j: .1 }];
    for (let k = 0; k < 4; k++) parts.push({ g: new THREE.BoxGeometry(.7 + R() * .5, .03, .05), m: mat4((R() - .5) * .6, .72 + R() * .05, (R() - .5) * .6, 1, 1, 1, R() * 3, 0, (R() - .5) * .3), c: col(0xff7a1a), glow: 2.2 });
    return makeGeo(parts, 81);
  },
});

// アーチ門（archgate）
TDProps.add({
  id: 'archgate', name: 'アーチ門',
  r: .45, offs: [-1.25, 1.25], min: 4, sc: [.9, 1.1], slope: .4, vis: 1.9, anyGround: true,
  tags: ['ruins', 'castle'], height: 4.57,
  build() {
    const { rng, mat4, displace, makeGeo, petalGeo, basisAt, RUIN_STONE, MOSS } = TDGeo;
    const R = rng(58), cf = RUIN_STONE, parts = [];
    for (const sx of [-1.25, 1.25]) {
      parts.push({ g: new THREE.BoxGeometry(.7, .3, .8), m: mat4(sx, .15, 0, 1, 1, 1), cfn: cf });
      for (let k = 0; k < 4; k++) parts.push({ g: displace(new THREE.BoxGeometry(.55 - (k % 2) * .04, .6, .6), .05, sx + k), m: mat4(sx, .6 + k * .625, 0, 1, 1, 1, (R() - .5) * .06), cfn: cf, j: .08 });
    }
    const n = 9;
    for (let k = 0; k < n; k++) { const a = Math.PI * (k + .5) / n; parts.push({ g: new THREE.BoxGeometry(.52, .42, .62), m: mat4(Math.cos(a) * 1.25, 2.8 + Math.sin(a) * 1.25, 0, 1, 1, 1, 0, 0, a - Math.PI / 2), cfn: cf, j: .08 }); }
    parts.push({ g: new THREE.BoxGeometry(3.3, .35, .7), m: mat4(0, 4.25, 0, 1, 1, 1), cfn: cf });
    parts.push({ g: displace(new THREE.IcosahedronGeometry(.35, 0), .4, 3), m: mat4(-.8, 4.45, .1, 1.5, .35, 1, .3), cfn: MOSS, j: .1 });
    for (let k = 0; k < 10; k++) { const y = 4.0 - k * .22; parts.push({ g: petalGeo(.14, .1), m: basisAt([-1.25 + (R() - .5) * .3, y, .31], [(R() - .5), -1, .2], [0, 0, 1]), cfn: MOSS, j: .15 }); }
    return makeGeo(parts, 58, { ao: .7 });
  },
});

// 魔界の尖塔（demonspire）
TDProps.add({
  id: 'demonspire', name: '魔界の尖塔',
  r: .6, min: 2.5, sc: [.8, 1.4], slope: .8, vis: .8, anyGround: true, light: [0xff3050, 8, 2],
  tags: ['demon'], height: 4.64,
  build() {
    const { rng, col, mat4, displace, makeGeo, DARK_C } = TDGeo;
    const R = rng(94), parts = [];
    for (let k = 0; k < 4; k++) parts.push({ g: displace(new THREE.ConeGeometry(.75 - k * .16, 1.6, 6, 2), .2, k), m: mat4((R() - .5) * .15, .7 + k * 1.05, (R() - .5) * .15, 1, 1, 1, k * .7, (R() - .5) * .15), cfn: DARK_C, j: .1 });
    for (let k = 0; k < 5; k++) parts.push({ g: new THREE.BoxGeometry(.035, .9, .035), m: mat4(Math.cos(k * 1.3) * (.45 - k * .06), .9 + k * .7, Math.sin(k * 1.3) * (.45 - k * .06), 1, 1, 1, 0, .15, .25), c: col(0xff3050), glow: 2.4 });
    return makeGeo(parts, 94);
  },
});

// 氷柱（icespike）
TDProps.add({
  id: 'icespike', name: '氷柱',
  r: .4, min: 1.5, sc: [.7, 1.5], slope: 1.2, vis: .6, anyGround: true,
  tags: ['snow', 'cave'], height: 2.32,
  build() {
    const { rng, mat4, makeGeo, ICE_C } = TDGeo;
    const R = rng(85), parts = [];
    for (let k = 0; k < 5; k++) { const a = k * 1.25 + R(), h = 1 + R() * 1.6; parts.push({ g: new THREE.OctahedronGeometry(1, 0), m: mat4(Math.cos(a) * .25, h * .45, Math.sin(a) * .25, .15 + R() * .1, h * .55, .15 + R() * .1, a, Math.cos(a) * .25, Math.sin(a) * .25), cfn: ICE_C, j: .1, glow: .25 }); }
    return makeGeo(parts, 85);
  },
});

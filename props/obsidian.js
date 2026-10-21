// 黒曜石（obsidian）
TDProps.add({
  id: 'obsidian', name: '黒曜石',
  r: .4, min: 1.4, sc: [.7, 1.4], slope: 1.2, vis: .6, anyGround: true,
  tags: ['volcano', 'demon', 'cave'], height: 1.58, material: 'gloss',
  build() {
    const { rng, col, mixc, mat4, makeGeo } = TDGeo;
    const R = rng(83), parts = [];
    for (let k = 0; k < 5; k++) { const a = k * 1.3 + R(), h = .6 + R() * 1.2; parts.push({ g: new THREE.OctahedronGeometry(1, 0), m: mat4(Math.cos(a) * .25, h * .45, Math.sin(a) * .25, .16 + R() * .1, h * .5, .16 + R() * .1, a, Math.cos(a) * .3, Math.sin(a) * .3), cfn: (y, ny, Rr) => mixc(col(0x0d0a12), col(0x3a2a52), Rr()), j: .2 }); }
    return makeGeo(parts, 83);
  },
});

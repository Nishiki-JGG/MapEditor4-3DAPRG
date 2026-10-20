// 崩れた壁（ruinwall）
TDProps.add({
  id: 'ruinwall', name: '崩れた壁',
  r: .4, offs: [-1.2, -.4, .4, 1.2], min: 3.2, sc: [.85, 1.15], slope: .5, vis: 1.6, anyGround: true,
  tags: ['ruins', 'castle', 'graveyard'], height: 1.99, material: 'stone',
  build() {
    const { rng, mat4, displace, makeGeo, petalGeo, basisAt, chisel, MOSS, blockC, stoneCourses } = TDGeo;
    const R = rng(57), parts = [], cf = blockC(0x837d72, 0xd2cab8), top = (x) => 1.9 - Math.abs(x) * .5;
    const tops = Array.from({ length: 13 }, () => (R() - .5) * .8);
    stoneCourses(parts, -1.5, 1.5, 0, 5, .4, .55, R, cf, { core: 0x4c4840, keep: (x, y) => y - .2 < top(x) + tops[Math.round((x + 1.5) * 4)] || y < .4 });
    for (let k = 0; k < 4; k++) parts.push({ g: chisel(new THREE.IcosahedronGeometry(.2, 0), 3, 570 + k, .6), m: mat4((R() - .5) * 3, .1, .5 + R() * .4, 1, .7, 1, R() * 3), cfn: cf });
    // moss on the broken top and ivy leaves down the face
    for (let k = 0; k < 4; k++) { const x = -1 + k * .62 + (R() - .5) * .2; parts.push({ g: displace(new THREE.IcosahedronGeometry(.22, 0), .4, x * 7), m: mat4(x, Math.max(.6, top(x) - .05), 0, 1.3, .4, 1.4), cfn: MOSS, j: .1 }); }
    for (let k = 0; k < 14; k++) { const x = -.9 + (R() - .5) * .5 + (k % 2) * 1.5, y = 1.5 - k * .09 + (R() - .5) * .2; parts.push({ g: petalGeo(.13, .1), m: basisAt([x + (R() - .5) * .3, Math.max(.1, y), .29], [(R() - .5), -1, .2], [0, 0, 1]), cfn: MOSS, j: .15 }); }
    return makeGeo(parts, 57, { ao: .6 });
  },
});

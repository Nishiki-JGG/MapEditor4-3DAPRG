// 貝殻・ヒトデ（shells）
TDProps.add({
  id: 'shells', name: '貝殻・ヒトデ',
  r: 0, min: .6, sc: [.8, 1.6], slope: .7, vis: .35, anyGround: true,
  tags: ['beach'], height: 0.03,
  build() {
    const { rng, col, mixc, mat4, makeGeo } = TDGeo;
    const R = rng(74), parts = [];
    for (let k = 0; k < 5; k++) parts.push({ g: new THREE.BoxGeometry(.18, .025, .045), m: mat4(Math.cos(k * 1.2566) * .08, .02, Math.sin(k * 1.2566) * .08, 1, 1, 1, -k * 1.2566), c: col(0xe8784a), j: .1 });
    for (let k = 0; k < 4; k++) parts.push({ g: new THREE.SphereGeometry(.06, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), m: mat4(.3 + R() * .4 - .2, 0, (R() - .5) * .5, 1, .5, 1.3, R() * 3), c: mixc(col(0xf1e3cf), col(0xf0b9a8), R()) });
    return makeGeo(parts, 74);
  },
});

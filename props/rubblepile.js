// 瓦礫の山（rubblepile）
TDProps.add({
  id: 'rubblepile', name: '瓦礫の山',
  r: .55, min: 1.6, sc: [.7, 1.3], slope: 1, vis: .9, anyGround: true, shape: true,
  tags: ['ruins', 'castle', 'desert', 'graveyard'], height: 0.82, material: 'stone',
  build() {
    const { rng, mat4, displace, makeGeo, RUIN_STONE } = TDGeo;
    const R = rng(61), parts = [];
    for (let k = 0; k < 9; k++) {
      const a = R() * 6.28, d = R() * .7, s = .25 + R() * .3;
      parts.push({ g: k % 3 ? new THREE.BoxGeometry(s * 1.6, s, s) : displace(new THREE.IcosahedronGeometry(s * .7, 0), .3, k), m: mat4(Math.cos(a) * d, s * .4 + (k > 5 ? .3 : 0), Math.sin(a) * d, 1, 1, 1, R() * 3, (R() - .5) * .6, (R() - .5) * .6), cfn: RUIN_STONE, j: .1 });
    }
    return makeGeo(parts, 61);
  },
});

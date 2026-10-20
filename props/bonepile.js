// 骨の山（bonepile）
TDProps.add({
  id: 'bonepile', name: '骨の山',
  r: .35, min: 1.4, sc: [.8, 1.4], slope: .8, vis: .6, anyGround: true,
  tags: ['demon', 'graveyard', 'cave'], height: 0.53,
  build() {
    const { rng, mat4, displace, makeGeo, BONE_C } = TDGeo;
    const R = rng(95), parts = [];
    for (let k = 0; k < 10; k++) parts.push({ g: new THREE.CylinderGeometry(.035, .035, .6 + R() * .5, 5), m: mat4((R() - .5) * .8, .05 + R() * .25, (R() - .5) * .8, 1, 1, 1, R() * 3, R() * 3, Math.PI / 2 + (R() - .5)), cfn: BONE_C });
    for (let k = 0; k < 2; k++) parts.push({ g: displace(new THREE.IcosahedronGeometry(.16, 1), .1, k), m: mat4((R() - .5) * .5, .3, (R() - .5) * .5, 1.2, .9, 1, R() * 3), cfn: BONE_C });
    return makeGeo(parts, 95);
  },
});

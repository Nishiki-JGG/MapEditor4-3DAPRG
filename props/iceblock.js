// 氷塊（iceblock）
TDProps.add({
  id: 'iceblock', name: '氷塊',
  r: .95, min: 2, sc: [.7, 1.5], slope: 1.2, vis: 1, anyGround: true,
  tags: ['snow', 'mountain'], height: 1.09, material: 'ice',
  build() {
    const { rng, mat4, displace, makeGeo, chisel, ICE_C } = TDGeo;
    const R = rng(84), parts = [];
    for (let k = 0; k < 3; k++) parts.push({ g: chisel(displace(new THREE.BoxGeometry(.9 + R() * .5, .7 + R() * .6, .8 + R() * .4), .12, k), 3, 840 + k, .8, .3), m: mat4((R() - .5) * .9, .35 + R() * .2, (R() - .5) * .7, 1, 1, 1, R() * 3, (R() - .5) * .3, (R() - .5) * .3), cfn: ICE_C, j: .08, glow: .18 });
    return makeGeo(parts, 84);
  },
});

// 折れた石柱（brokencol）
TDProps.add({
  id: 'brokencol', name: '折れた石柱',
  r: .5, min: 2, sc: [.8, 1.2], slope: .6, vis: 1, anyGround: true, shape: true,
  tags: ['ruins', 'desert', 'graveyard'], height: 1.83, material: 'stone',
  build() {
    const { mat4, displace, makeGeo, chisel, ribbed, RUIN_STONE, MOSS } = TDGeo;
    const cf = RUIN_STONE;
    return makeGeo([
      { g: new THREE.BoxGeometry(1, .3, 1), m: mat4(0, .15, 0, 1, 1, 1, .2), cfn: cf },
      { g: chisel(displace(ribbed(new THREE.CylinderGeometry(.3, .38, 1.5, 16, 3), 16, .9), .05, 7), 2, 56, .85, .9), m: mat4(0, 1.05, 0, 1, 1, 1, 0, .04), cfn: cf },
      { g: displace(ribbed(new THREE.CylinderGeometry(.34, .34, .9, 16, 1), 16, .9), .04, 2), m: mat4(1.0, .34, .5, 1, 1, 1, .6, 0, Math.PI / 2), cfn: cf },
      { g: chisel(new THREE.IcosahedronGeometry(.18, 0), 3, 561, .6), m: mat4(-.6, .1, .5, 1, .7, 1), cfn: cf },
      { g: chisel(new THREE.IcosahedronGeometry(.13, 0), 3, 562, .6), m: mat4(-.3, .08, -.7, 1, .7, 1), cfn: cf },
      { g: displace(new THREE.IcosahedronGeometry(.25, 0), .4, 6), m: mat4(-.1, .3, .4, 1.4, .35, 1, 0), cfn: MOSS, j: .1 },
    ], 56, { ao: .6 });
  },
});

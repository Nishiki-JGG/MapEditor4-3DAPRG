// 石碑（stele）
TDProps.add({
  id: 'stele', name: '石碑',
  r: .4, min: 1.6, sc: [.8, 1.2], slope: .6, vis: .6, anyGround: true,
  tags: ['ruins', 'desert', 'graveyard'], height: 1.95, material: 'stone',
  build() {
    const { col, mat4, makeGeo, RUIN_STONE, halfDisc } = TDGeo;
    const cf = RUIN_STONE;
    return makeGeo([
      { g: new THREE.BoxGeometry(1.1, .25, .55), m: mat4(0, .12, 0, 1, 1, 1), cfn: cf },
      { g: new THREE.BoxGeometry(.8, 1.3, .22), m: mat4(0, .9, 0, 1, 1, 1), cfn: cf },
      { g: halfDisc(.4, .22), m: mat4(0, 1.55, 0, 1, 1, 1, 0, Math.PI / 2), cfn: cf },
      { g: new THREE.BoxGeometry(.56, .9, .02), m: mat4(0, 1.0, .115, 1, 1, 1), c: col(0x6a655c), j: .03 },
    ], 60);
  },
});

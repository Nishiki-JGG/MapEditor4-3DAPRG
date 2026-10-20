// 木の柵（woodfence）
TDProps.add({
  id: 'woodfence', name: '木の柵',
  r: .1, offs: [-.8, 0, .8], min: 2.1, sc: [1, 1], slope: .5, vis: 1.1, anyGround: true,
  tags: ['grassland', 'forest'], height: 1,
  build() {
    const { mat4, makeGeo, WOOD_C } = TDGeo;
    const parts = [];
    for (let k = 0; k < 3; k++) parts.push({ g: new THREE.BoxGeometry(.12, 1.0, .12), m: mat4(-.9 + k * .9, .5, 0, 1, 1, 1, (k - 1) * .05), cfn: WOOD_C });
    for (const y of [.35, .75]) parts.push({ g: new THREE.BoxGeometry(2.0, .1, .05), m: mat4(0, y, .07, 1, 1, 1, 0, 0, (y - .5) * .05), cfn: WOOD_C });
    return makeGeo(parts, 98);
  },
});

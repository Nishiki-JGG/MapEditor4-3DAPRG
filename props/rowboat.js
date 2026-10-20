// 小舟（rowboat）
TDProps.add({
  id: 'rowboat', name: '小舟',
  r: .55, offs: [-.8, 0, .8], min: 3, sc: [.9, 1.1], slope: .6, vis: 1.3, anyGround: true,
  tags: ['beach'], height: 0.62,
  build() {
    const { mat4, makeGeo, WOOD_C } = TDGeo;
    const parts = [];
    parts.push({ g: new THREE.CylinderGeometry(.62, .62, 2.6, 12, 1, false, Math.PI, Math.PI), m: mat4(0, .42, 0, .55, 1, 1, 0, 0, Math.PI / 2), cfn: WOOD_C, j: .08 });
    for (const sx of [-1.2, 1.2]) parts.push({ g: new THREE.ConeGeometry(.35, .5, 6), m: mat4(sx, .32, 0, 1, .7, 1, 0, 0, sx > 0 ? -Math.PI / 2 : Math.PI / 2), cfn: WOOD_C });
    for (const sx of [-.5, .4]) parts.push({ g: new THREE.BoxGeometry(.22, .05, 1.1), m: mat4(sx, .4, 0, 1, 1, 1), cfn: WOOD_C });
    parts.push({ g: new THREE.BoxGeometry(2.0, .03, .06), m: mat4(.1, .48, .35, 1, 1, 1, .3, 0, .08), cfn: WOOD_C });
    return makeGeo(parts, 72);
  },
});

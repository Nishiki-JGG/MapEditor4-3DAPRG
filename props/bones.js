// 骨（bones）
TDProps.add({
  id: 'bones', name: '骨',
  r: 0, min: 1, sc: [.8, 1.4], slope: .8, vis: .6, anyGround: true,
  tags: ['desert', 'wasteland', 'demon', 'graveyard'], height: 0.39,
  build() {
    const { col, mat4, displace, makeGeo, BONE_C } = TDGeo;
    const parts = [{ g: displace(new THREE.IcosahedronGeometry(.18, 1), .1, 3), m: mat4(.3, .14, .1, 1.2, .9, 1, .4), cfn: BONE_C }];
    parts.push({ g: new THREE.BoxGeometry(.08, .04, .05), m: mat4(.43, .14, .2, 1, 1, 1, .4), c: col(0x1a1612) });
    parts.push({ g: new THREE.BoxGeometry(.08, .04, .05), m: mat4(.36, .14, .28, 1, 1, 1, .4), c: col(0x1a1612) });
    for (let k = 0; k < 4; k++) parts.push({ g: new THREE.TorusGeometry(.32, .025, 4, 10, Math.PI * .9), m: mat4(-.3 + k * .17, .05, -.1, 1, 1, 1, Math.PI / 2, 0, 0), cfn: BONE_C });
    parts.push({ g: new THREE.CylinderGeometry(.035, .035, 1.0, 5), m: mat4(-.05, .05, -.1, 1, 1, 1, 0, 0, Math.PI / 2), cfn: BONE_C });
    return makeGeo(parts, 80);
  },
});

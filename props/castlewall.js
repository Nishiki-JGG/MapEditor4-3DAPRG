// 城壁（castlewall）
TDProps.add({
  id: 'castlewall', name: '城壁',
  r: .55, offs: [-1.1, 0, 1.1], min: 3.2, sc: [.9, 1.1], slope: .4, vis: 1.6, anyGround: true,
  tags: ['castle', 'ruins'], height: 3.24, material: 'stone',
  build() {
    const { rng, col, mat4, displace, makeGeo, blockC, stoneCourses } = TDGeo;
    const R = rng(88), parts = [], cf = blockC(0x5e5c57, 0xa8a59c);
    parts.push({ g: new THREE.BoxGeometry(2.96, 2.74, .94), m: mat4(0, 1.37, 0, 1, 1, 1), c: col(0x3e3c38), j: .04 });   // mortar core (shows in the joints)
    stoneCourses(parts, -1.5, 1.5, 0, 6, .46, 1.0, R, cf);
    parts.push({ g: new THREE.BoxGeometry(3.05, .15, 1.15), m: mat4(0, 2.83, 0, 1, 1, 1), cfn: cf });
    for (let k = 0; k < 5; k++) parts.push({ g: displace(new THREE.BoxGeometry(.38, .45, 1.05), .05, k), m: mat4(-1.31 + k * .655, 3.12 - .1, 0, 1, 1, 1), cfn: cf });
    parts.push({ g: new THREE.BoxGeometry(.1, .55, 1.02), m: mat4(.33, 1.9, 0, 1, 1, 1), c: col(0x14120f) });   // arrow slit
    parts.push({ g: displace(new THREE.IcosahedronGeometry(.3, 0), .4, 2), m: mat4(.8, .1, .55, 1.4, .4, 1, .3), c: col(0x4e6a34), j: .1 });
    parts.push({ g: displace(new THREE.IcosahedronGeometry(.25, 0), .4, 5), m: mat4(-.9, .08, -.55, 1.5, .35, 1, .3), c: col(0x4e6a34), j: .1 });
    return makeGeo(parts, 88, { ao: .7 });
  },
});

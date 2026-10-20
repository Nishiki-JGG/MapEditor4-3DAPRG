// 城門（gatehouse）
TDProps.add({
  id: 'gatehouse', name: '城門',
  r: .75, offs: [-1.6, 1.6], min: 5, sc: [.9, 1.1], slope: .3, vis: 2.2, anyGround: true,
  tags: ['castle'], height: 4.64,
  build() {
    const { rng, col, mixc, mat4, displace, makeGeo, blockC, stoneCourses } = TDGeo;
    const R = rng(90), parts = [], cf = blockC(0x5e5c57, 0xa8a59c), iron = (y, ny, R) => mixc(col(0x23252a), col(0x3e4148), R());
    for (const sx of [-1.6, 1.6]) {
      parts.push({ g: new THREE.BoxGeometry(1.16, 4.18, 1.34), m: mat4(sx, 2.09, 0, 1, 1, 1), c: col(0x3e3c38), j: .04 });
      stoneCourses(parts, sx - .6, sx + .6, 0, 6, .7, 1.4, R, cf);
      for (let k = 0; k < 2; k++) parts.push({ g: displace(new THREE.BoxGeometry(.4, .45, 1.45), .05, k + sx), m: mat4(sx - .3 + k * .6, 4.42, 0, 1, 1, 1), cfn: cf });
    }
    parts.push({ g: new THREE.BoxGeometry(2.1, 1.1, 1.2), m: mat4(0, 3.6, 0, 1, 1, 1), c: col(0x3e3c38) });
    stoneCourses(parts, -1.0, 1.0, 3.05, 2, .55, 1.26, R, cf);
    parts.push({ g: displace(new THREE.BoxGeometry(2.2, .12, 1.3), .03, 9), m: mat4(0, 4.2, 0, 1, 1, 1), cfn: cf });
    for (let k = 0; k < 7; k++) parts.push({ g: new THREE.BoxGeometry(.05, .75, .05), m: mat4(-.84 + k * .28, 2.68, .3, 1, 1, 1), cfn: iron });
    parts.push({ g: new THREE.BoxGeometry(1.9, .05, .05), m: mat4(0, 2.6, .3, 1, 1, 1), cfn: iron });
    return makeGeo(parts, 90, { ao: .8 });
  },
});

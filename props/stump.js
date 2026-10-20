// 切り株（stump）
TDProps.add({
  id: 'stump', name: '切り株',
  r: .45, min: 1.2, sc: [.8, 1.3], slope: .7, vis: .6,
  tags: ['grassland', 'forest', 'ruins', 'castle'], height: 0.71,
  build() {
    const { col, mixc, mat4, displace, makeGeo, ribbed } = TDGeo;
    const bark = (y, ny, R) => ny > .8 ? mixc(col(0xb88c5c), col(0xd9b384), R()) : mixc(col(0x3e2a19), col(0x6a4a2e), R());
    const parts = [{ g: displace(ribbed(new THREE.CylinderGeometry(.36, .46, .62, 12, 2), 12, .92), .06, 7.7), m: mat4(0, .31, 0, 1, 1, 1), cfn: bark, j: .08 }];
    parts.push({ g: new THREE.CircleGeometry(.2, 8), m: mat4(0, .625, 0, 1, 1, 1, 0, -Math.PI / 2), c: col(0xa27a4e), j: .05 });
    parts.push({ g: new THREE.CircleGeometry(.07, 6), m: mat4(0, .628, 0, 1, 1, 1, 0, -Math.PI / 2), c: col(0x7a5636), j: .05 });
    for (let k = 0; k < 4; k++) { const a = k * 1.6 + .4; parts.push({ g: new THREE.CylinderGeometry(.05, .14, .7, 5), m: mat4(Math.cos(a) * .42, .08, Math.sin(a) * .42, 1, 1, 1, -a, 0, Math.PI / 2 - .25), cfn: bark, j: .1 }); }
    parts.push({ g: displace(new THREE.IcosahedronGeometry(.12, 0), .3, 2.9), m: mat4(.25, .66, .1, 1, .5, 1), c: col(0x5f8a32), j: .1 });
    for (let k = 0; k < 2; k++) { parts.push({ g: new THREE.CylinderGeometry(.012, .016, .08, 4, 1, true), m: mat4(-.42 + k * .06, .04, .25, 1, 1, 1), c: col(0xe8ddc8) }); parts.push({ g: new THREE.SphereGeometry(.04 - k * .01, 6, 2, 0, Math.PI * 2, 0, Math.PI / 2), m: mat4(-.42 + k * .06, .075, .25, 1, .7, 1), c: col(0xb0763e) }); }
    return makeGeo(parts, 44, { ao: .35 });
  },
});

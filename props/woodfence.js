// 木の柵（woodfence）
TDProps.add({
  id: 'woodfence', name: '木の柵',
  r: .1, offs: [-.8, 0, .8], min: 2.1, sc: [1, 1], slope: .5, vis: 1.1, anyGround: true,
  tags: ['grassland', 'forest'], height: 1, material: 'cards2',
  build() {
    const { col, mixc, mat4, displace, makeGeo, ATLAS2 } = TDGeo;
    // split-rail fence of weathered wood (atlas 2): rough posts with cut tops, two rails nailed on
    const wood = (y, ny, R, pr) => mixc(col(0xb8aa98), col(0xe2d6c4), pr);
    const parts = [];
    for (let k = 0; k < 3; k++) {
      parts.push({ g: displace(new THREE.CylinderGeometry(.065, .075, 1.04, 6, 2), .06, k), m: mat4(-.9 + k * .9, .5, 0, 1, 1, 1, k, (k - 1) * .05), cfn: wood, uvr: ATLAS2.uvr('wood'), j: .05 });
      parts.push({ g: new THREE.ConeGeometry(.07, .08, 6), m: mat4(-.9 + k * .9, 1.06, 0, 1, 1, 1, k), cfn: wood, uvr: ATLAS2.uvr('wood'), j: .05 });
    }
    for (const y of [.35, .75]) parts.push({ g: displace(new THREE.BoxGeometry(2.05, .1, .05, 4, 1, 1), .04, y * 9), m: mat4(0, y, .07, 1, 1, 1, 0, 0, (y - .5) * .05), cfn: wood, uvr: ATLAS2.uvr('wood'), j: .05 });
    for (let k = 0; k < 6; k++) parts.push({ g: new THREE.BoxGeometry(.015, .015, .02), m: mat4(-.9 + (k % 3) * .9, k < 3 ? .35 : .75, .1, 1, 1, 1), c: col(0x2a2622) });
    return makeGeo(parts, 98, { ao: .4, uv: ATLAS2.white });
  },
});

// 流木（driftwood）
TDProps.add({
  id: 'driftwood', name: '流木',
  r: .3, offs: [-.8, .8], min: 2, sc: [.8, 1.2], slope: .7, vis: 1.2, anyGround: true,
  tags: ['beach'], height: 0.68, material: 'cards2',
  build() {
    const { col, mixc, mat4, displace, makeGeo, ATLAS2 } = TDGeo;
    // sun-bleached, sea-worn wood: pale grey grain (atlas 2 wood), twisted and smoothed
    const pale = (y, ny, R, pr) => mixc(col(0xc8c4bc), col(0xf0ece4), pr);
    return makeGeo([
      { g: displace(new THREE.CylinderGeometry(.16, .22, 2.4, 8, 4), .12, 2), m: mat4(0, .16, 0, 1, 1, 1, 0, 0, Math.PI / 2 + .05), cfn: pale, uvr: ATLAS2.uvr('wood') },
      { g: displace(new THREE.CylinderGeometry(.04, .08, .9, 6, 2), .1, 3), m: mat4(.6, .35, .2, 1, 1, 1, 0, .7, -.5), cfn: pale, uvr: ATLAS2.uvr('wood') },
      { g: displace(new THREE.CylinderGeometry(.03, .06, .6, 6, 2), .1, 4), m: mat4(-.7, .3, -.15, 1, 1, 1, 0, -.6, .6), cfn: pale, uvr: ATLAS2.uvr('wood') },
      { g: displace(new THREE.CylinderGeometry(.02, .05, .45, 5), .1, 5), m: mat4(-.2, .3, .15, 1, 1, 1, 0, .4, .9), cfn: pale, uvr: ATLAS2.uvr('wood') },
    ], 73, { ao: .3, uv: ATLAS2.white });
  },
});

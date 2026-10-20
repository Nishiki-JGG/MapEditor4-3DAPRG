// 流木（driftwood）
TDProps.add({
  id: 'driftwood', name: '流木',
  r: .3, offs: [-.8, .8], min: 2, sc: [.8, 1.2], slope: .7, vis: 1.2, anyGround: true,
  tags: ['beach'], height: 0.68,
  build() {
    const { col, mixc, mat4, displace, makeGeo } = TDGeo;
    const pale = (y, ny, R) => mixc(col(0x9c9282), col(0xd1c8b6), R());
    return makeGeo([
      { g: displace(new THREE.CylinderGeometry(.16, .22, 2.4, 7, 3), .12, 2), m: mat4(0, .16, 0, 1, 1, 1, 0, 0, Math.PI / 2 + .05), cfn: pale },
      { g: new THREE.CylinderGeometry(.04, .08, .9, 5), m: mat4(.6, .35, .2, 1, 1, 1, 0, .7, -.5), cfn: pale },
      { g: new THREE.CylinderGeometry(.03, .06, .6, 5), m: mat4(-.7, .3, -.15, 1, 1, 1, 0, -.6, .6), cfn: pale },
    ], 73);
  },
});

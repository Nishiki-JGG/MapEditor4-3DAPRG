// 干し草（haystack）
TDProps.add({
  id: 'haystack', name: '干し草',
  r: .7, min: 2, sc: [.8, 1.2], slope: .5, vis: .8,
  tags: ['grassland'], height: 1.69,
  build() {
    const { col, mixc, mat4, displace, makeGeo } = TDGeo;
    const hay = (y, ny, R) => mixc(col(0xb08a3a), col(0xe0c470), R());
    return makeGeo([{ g: displace(new THREE.CylinderGeometry(.75, .8, .9, 12, 2), .06, 3), m: mat4(0, .45, 0, 1, 1, 1), cfn: hay }, { g: displace(new THREE.ConeGeometry(.82, .8, 12, 2), .06, 5), m: mat4(0, 1.3, 0, 1, 1, 1), cfn: hay }], 99);
  },
});

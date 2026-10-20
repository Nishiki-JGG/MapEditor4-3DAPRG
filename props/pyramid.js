// ピラミッド（pyramid）
TDProps.add({
  id: 'pyramid', name: 'ピラミッド',
  r: 4, min: 10, sc: [.8, 1.2], slope: .4, vis: 4.5, anyGround: true,
  tags: ['desert'], height: 6,
  build() {
    const { col, mat4, displace, makeGeo, SANDSTONE } = TDGeo;
    const parts = [];
    for (let k = 0; k < 6; k++) { const w = 8 - k * 1.25; parts.push({ g: displace(new THREE.BoxGeometry(w, .8, w, 3, 1, 3), .015, k), m: mat4(0, .4 + k * .8, 0, 1, 1, 1), cfn: SANDSTONE, j: .06 }); }
    parts.push({ g: new THREE.ConeGeometry(1.3, 1.2, 4), m: mat4(0, 5.4, 0, 1, 1, 1, Math.PI / 4), c: col(0xe8cf8e) });
    parts.push({ g: new THREE.BoxGeometry(1.0, 1.4, .1), m: mat4(0, .7, 4.0, 1, 1, 1), c: col(0x20180f), j: .02 });
    parts.push({ g: new THREE.BoxGeometry(1.4, .25, .6), m: mat4(0, 1.5, 4.0, 1, 1, 1), cfn: SANDSTONE });
    return makeGeo(parts, 76);
  },
});

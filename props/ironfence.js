// 鉄柵（ironfence）
TDProps.add({
  id: 'ironfence', name: '鉄柵',
  r: .12, offs: [-.8, 0, .8], min: 2.1, sc: [1, 1], slope: .5, vis: 1.1, anyGround: true,
  tags: ['graveyard', 'castle'], height: 1.7,
  build() {
    const { col, mixc, mat4, makeGeo } = TDGeo;
    const iron = (y, ny, R) => mixc(col(0x23252a), col(0x3e4148), R()), parts = [];
    for (let k = 0; k <= 8; k++) {
      const x = -1 + k * .25, h = k % 4 === 0 ? 1.55 : 1.3, w = k % 4 === 0 ? .1 : .035;
      parts.push({ g: new THREE.BoxGeometry(w, h, w), m: mat4(x, h / 2, 0, 1, 1, 1), cfn: iron, j: .05 });
      parts.push({ g: new THREE.ConeGeometry(w * 1.3, .16, 4), m: mat4(x, h + .07, 0, 1, 1, 1), cfn: iron, j: .05 });
    }
    for (const y of [.25, 1.1]) parts.push({ g: new THREE.BoxGeometry(2, .05, .05), m: mat4(0, y, 0, 1, 1, 1), cfn: iron, j: .05 });
    return makeGeo(parts, 64);
  },
});

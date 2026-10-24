// タカラガイ（cowrie）：つやのある卵形のドーム。濃い茶色に白い斑点、縁は淡い（参考：Cypraea caputserpentis の写真）
TDProps.add({
  id: 'cowrie', name: 'タカラガイ',
  r: 0, min: .3, sc: [1.2, 1.9], slope: .6, vis: .12, anyGround: true, shore: [-.05, .45], groundSink: .004, material: 'gloss',
  tags: ['beach'], height: .022,
  build() {
    const { col, mixc, mat4, makeGeo } = TDGeo;
    const dark = col(0x3a2416), brown = col(0x6a3d22), spot = col(0xf3e6cf), rim = col(0xcdb9a0);
    const spotAt = (x, y, z) => Math.sin(x * 900 + Math.sin(z * 700) * 2) * Math.sin(z * 820 + Math.sin(x * 640) * 2) > .62;
    const cfn = (y, ny, R, pr, cx, cz) => y < .004 ? rim : spotAt(cx, y, cz) ? spot : mixc(dark, brown, R() * .6);
    return makeGeo([
      { g: new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), m: mat4(0, .001, 0, .022, .021, .033), cfn, j: .05 },
      { g: new THREE.CylinderGeometry(1, 1, 1, 20), m: mat4(0, .0015, 0, .021, .003, .032), c: rim, j: .05 },   // the pale base
    ], 83, { smooth: 60 });
  },
});

// テーブルサンゴ（tablecoral）：短い柄の上に、縁が波打つ平たい円い板が広がり、小さな板が重なる。桃色がかった黄褐色（参考：テーブル状のミドリイシ Acropora hyacinthus、豪州ロードストーン礁の写真）
TDProps.add({
  id: 'tablecoral', name: 'テーブルサンゴ',
  r: .7, min: 2, sc: [.6, 1.3], slope: .5, vis: .9, anyGround: true, water: [.5, 3],
  tags: ['beach'], height: .62,
  build() {
    const { rng, col, mixc, mat4, makeGeo } = TDGeo;
    const R = rng(29), parts = [];
    const plateC = (y, ny, Rr) => ny < -.3 ? mixc(col(0x7f5a4a), col(0x9a6f5c), Rr()) : mixc(col(0xc58c78), col(0xe2b39c), Rr() * .7);
    // a plate: a very flat cone (the rim a little higher), its edge in lobes
    const plate = (r, x, y, z, seed) => {
      const g = new THREE.CylinderGeometry(r, r * .25, .06, 48, 2, false), p = g.attributes.position, ph = R() * 6.28, ph2 = R() * 6.28;
      for (let i = 0; i < p.count; i++) {
        const px = p.getX(i), pz = p.getZ(i), d = Math.hypot(px, pz); if (d < 1e-4) continue;
        const a = Math.atan2(pz, px), k = 1 + .1 * Math.sin(5 * a + ph) + .05 * Math.sin(11 * a + ph2) + .03 * Math.sin(seed + 23 * a);
        p.setXYZ(i, px * k, p.getY(i) + (d / r) * (d / r) * .07, pz * k);
      }
      parts.push({ g, m: mat4(x, y, z, 1, 1, 1, R() * 6.28), cfn: plateC, j: .08 });
    };
    parts.push({ g: new THREE.CylinderGeometry(.07, .11, .4, 7), m: mat4(0, .2, 0, 1, 1, 1), cfn: (y, ny, Rr) => mixc(col(0x8c7464), col(0xa88a74), Rr()), j: .1 });
    plate(.62, 0, .42, 0, 1);
    plate(.26 + R() * .08, .2, .5, -.12, 2);   // a younger plate growing on the old one
    if (R() < .7) plate(.18, -.22, .48, .15, 3);
    return makeGeo(parts, 29);
  },
});

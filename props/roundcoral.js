// 丸いサンゴの群体（roundcoral）：短い太い小枝がびっしり集まって、丸いカリフラワーのような塊になる。クリーム色〜薄い桃色（参考：豪州ロードストーン礁の写真に多い丸い群体）
TDProps.add({
  id: 'roundcoral', name: '丸いサンゴの群体',
  r: .35, min: 1, sc: [.7, 1.5], slope: .7, vis: .4, anyGround: true, water: [.25, 3],
  tags: ['beach'], height: .45,
  build() {
    const { rng, col, mixc, mat4, makeGeo } = TDGeo;
    const R = rng(55), parts = [], up = new THREE.Vector3(0, 1, 0), c = col(0xe2c4a8), d = col(0xb48e74), tipC = col(0xf2e2d0);
    parts.push({ g: new THREE.SphereGeometry(.3, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), m: mat4(0, 0, 0, 1, .95, 1), cfn: (y, ny, Rr) => mixc(d, c, Rr() * .5), j: .1 });
    // stubby branches poking out of the dome, every way but down
    for (let k = 0; k < 110; k++) {
      const ty = R(), az = R() * 6.28, el = Math.acos(1 - ty * .95), dir = new THREE.Vector3(Math.sin(el) * Math.cos(az), Math.cos(el), Math.sin(el) * Math.sin(az));
      const len = .07 + R() * .05, r = .034 + R() * .012, p = dir.clone().multiplyScalar(.27 + len * .45).multiply(new THREE.Vector3(1, .95, 1));
      const q = new THREE.Quaternion().setFromUnitVectors(up, dir);
      parts.push({ g: new THREE.CylinderGeometry(r * .9, r, len, 6), m: new THREE.Matrix4().compose(p, q, new THREE.Vector3(1, 1, 1)), cfn: (y, ny, Rr) => mixc(c, d, Rr() * .3), j: .1 });
      parts.push({ g: new THREE.SphereGeometry(r * .9, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), m: new THREE.Matrix4().compose(p.clone().addScaledVector(dir, len / 2), q, new THREE.Vector3(1, 1, 1)), cfn: (y, ny, Rr) => mixc(c, tipC, Rr() * .7), j: .08 });
    }
    return makeGeo(parts, 55, { ao: .35 });
  },
});

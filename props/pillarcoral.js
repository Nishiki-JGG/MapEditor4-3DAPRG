// ハシラサンゴ（pillarcoral）：枝分かれしない太い指のような柱が、一つの根元から何本も立つ。先は丸く、ポリプで毛羽立った黄褐色（参考：ピラーコーラル Dendrogyra cylindrus）
TDProps.add({
  id: 'pillarcoral', name: 'ハシラサンゴ',
  r: .4, min: 1.4, sc: [.6, 1.3], slope: .5, vis: .6, anyGround: true, water: [.4, 3],
  tags: ['beach'], height: 1.4,
  build() {
    const { rng, col, mixc, mat4, displace, makeGeo } = TDGeo;
    const R = rng(91), parts = [], fuzz = (y, ny, Rr) => mixc(mixc(col(0xdcab72), col(0xf0bf82), Rr()), col(0xf8ecd0), Rr() * Rr() * .8);
    const n = 6 + ((R() * 3) | 0);
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2 + R() * .7, d = k === 0 ? 0 : .13 + R() * .17, r = .085 + R() * .045, h = .55 + R() * .75 * (1 - d * 1.5);
      const x = Math.cos(a) * d, z = Math.sin(a) * d, lx = (R() - .5) * .16, lz = (R() - .5) * .16;
      parts.push({ g: new THREE.CylinderGeometry(r, r * 1.1, h, 18, 5), m: mat4(x, h / 2, z, 1, 1, 1, 0, lz, -lx), cfn: fuzz, j: .2 });
      parts.push({ g: new THREE.SphereGeometry(r, 18, 6, 0, Math.PI * 2, 0, Math.PI / 2), m: mat4(x - lx * h * .5, h, z + lz * h * .5, 1, 1.25, 1, 0, lz, -lx), cfn: fuzz, j: .2 });
    }
    parts.push({ g: displace(new THREE.IcosahedronGeometry(.32, 1), .3, 4), m: mat4(0, .04, 0, 1.2, .3, 1.2), cfn: (y, ny, Rr) => mixc(col(0x8a8378), col(0x9d7a58), Rr()), j: .12 });
    return makeGeo(parts, 91, { ao: .6, smooth: 50 });
  },
});

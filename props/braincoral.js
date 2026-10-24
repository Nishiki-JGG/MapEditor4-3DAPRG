// ノウサンゴ（braincoral）：ほぼ球のドームに、迷路のように曲がりくねった溝と稜。黄土色（参考：グルーヴド・ブレインコーラル Diploria labyrinthiformis）
TDProps.add({
  id: 'braincoral', name: 'ノウサンゴ',
  r: .45, min: 1.3, sc: [.6, 1.4], slope: .6, vis: .6, anyGround: true, water: [.25, 3],
  tags: ['beach'], height: .78,
  build() {
    const { col, mixc, mat4, displace, makeGeo } = TDGeo;
    const R0 = .5, SY = .82, CUT = .62;   // radius, flattening, how far round the dome goes (π × CUT: a little under the equator)
    // the maze: ridges where a warped pair of waves crosses zero
    const maze = (x, y, z) => {
      const u = Math.sin(9 * x + 3 * Math.sin(6 * y + 1.3) + 2 * Math.sin(7 * z + .4)) + Math.sin(9 * z + 3 * Math.sin(6 * x + .7) + 1.7 * Math.sin(8 * y));
      return 1 - Math.min(1, Math.abs(u) / .45);   // 1 on a ridge, 0 in a valley
    };
    const g = new THREE.SphereGeometry(R0, 56, 32, 0, Math.PI * 2, 0, Math.PI * CUT), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), l = Math.hypot(x, y, z) || 1, k = 1 + .045 * (maze(x / l, y / l, z / l) - .5);
      p.setXYZ(i, x * k, y * k * SY, z * k);
    }
    const lift = -Math.cos(Math.PI * CUT) * R0 * SY;   // the dome's lowest edge on the ground
    const ridge = col(0xd9a441), valley = col(0x8f5f22), polyp = col(0xb98a3c);
    const cfn = (y, ny, R, pr, cx, cz) => {
      const l = Math.hypot(cx, y - lift, cz) || 1, m = maze(cx / l, (y - lift) / l / SY, cz / l);
      return mixc(mixc(valley, polyp, R() * .5), ridge, m);
    };
    const parts = [{ g, m: mat4(0, lift, 0, 1, 1, 1), cfn, j: .08 }];
    // the rock it grew on, with a little red encrusting algae
    parts.push({ g: displace(new THREE.IcosahedronGeometry(.42, 1), .35, 7), m: mat4(0, .02, 0, 1.25, .22, 1.15), cfn: (y, ny, R) => mixc(col(0x8d8a80), col(0xa85a5e), R() * .45), j: .12 });
    return makeGeo(parts, 61, { smooth: 40 });
  },
});

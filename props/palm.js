// ヤシ（palm）
TDProps.add({
  id: 'palm', name: 'ヤシ',
  r: .35, min: 2.6, sc: [.8, 1.25], slope: .7, vis: 2, anyGround: true, sway: 1,
  tags: ['beach', 'jungle'], height: 4.77, material: 'foliage', canopy: true,
  build() {
    const { clamp, rng, col, mixc, mat4, makeGeo, petalGeo, basisAt, limb } = TDGeo;
    const R = rng(71), parts = [];
    const bark = (y, ny, Rr) => mixc(col(0x6b5236), col(0x9a7a52), (Math.floor(y / .29) % 2 ? .65 : .2) + Rr() * .3);
    const leaf = (y, ny, Rr, pr) => mixc(col(0x2e7a2e), col(0x7ab848), clamp(pr * .5 + Rr() * .4, 0, 1));
    let x = 0, y = 0;
    for (let k = 0; k < 8; k++) { const h = .58, bend = k * .065; limb(parts, [x, y - .04, 0], [x + Math.sin(bend) * (h + .04), y + Math.cos(bend) * (h + .04), 0], .16 - k * .008, .13 - k * .008, 7, bark, { j: .06 }); x += Math.sin(bend) * h; y += Math.cos(bend) * h; }
    const C = [x, y - .4, 0];
    for (let f = 0; f < 9; f++) {
      const a = f / 9 * 6.283 + R() * .3, L = 2.0 + R() * .5, segs = 7, len = L / segs;
      let px = x, py = y, pz = 0;
      for (let s = 0; s < segs; s++) {
        const t = (s + .5) / segs, ang = .35 - 1.4 * t * t, dir = [Math.cos(a) * Math.cos(ang), Math.sin(ang), Math.sin(a) * Math.cos(ang)];
        px += dir[0] * len; py += dir[1] * len; pz += dir[2] * len;
        const side = [-Math.sin(a), 0, Math.cos(a)], ll = .62 * Math.sin(Math.PI * (.15 + t * .8));
        for (const sd of [-1, 1]) parts.push({ g: petalGeo(ll, .17, .3), m: basisAt([px, py, pz], [side[0] * sd + dir[0] * .7, -.45, side[2] * sd + dir[2] * .7], [0, 1, 0]), cfn: leaf, j: .1, sn: C, snw: .55 });
      }
    }
    for (let k = 0; k < 3; k++) parts.push({ g: new THREE.IcosahedronGeometry(.11, 0), m: mat4(x + Math.cos(k * 2.1) * .15, y - .12, Math.sin(k * 2.1) * .15, 1, 1, 1), c: col(0x5a3e1e) });
    return makeGeo(parts, 71, { ao: 1.2 });
  },
});

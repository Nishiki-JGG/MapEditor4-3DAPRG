// 広葉樹（oak）
TDProps.add({
  id: 'oak', name: '広葉樹',
  r: .6, min: 3.2, sc: [.8, 1.3], slope: .8, vis: 2.1, tree: true,
  sway: .5, tags: ['grassland', 'forest', 'jungle', 'ruins', 'beach'], height: 5.53, material: 'foliage', canopy: true,
  build() {
    const { clamp, rng, col, mixc, mat4, displace, makeGeo, leafGeo, basisAt, limb } = TDGeo;
    // trunk with root flare and branches into a canopy of clumps; leaf blades break up the outline
    const R = rng(112), parts = [], C = [.05, 3.75, 0];
    const bark = (y, ny, Rr) => mixc(col(0x4a3220), col(0x705236), Rr());
    const leaf = (y, ny, Rr, pr) => mixc(mixc(col(0x24561f), col(0x3d7f2a), pr), mixc(col(0x6fa53c), col(0x9cc552), pr), clamp((y - 2.6) / 2.6 + (Rr() - .5) * .1, 0, 1));
    limb(parts, [0, -.1, 0], [.05, 2.9, 0], .34, .19, 7, bark, { j: .08 });
    for (let k = 0; k < 4; k++) { const a = k * 1.57 + .4; limb(parts, [Math.cos(a) * .12, .45, Math.sin(a) * .12], [Math.cos(a) * .62, -.05, Math.sin(a) * .62], .14, .05, 5, bark); }
    const clumps = [[0, 3.85, 0, 1.45, 1], [1.1, 3.35, .5, 1.05], [-1.05, 3.45, -.45, 1.1], [.35, 4.55, -.5, 1.0], [-.45, 4.3, .9, .95], [.95, 3.0, -.9, .85], [-.9, 3.0, .75, .85]];
    clumps.slice(1, 6).forEach(([x, y, z]) => limb(parts, [.04, 2.4, 0], [x * .7, y - .35, z * .7], .12, .05, 5, bark));
    clumps.forEach(([x, y, z, r, big], k) => parts.push({ g: displace(new THREE.IcosahedronGeometry(1, big ? 1 : 0), .22, k * 3.1), m: mat4(x, y, z, r, r * .82, r, k), cfn: leaf, j: .05, sn: C, snw: .9 }));
    for (let k = 0; k < 34; k++) {
      const [x, y, z, r] = clumps[k % clumps.length], th = R() * 6.283, ph = .2 + R() * 1.6, d = [Math.cos(th) * Math.sin(ph), Math.cos(ph) * .82, Math.sin(th) * Math.sin(ph)];
      const p = [x + d[0] * r * .86, y + d[1] * r * .86, z + d[2] * r * .86], out = [d[0], d[1] * .4 - .25, d[2]];
      parts.push({ g: leafGeo(.55, .34, .25, .08), m: basisAt(p, out, [d[0] * .5, 1, d[2] * .5], .85 + R() * .4), cfn: leaf, j: .12, sn: C, snw: .7 });
    }
    return makeGeo(parts, 12, { ao: 1.4 });
  },
});

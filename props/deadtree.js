// 枯れ木（deadtree）
TDProps.add({
  id: 'deadtree', name: '枯れ木',
  r: .3, min: 2.4, sc: [.8, 1.3], slope: .8, vis: 1.1, anyGround: true,
  sway: .2, tags: ['wasteland', 'desert', 'volcano', 'castle', 'snow', 'demon', 'ruins', 'graveyard'], height: 3.44,
  build() {
    const { lerp, rng, col, mixc, mat4, displace, makeGeo, limb } = TDGeo;
    const R = rng(45), bark = (y, ny, Rr) => mixc(col(0x4a4038), col(0x7a6e62), Rr());
    const parts = [{ g: displace(new THREE.CylinderGeometry(.1, .3, 3.4, 7, 3), .12, 1.9), m: mat4(0, 1.7, 0, 1, 1, 1, 0, .05, .04), cfn: bark, j: .1 }];
    [[1.5, .9, .7, 1.1], [2.1, -.8, 2.2, .9], [2.6, .7, 3.9, .8], [3.0, -.6, 5.1, .6], [1.1, .8, 4.5, .7]].forEach(([y, tilt, ry, L]) => {
      const d = [Math.sin(ry) * Math.sin(Math.abs(tilt)), Math.cos(tilt), Math.cos(ry) * Math.sin(Math.abs(tilt))], a = [0, y, 0], b = [d[0] * L, y + d[1] * L * .8, d[2] * L];
      limb(parts, a, b, .08, .03, 5, bark);
      limb(parts, [lerp(a[0], b[0], .6), lerp(a[1], b[1], .6), lerp(a[2], b[2], .6)], [b[0] * 1.15 + (R() - .5) * .4, b[1] + .1, b[2] * 1.15 + (R() - .5) * .4], .03, .01, 4, bark);
    });
    for (let k = 0; k < 3; k++) { const a = k * 2.1 + .3; limb(parts, [Math.cos(a) * .1, .35, Math.sin(a) * .1], [Math.cos(a) * .55, -.05, Math.sin(a) * .55], .1, .03, 5, bark); }
    return makeGeo(parts, 45, { ao: .8 });
  },
});

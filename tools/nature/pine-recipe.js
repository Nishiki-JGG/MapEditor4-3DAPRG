// 針葉樹（pine）
TDProps.add({
  id: 'pine', name: '針葉樹',
  r: .45, min: 1.7, sc: [.8, 1.4], slope: .9, vis: 1.5, tree: true,
  sway: .6, tags: ['forest', 'mountain', 'canyon', 'snow', 'castle', 'graveyard'], height: 6.09, material: 'cards', canopy: true,
  build() {
    const { rng, col, mixc, clamp, makeGeo, limb, quadGeo, ATLAS } = TDGeo;
    // a straight trunk with whorls of drooping branches; each branch is a needle spray on two cards (flat and tilted)
    const R = rng(11), parts = [], bark = (y, ny, Rr) => mixc(col(0xb89c84), col(0xd0b49a), Rr());
    limb(parts, [0, 0, 0], [0, 5.6, 0], .26, .05, 7, bark, { uvr: ATLAS.uvr('bark'), j: .05 });
    const needle = (y, ny, Rr, pr, cx, cz) => mixc(col(0x56705e), col(0x94ac90), clamp(Math.hypot(cx, cz) / 1.6 * .8 + y * .04 + (pr - .5) * .2, 0, 1));
    const card = (base, dir, side, L, Wd, tilt) => {
      const X = new THREE.Vector3(...dir).normalize(), Y = new THREE.Vector3(...side).normalize().multiplyScalar(Math.cos(tilt)).addScaledVector(new THREE.Vector3().crossVectors(X, new THREE.Vector3(...side)).normalize(), Math.sin(tilt));
      const Z = new THREE.Vector3().crossVectors(X, Y).normalize(); if (Z.y < 0) { Y.negate(); Z.negate(); }
      const m = new THREE.Matrix4().makeBasis(X.clone().multiplyScalar(L), Y.clone().multiplyScalar(Wd), Z).setPosition(base[0] + X.x * L / 2, base[1] + X.y * L / 2, base[2] + X.z * L / 2);
      // Keep every card corner above the clearance plane, including tilted sprays.
      const test=quadGeo(1,1).applyMatrix4(m).attributes.position; let lo=Infinity;
      for(let i=0;i<test.count;i++) lo=Math.min(lo,test.getY(i));
      m.elements[13]+=Math.max(0,2.15-lo);
      parts.push({ g: quadGeo(1, 1), m, cfn: needle, uvr: ATLAS.uvr('needle'), j: .06, sn: [0, base[1] - 1.2, 0], snw: .55 });
    };
    const levels = 12;
    for (let lv = 4; lv < levels; lv++) {
      const t = lv / (levels - 1), y = 1.1 + t * 4.7, L = 2.0 * (1 - t) + .45, n = lv > 9 ? 4 : 5;
      for (let k = 0; k < n; k++) {
        const a = lv * 1.13 + k * 6.283 / n + (R() - .5) * .4, droop = -.32 + t * .55 + (R() - .5) * .1;
        const dir = [Math.cos(a), droop, Math.sin(a)], side = [-Math.sin(a), 0, Math.cos(a)];
        if (lv < 3) limb(parts, [0, y, 0], [dir[0] * L * .7, y + droop * L * .7, dir[2] * L * .7], .06, .02, 4, bark, { uvr: ATLAS.uvr('bark') });
        card([0, y, 0], dir, side, L * 1.15, L * .9 + .3, 0);
        if (lv % 2 === 0) card([0, y + .05, 0], dir, side, L, L * .7 + .3, 1.0 * (R() < .5 ? 1 : -1));   // a tilted spray on every other whorl gives depth
      }
    }
    for (let k = 0; k < 3; k++) { const a = k * 2.1; card([0, 5.7, 0], [Math.cos(a) * .35, 1, Math.sin(a) * .35], [-Math.sin(a), 0, Math.cos(a)], .75, .45, 0); }
    return makeGeo(parts, 11, { ao: 1.6, uv: ATLAS.white });
  },
});

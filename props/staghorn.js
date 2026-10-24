// 枝状ミドリイシ（staghorn）：太い枝が上へ伸びて二股に分かれ、鹿の角のような茂みになる。枝先は白っぽい（参考：スタッグホーンコーラル Acropora cervicornis）
TDProps.add({
  id: 'staghorn', name: '枝状ミドリイシ',
  r: .5, min: 1.4, sc: [.6, 1.3], slope: .6, vis: .7, anyGround: true, water: [.3, 3],
  tags: ['beach'], height: 1.05,
  build() {
    const { rng, col, mixc, makeGeo } = TDGeo;
    const R = rng(73), parts = [], up = new THREE.Vector3(0, 1, 0);
    const base = col(0x8d6a43), mid = col(0xb79466), tip = col(0xeee3c8);
    // one branch: a tapered cylinder from p along dir; forks in two near its end, the tips paler
    const branch = (p, dir, len, rad, depth, t0) => {
      const q = new THREE.Quaternion().setFromUnitVectors(up, dir), e = p.clone().addScaledVector(dir, len), c = p.clone().add(e).multiplyScalar(.5);
      const t1 = t0 + (1 - t0) * .45, last = depth === 0;
      parts.push({ g: new THREE.CylinderGeometry(rad * (last ? .55 : .8), rad, len, 6, 2), m: new THREE.Matrix4().compose(c, q, new THREE.Vector3(1, 1, 1)), cfn: (y, ny, Rr) => last ? mixc(mid, tip, .55 + Rr() * .35) : mixc(base, mid, t1 + (Rr() - .5) * .2), j: .1 });
      if (last) { parts.push({ g: new THREE.SphereGeometry(rad * .55, 5, 3), m: new THREE.Matrix4().compose(e, q, new THREE.Vector3(1, 1, 1)), cfn: () => tip, j: .06 }); return; }
      const side = new THREE.Vector3(R() - .5, 0, R() - .5).normalize();
      for (const s of [-1, 1]) {
        const a = (.26 + R() * .2) * s, nd = dir.clone().applyAxisAngle(side, a).lerp(up, .35).normalize();
        branch(e, nd, len * (.7 + R() * .18), rad * .8, depth - 1, t1);
      }
    };
    const n = 13 + ((R() * 4) | 0);
    for (let k = 0; k < n; k++) {
      const az = k / n * Math.PI * 2 * 1.618 + R() * .6, tilt = .06 + R() * .32, dir = new THREE.Vector3(Math.sin(tilt) * Math.cos(az), Math.cos(tilt), Math.sin(tilt) * Math.sin(az));
      const d0 = .05 + R() * .16;
      branch(new THREE.Vector3(Math.cos(az) * d0, 0, Math.sin(az) * d0), dir, .26 + R() * .14, .05 + R() * .015, 2 + (R() < .5 ? 1 : 0), 0);
    }
    parts.push({ g: new THREE.SphereGeometry(.16, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), m: new THREE.Matrix4().makeScale(1.2, .5, 1.2), cfn: () => base, j: .1 });
    return makeGeo(parts, 73, { ao: .5 });
  },
});

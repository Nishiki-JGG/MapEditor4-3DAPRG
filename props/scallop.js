// ホタテの殻（scallop）：扇形の片殻。放射状の筋（肋）と波形の縁、蝶番の両側に小さな「耳」。クリーム色に橙〜桃色の帯（参考：Argopecten irradians の写真）
TDProps.add({
  id: 'scallop', name: 'ホタテの殻',
  r: 0, min: .35, sc: [.9, 1.5], slope: .6, vis: .2, anyGround: true, shore: [-.05, .45], groundSink: .004,
  tags: ['beach'], height: .02,
  build() {
    const { col, mixc, makeGeo } = TDGeo;
    const R0 = .07, SPAN = 1.15, RIBS = 17, nA = 40, nR = 7, H = .014, P = [];
    // the valve on a polar grid from the hinge: a low dome, ribs as ridges, the edge waved by them
    const pt = (i, j) => {
      const a = (i / nA - .5) * 2 * SPAN, t = j / nR, rib = Math.abs(Math.sin(RIBS * a / 2 + .3)), r = R0 * t * (1 + .04 * rib * t);
      return [Math.sin(a) * r, H * Math.sqrt(Math.max(0, 1 - t * t)) * .9 + .0025 * rib * t + .001, -Math.cos(a) * r + R0 * .45, rib, t];
    };
    for (let i = 0; i < nA; i++) for (let j = 0; j < nR; j++) {
      const a = pt(i, j), b = pt(i + 1, j), c = pt(i, j + 1), d = pt(i + 1, j + 1);
      P.push(a, b, c, b, d, c);   // facing up
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P.flatMap(v => v.slice(0, 3)), 3));
    const cream = col(0xf1e2c8), band = col(0xe39a6a), pink = col(0xe7a9a0), groove = col(0xb79a78);
    const cfn = (y, ny, R, pr, cx, cz) => {
      const r = Math.hypot(cx, cz - R0 * .45) / R0, a = Math.atan2(cx, -(cz - R0 * .45)), rib = Math.abs(Math.sin(RIBS * a / 2 + .3));
      const c0 = mixc(cream, Math.sin(r * 19) > .3 ? band : pink, .55 + .3 * Math.sin(r * 7));
      return mixc(groove, c0, .55 + .45 * rib);
    };
    // the ears either side of the hinge
    const ear = s => {
      const i = s < 0 ? 0 : nA, edge = [pt(i, 0), pt(i, 1), pt(i, 2)];
      const outer = [s * .022, edge[0][1] - .002, R0 * .45 + .004], vertices = [];
      // 主殻の既存の側縁2辺をそのまま共有し、蝶番との離れをなくす。
      for (let j = 0; j < 2; j++) {
        const tri = [outer, edge[j].slice(0, 3), edge[j + 1].slice(0, 3)];
        const a = new THREE.Vector3(...tri[0]), n = new THREE.Vector3(...tri[1]).sub(a).cross(new THREE.Vector3(...tri[2]).sub(a));
        if (n.y < 0) [tri[1], tri[2]] = [tri[2], tri[1]];
        vertices.push(...tri.flat());
      }
      const e = new THREE.BufferGeometry(); e.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); return e;
    };
    return makeGeo([{ g, m: new THREE.Matrix4(), cfn, j: .05 }, { g: ear(1), m: new THREE.Matrix4(), c: cream, j: .05 }, { g: ear(-1), m: new THREE.Matrix4(), c: cream, j: .05 }], 81);
  },
});

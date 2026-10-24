// ウミウチワ（seafan）：縦に平たい扇。根元の短い柄から太い枝が放射状に広がり、その間を細かい網目が埋める。紫（参考：コモンシーファン Gorgonia ventalina）
// 網目は、扇形の薄い膜（表と裏）に網の目の斑点の色を付けて描き、その上に枝を重ねる（穴の透けは無い）
TDProps.add({
  id: 'seafan', name: 'ウミウチワ',
  r: .15, min: 1.2, sc: [.6, 1.3], slope: .7, vis: .6, anyGround: true, water: [.4, 3], sway: .25,
  tags: ['beach'], height: 1.1,
  build() {
    const { rng, col, mixc, mat4, displace, makeGeo } = TDGeo;
    const R = rng(37), parts = [], C0 = col(0xc46fd6), C1 = col(0xefbdf5), HOLE = col(0x8a4a98);
    const stem = [0, .14], SPAN = 2.3, LEN = .86;
    // the membrane: a fan of thin wedges, its outline a little uneven; the net of holes is in the colours
    const net = (x, y) => { const u = Math.sin(x * 61 + Math.sin(y * 23) * 2) * Math.sin(y * 57 + Math.sin(x * 19) * 2); return u > .7 ? 1 : 0; };
    const fanC = (y, ny, Rr, pr, cx) => net(cx, y) ? mixc(HOLE, C0, Rr() * .4) : mixc(C0, C1, Rr() * .6 + Math.min(1, y) * .2);
    const shape = new THREE.Shape(), m = 28;
    shape.moveTo(0, stem[1]);
    for (let k = 0; k <= m; k++) {
      const a = (k / m - .5) * SPAN, r = LEN * (.88 + .12 * Math.sin(k * 1.7) * Math.sin(k * .6 + 1));
      shape.lineTo(Math.sin(a) * r * 1.05, stem[1] + Math.cos(a) * r * .95);
    }
    shape.lineTo(0, stem[1]);
    const fan = new THREE.ShapeGeometry(shape, 1);
    // finer triangles so the net's colours have room to show
    const fine = g => { let geo = g.toNonIndexed(); for (let pass = 0; pass < 3; pass++) {
      const p = geo.attributes.position, out = [];
      for (let i = 0; i < p.count; i += 3) {
        const A = [p.getX(i), p.getY(i), 0], B = [p.getX(i + 1), p.getY(i + 1), 0], C = [p.getX(i + 2), p.getY(i + 2), 0], mid = (u, v) => [(u[0] + v[0]) / 2, (u[1] + v[1]) / 2, 0];
        const ab = mid(A, B), bc = mid(B, C), ca = mid(C, A);
        out.push(...A, ...ab, ...ca, ...ab, ...B, ...bc, ...ca, ...bc, ...C, ...ab, ...bc, ...ca);
      }
      geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
    } return geo; };
    const membrane = fine(fan);
    parts.push({ g: membrane, m: mat4(0, 0, 0, 1, 1, 1), cfn: fanC, j: .1 });
    parts.push({ g: membrane, m: mat4(0, 0, -.004, 1, 1, 1, Math.PI), cfn: fanC, j: .1 });   // the back face
    // the main branches over it, both sides, thicker near the stem
    const rod = (a, b, th) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
      parts.push({ g: new THREE.BoxGeometry(th, len, th * 1.6), m: mat4((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0, 1, 1, 1, 0, 0, -Math.atan2(dx, dy)), cfn: (y, ny, Rr) => mixc(C0, C1, Rr() * .35), j: .06 });
    };
    rod([0, 0], stem, .05);
    for (let k = 0; k < 9; k++) {
      const ang = (k / 8 - .5) * SPAN * .92 + (R() - .5) * .06, len = LEN * (.8 + R() * .12);
      let prev = stem;
      for (let s = 1; s <= 4; s++) { const t = s / 4, a = ang * (1 - .2 * (1 - t)), pt = [Math.sin(a) * len * t * 1.05, stem[1] + Math.cos(a) * len * t * .95]; rod(prev, pt, s < 2 ? .028 : .016); prev = pt; }
    }
    // holdfast on a small rock
    parts.push({ g: displace(new THREE.IcosahedronGeometry(.13, 1), .3, 2), m: mat4(0, .02, 0, 1.3, .5, 1.1), cfn: (y, ny, Rr) => mixc(col(0x6f3a7a), col(0x8a8378), Rr()), j: .1 });
    return makeGeo(parts, 37);
  },
});

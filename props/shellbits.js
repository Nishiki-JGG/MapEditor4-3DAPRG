// 貝のかけら（shellbits）：白・クリーム・淡い桃色の小さな殻の破片が散らばる（種は特定しない。打ち寄せられて割れた殻）
TDProps.add({
  id: 'shellbits', name: '貝のかけら',
  r: 0, min: .4, sc: [.8, 1.5], slope: .6, vis: .3, anyGround: true, shore: [-.05, .45], groundSink: .003,
  tags: ['beach'], height: .016,
  build() {
    const { rng, col, mixc, mat4, displace, makeGeo } = TDGeo;
    const R = rng(85), parts = [], cs = [col(0xf5efe4), col(0xeedfc9), col(0xeec2b4), col(0xd9cdb8)];
    for (let k = 0; k < 15; k++) {
      const a = R() * 6.28, d = Math.sqrt(R()) * .28, s = .012 + R() * .02;
      parts.push({ g: displace(new THREE.IcosahedronGeometry(1, 0), .5, k), m: mat4(Math.cos(a) * d, s * .25, Math.sin(a) * d, s * (1 + R()), s * .35, s * (.7 + R() * .6), R() * 6.28), c: mixc(cs[k % 4], cs[(k + 1) % 4], R() * .4), j: .08 });
    }
    return makeGeo(parts, 85);
  },
});

// 小舟（rowboat）
TDProps.add({
  id: 'rowboat', name: '小舟',
  r: .55, offs: [-.8, 0, .8], min: 3, sc: [.9, 1.1], slope: .6, vis: 1.3, anyGround: true,
  tags: ['beach'], height: 0.62, material: 'cards2',
  build() {
    const { col, mixc, mat4, makeGeo, ATLAS2 } = TDGeo;
    // a planked hull lofted from cross-sections (pointed bow and stern, round bilge), grain along the planks,
    // with gunwales, thwarts and an oar resting across (atlas 2 wood; the hull is one surface seen from both sides)
    const wood = (y, ny, R, pr) => mixc(col(0xb09878), col(0xe0ccac), pr);
    const hull = () => {
      const N = 14, M = 9, L = 1.35, P = [], U = [], at = (i, j) => {
        const t = i / N * 2 - 1, w = .64 * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(t), 2.6)), .55), th = (j / M - .5) * Math.PI;
        const sheer = .5 + .1 * t * t, depth = .42 * (1 - .35 * t * t);
        return [t * L, sheer - depth * Math.cos(th), w * Math.sin(th)];
      };
      for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
        const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1), ua = [j / M, i / N], ub = [j / M, (i + 1) / N], uc = [(j + 1) / M, (i + 1) / N], ud = [(j + 1) / M, i / N];
        P.push(...a, ...b, ...c, ...a, ...c, ...d); U.push(...ua, ...ub, ...uc, ...ua, ...uc, ...ud);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); return g;
    };
    const parts = [{ g: hull(), m: new THREE.Matrix4(), cfn: wood, uvr: ATLAS2.uvr('wood'), j: .04 }];
    for (const s of [-1, 1]) parts.push({ g: new THREE.CylinderGeometry(.025, .025, 2.5, 5), m: mat4(0, .52, s * .6, 1, 1, 1, 0, 0, Math.PI / 2), c: col(0x5a4632) });   // gunwales
    for (const [x, w] of [[-.55, .54], [.35, .58]]) parts.push({ g: new THREE.BoxGeometry(.2, .04, w * 2), m: mat4(x, .4, 0, 1, 1, 1), cfn: wood, uvr: ATLAS2.uvr('wood') });
    parts.push({ g: new THREE.CylinderGeometry(.022, .022, 1.9, 5), m: mat4(.05, .45, .2, 1, 1, 1, .32, 0, Math.PI / 2 + .1), cfn: wood, uvr: ATLAS2.uvr('wood') });
    parts.push({ g: new THREE.BoxGeometry(.42, .02, .14), m: mat4(.95, .54, .52, 1, 1, 1, .32, 0, .1), cfn: wood, uvr: ATLAS2.uvr('wood') });
    return makeGeo(parts, 72, { ao: .35, uv: ATLAS2.white });
  },
});

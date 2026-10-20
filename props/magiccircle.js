// 魔法陣（magiccircle）
TDProps.add({
  id: 'magiccircle', name: '魔法陣',
  r: 0, min: 4, sc: [.8, 1.3], slope: .25, vis: 1.6, anyGround: true, light: [0xa060ff, 16, .5],
  tags: ['demon', 'ruins', 'cave'], height: 0.07,
  build() {
    const { col, mat4, makeGeo } = TDGeo;
    const parts = [], glowC = () => col(0xb070ff);
    for (const [r, t] of [[1.5, .04], [1.15, .03], [.45, .025]]) parts.push({ g: new THREE.TorusGeometry(r, t, 3, 40), m: mat4(0, .04, 0, 1, 1, 1, 0, Math.PI / 2), c: glowC(), glow: 2 });
    for (let k = 0; k < 5; k++) { const a0 = k * 4 * Math.PI / 5 + Math.PI / 2, a1 = (k + 1) * 4 * Math.PI / 5 + Math.PI / 2, x0 = Math.cos(a0) * 1.15, z0 = Math.sin(a0) * 1.15, x1 = Math.cos(a1) * 1.15, z1 = Math.sin(a1) * 1.15, L = Math.hypot(x1 - x0, z1 - z0);
      parts.push({ g: new THREE.BoxGeometry(L, .02, .04), m: mat4((x0 + x1) / 2, .045, (z0 + z1) / 2, 1, 1, 1, -Math.atan2(z1 - z0, x1 - x0)), c: glowC(), glow: 2 }); }
    for (let k = 0; k < 12; k++) { const a = k / 12 * 6.283; parts.push({ g: new THREE.BoxGeometry(.12, .02, .06), m: mat4(Math.cos(a) * 1.33, .045, Math.sin(a) * 1.33, 1, 1, 1, -a + (k % 3) * .7), c: glowC(), glow: 1.6 }); }
    return makeGeo(parts, 93);
  },
});

// 原因の切り分け用（PLAN_03 の 1 回目の不合格）：切り替えない一定の速さで、つま先（腰から見た位置）と膝の角度の 1 コマの変化の最大を測り、
// 切り替えの前後の値と並べる。node tests/hero_switch_baseline.js
const path = require('path'); const { withPage } = require('./cdp');
(async () => {
  const url = 'file:///' + path.resolve(__dirname, '../index.html').split(path.sep).join('/') + '#size=64';
  const r = await withPage(url, async p => p.eval(`(() => {
    const A = window.__app, b = A.heroBody, sk = b.skeleton, DT = 1 / 60; A.setMode('edit');
    const wp = o => o.getWorldPosition(new THREE.Vector3()), B = n => sk.getBoneByName(n);
    const step = v => { b.animate(DT, v); b.group.updateMatrixWorld(true); };
    const settle = () => { for (let i = 0; i < 90; i++) step(0); };
    const knee = (u, l, f) => { const a = wp(B(u)), k = wp(B(l)), c = wp(B(f)); return a.sub(k).angleTo(c.sub(k)) * 180 / Math.PI; };
    const pose = () => { const h = wp(B('Hips')); return { kl: knee('LeftUpLeg', 'LeftLeg', 'LeftFoot'), kr: knee('RightUpLeg', 'RightLeg', 'RightFoot'), tl: wp(B('LeftToeBase')).sub(h), tr: wp(B('RightToeBase')).sub(h) }; };
    const run = (speeds, pre) => { settle(); for (let i = 0; i < pre; i++) step(speeds[0]); let prev = pose(), kn = 0, toe = 0, at = -1;
      for (let i = 0; i < speeds.length * 0 + 36; i++) { step(i < 18 ? speeds[0] : speeds[1]); const q = pose(); const t = Math.max(q.tl.distanceTo(prev.tl), q.tr.distanceTo(prev.tr)); if (t > toe) { toe = t; at = i; }
        kn = Math.max(kn, Math.abs(q.kl - prev.kl), Math.abs(q.kr - prev.kr)); prev = q; }
      return { kneeDeg: +kn.toFixed(1), toeM: +toe.toFixed(3), toeAtFrame: at, switchAt: 18 }; };
    const out = {}, worst = sp => { let w = { toeM: 0 }; for (let k = 0; k < 60; k++) { const r = run(sp, 60 + k); if (r.toeM > w.toeM) w = { ...r, pre: 60 + k }; } return w; };
    for (const v of [2.5, 5, 8]) out['steady_' + v] = worst([v, v]);
    for (const [a, c] of [[5, 2.5], [2.5, 5], [5, 8], [8, 5]]) out['switch_' + a + '_' + c] = worst([a, c]);
    return out; })()`), { wait: 7000 });
  console.log(JSON.stringify(r, null, 1));
})();

// 主人公の体（hero/）の試験：ヘッドレスのブラウザでエディターを開き、Remy が読めて、ゲームと同じ大きさで、正しい向きに立つかを確かめ、画像を撮る。
// 歩くモードに入って見た目を切り替えた後も、書き出しのバイト列が変わらないことも見る。
//   node tests/hero_view.js <出力フォルダ>
const fs = require('fs'), path = require('path'), crypto = require('crypto'); const { withPage } = require('./cdp');
const sleep = ms => new Promise(r => setTimeout(r, ms));
// 書き出しの全ファイル（manifest・meta の書き出し時刻は除く）を、名前→SHA-256 にする
const EXPORT = `(async () => { const e = await window.__app.buildExport(); const out = {};
  for (const f of e.files) { let b = typeof f.data === 'string' ? new TextEncoder().encode(f.data) : f.data;
    if (/\\.json$/.test(f.name)) { try { const j = JSON.parse(new TextDecoder().decode(b)); const strip = o => { if (o && typeof o === 'object') { delete o.exportedAt; Object.values(o).forEach(strip); } }; strip(j); b = new TextEncoder().encode(JSON.stringify(j)); } catch (_) {} }
    let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192)); out[f.name] = btoa(s); }
  return out; })()`;
const shas = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, crypto.createHash('sha256').update(Buffer.from(v, 'base64')).digest('hex')]));
(async () => {
  const out = path.resolve(process.argv[2] || path.join(__dirname, 'hero_view_out')); fs.mkdirSync(out, { recursive: true });
  const url = 'file:///' + path.resolve(__dirname, '../index.html').split(path.sep).join('/') + '#size=64';
  let fail = 0; const rows = [];
  const check = (name, ok, info) => { rows.push({ name, ok: !!ok, info }); console.log(ok ? 'PASS' : 'FAIL', name, info !== undefined ? JSON.stringify(info) : ''); if (!ok) fail++; };
  const res = await withPage(url, async p => {
    const loadMs = await p.eval("Math.round(performance.getEntriesByType('navigation')[0].loadEventEnd)");
    await p.eval("window.__app.genSample(); window.__app.updateTerrain(); 1");
    const before = shas(await p.eval(EXPORT));
    await p.eval("window.__app.setMode('play'); 1");
    // テクスチャは非同期に読まれる：7 枚が揃うまで待つ（最大 15 秒）
    let ready = false; for (let i = 0; i < 60 && !ready; i++) { ready = await p.eval("!!window.__app.heroBody && window.__app.heroBody.mats.every(m => m.map && m.map.image && m.map.image.complete && m.map.image.naturalWidth > 0)"); if (!ready) await sleep(250); }
    await sleep(1500);
    const a = await p.eval(`(() => {
      const A = window.__app, b = A.heroBody; if (!b) return { body: false };
      A.update(1 / 60);   // 人形の位置はエディターの更新の中で足元に置かれる。ヘッドレスは描画が遅く、まだ 1 回も更新が走っていないことがあった（PLAN_03 の 5 回目）
      A.hero.updateMatrixWorld(true); b.group.children.forEach(m => m.isSkinnedMesh && m.computeBoundingBox());   // 骨付きは今の姿勢で測り直す
      const box = new THREE.Box3().setFromObject(b.group), eyes = b.group.getObjectByName('Eyes');
      const eb = new THREE.Box3().setFromObject(eyes);
      // 向き：顔（目）が、体の中心から見て hero の前（ローカル +Z を回した向き）にあるか
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(A.hero.quaternion), c = box.getCenter(new THREE.Vector3()), e = eb.getCenter(new THREE.Vector3());
      const facing = e.clone().sub(c).setY(0).normalize().dot(fwd);
      return { body: true, parts: b.group.children.filter(o => o.isMesh).length, look: A.heroLook, select: document.getElementById('heroLook').value, label: document.getElementById('heroLookRemy').textContent,
        height: +(box.max.y - box.min.y).toFixed(3), feet: +(box.min.y - A.hero.position.y).toFixed(3), ground: +(box.min.y - A.floorAt(A.player.x, A.player.z)).toFixed(3), width: +(box.max.x - box.min.x).toFixed(3), depth: +(box.max.z - box.min.z).toFixed(3),
        facing: +facing.toFixed(3), eyesY: +(e.y - A.hero.position.y).toFixed(3), opaque: b.mats.every(m => !m.transparent),
        boxHidden: !A.hero.children[0].visible, bodyShown: b.group.visible, meta: b.meta };
    })()`);
    check('Remy のデータが読めた（部品 7）', a.body && a.parts === 7, a.parts);
    check('テクスチャ 7 枚の読み込みが終わった', ready, ready);
    check('既定の見た目が Remy（選択欄も同じ）', a.look === 'remy' && a.select === 'remy' && a.boxHidden && a.bodyShown, { look: a.look, select: a.select, label: a.label });
    check('身長がゲームと同じ 1.70〜1.74m', a.height >= 1.70 && a.height <= 1.74, a.height);
    check('足の裏が立つ位置（±2cm）', Math.abs(a.feet) <= .02, a.feet);
    check('足の裏が地面の高さ（floorAt）から ±2cm', Math.abs(a.ground) <= .02, a.ground);
    check('顔が進む向き（前）を向く', a.facing > .5, a.facing);
    check('目の高さ 1.55〜1.65m', a.eyesY >= 1.55 && a.eyesY <= 1.65, a.eyesY);
    check('普段は不透明（描く順が乱れない）', a.opaque, a.opaque);
    // 岩の中の透かしと戻し：Remy の全メッシュの depthTest・renderOrder・opacity・transparent
    const s = await p.eval(`(() => { const A = window.__app, ms = A.heroBody.group.children.filter(o => o.isMesh);
      const st = () => ms.map(o => [o.material.depthTest, o.renderOrder, o.material.opacity, o.material.transparent]);
      A.heroStyle(true); const on = st(); A.heroStyle(false); const off = st();
      A.heroGlow(.38, .05, .5); const glow = A.heroBody.mats.every(m => Math.abs(m.emissive.r - .38) < 1e-6); A.heroGlow(0, 0, 0); const glow0 = A.heroBody.mats.every(m => m.emissive.r === 0);
      return { on: on.every(v => v[0] === false && v[1] === 10 && v[2] === .62 && v[3] === true), off: off.every(v => v[0] === true && v[1] === 0 && v[2] === 1 && v[3] === false), glow, glow0, sample: [on[0], off[0]] }; })()`);
    check('岩の中で透けて前に描き（全メッシュ）、外で元に戻る', s.on && s.off, s);
    check('毒の光が Remy の材質に入り、消える', s.glow && s.glow0, { glow: s.glow, glow0: s.glow0 });
    // 体格の身長（state.agent.height）の赤い柱を横に置いて撮る（試験のためだけ。撮ったら消す）
    await p.eval(`(() => { const A = window.__app, h = A.hero.position;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(.03, .03, A.state.agent.height, 8), new THREE.MeshBasicMaterial({ color: 0xff3020 })); pole.name = 'hero_test_pole';
      pole.position.set(h.x + .7, h.y + A.state.agent.height / 2, h.z); A.hero.parent.add(pole); return 1; })()`);
    await sleep(600); await p.screenshot(path.join(out, 'play_remy.png'));
    // 見た目の判定用に、顔の正面から寄せて撮る（7m＝ホイールで寄れる限界、3m＝判定用。カメラはこの試験の中だけ動かす）
    // 背中・左右の横（描く順の乱れが出やすい側）も 3m で撮る（見た目の判定 REVIEW_VISUAL_01 の条件）
    for (const [name, dist, pitch, turn] of [['play_remy_7m.png', 7, .9, 0], ['play_remy_3m.png', 3, .25, 0], ['play_remy_3m_back.png', 3, .25, Math.PI],
      ['play_remy_3m_left.png', 3, .25, Math.PI / 2], ['play_remy_3m_right.png', 3, .25, -Math.PI / 2]]) {
      await p.eval(`(() => { const A = window.__app; A.playCam.yaw = A.player.face + ${turn}; A.hero.parent.getObjectByName('hero_test_pole').visible = ${turn} === 0; A.playCam.dist = ${dist}; A.playCam.pitch = ${pitch}; return 1; })()`);
      await sleep(700); await p.screenshot(path.join(out, name));
    }
    await p.eval("document.getElementById('heroLook').value = 'box'; document.getElementById('heroLook').dispatchEvent(new Event('change')); 1");
    await sleep(800);
    const b = await p.eval("({ look: window.__app.heroLook, box: window.__app.hero.children[0].visible, body: window.__app.heroBody.group.visible })");
    check('簡易の人形に切り替えられる', b.look === 'box' && b.box && !b.body, b);
    await p.screenshot(path.join(out, 'play_box_3m.png'));
    await p.eval("document.getElementById('heroLook').value = 'remy'; document.getElementById('heroLook').dispatchEvent(new Event('change')); const A = window.__app, t = A.hero.parent.getObjectByName('hero_test_pole'); t.parent.remove(t); A.setMode('edit'); 1");
    await sleep(500);
    const after = shas(await p.eval(EXPORT));
    const names = [...new Set([...Object.keys(before), ...Object.keys(after)])], diff = names.filter(n => before[n] !== after[n]);
    check('歩くモード・見た目の切り替えの後も、書き出しが同じ（' + names.length + ' ファイル）', diff.length === 0 && names.length > 5, diff);
    // 歩きは平らな地図で（木や水に当たって止まらないように。書き出しの比べは上で済んでいる）
    await p.eval("(() => { const A = window.__app; A.genFlat(); A.updateTerrain(); A.rebuildProps(); A.rebuildBridges(); A.rebuildMarkers(); A.setMode('play'); A.playCam.yaw = Math.PI / 4; return 1; })()");
    await sleep(1500);
    // ---- 歩き（Revision 13）。計画 PLAN_02 とそのレビュー：場面ごとに、歩きの重み、着地中の両足の滑り（平均）、つま先の上下、コマの間隔を測る
    await p.eval(`(() => {
      const A = window.__app, b = A.heroBody, sk = b.skeleton, feet = ['LeftToeBase', 'RightToeBase'].map(n => sk.getBoneByName(n));
      const wait = ms => new Promise(r => setTimeout(r, ms)), wp = o => o.getWorldPosition(new THREE.Vector3());
      // ヘッドレスの Chrome は 1 秒に数コマしか描かないので、エディターの毎コマの更新（update）を 1/60 秒ずつ自分で進めて測る（描画の速さに左右されない）
      const DT = 1 / 60, run = (n, each) => { for (let i = 0; i < n; i++) { A.update(DT); if (each) each(i); } };
      // keys を押したまま 0.6 秒進めた後、1.2 秒ぶんをコマごとに測る
      window.__walkProbe = (keyList) => {
        keyList.forEach(k => A.keys.add(k)); run(36);
        const S = []; run(72, i => { A.hero.updateMatrixWorld(true); S.push({ t: i * DT, h: wp(A.hero), f: feet.map(wp), m: A.player.moving, w: { ...b.weights }, ts: { walk: b.actions.walk.timeScale, run: b.actions.run.timeScale } }); });
        keyList.forEach(k => A.keys.delete(k)); run(42);
        const hv = []; for (let i = 1; i < S.length; i++) hv.push(Math.hypot(S[i].h.x - S[i - 1].h.x, S[i].h.z - S[i - 1].h.z) / DT);
        const body = hv.slice().sort((x, y) => x - y)[hv.length >> 1];
        const slip = [0, 1].map(j => { const rel = S.map(s => s.f[j].y - s.h.y), lo = Math.min(...rel); const v = [];
          for (let i = 1; i < S.length; i++) if (rel[i] - lo <= .02 && rel[i - 1] - lo <= .02) v.push(Math.hypot(S[i].f[j].x - S[i - 1].f[j].x, S[i].f[j].z - S[i - 1].f[j].z) / DT);
          return { stanceMean: v.length ? v.reduce((x, y) => x + y, 0) / v.length : null, stanceFrames: v.length, range: Math.max(...rel) - lo }; });
        return { frames: S.length, moving: S.every(s => s.m), walkW: Math.min(...S.map(s => s.w.walk)), runW: Math.min(...S.map(s => s.w.run)), timeScale: S[S.length - 1].ts, body, slip, dtMax: DT };
      };
      window.__runSteps = run;
      return 1; })()`);
    const scenes = [['5m/秒（W）', ['KeyW'], 'run'], ['Shift（Shift+W）', ['ShiftLeft', 'KeyW'], 'run'], ['斜め（W+D）', ['KeyW', 'KeyD'], 'run']];
    const walkRes = {};
    for (const [name, ks, clip] of scenes) {
      await p.eval("(() => { const A = window.__app; A.setMode('play'); A.playCam.yaw = Math.PI / 4; return 1; })()"); await sleep(300);
      const r = await p.eval(`window.__walkProbe(${JSON.stringify(ks)})`); walkRes[name] = r; await sleep(800);
      check(`${name}：${clip === 'run' ? '走り' : '歩き'}の重み >0.9（移動し続けた）`, r.moving && (clip === 'run' ? r.runW : r.walkW) > .9, { walk: r.walkW, run: r.runW, moving: r.moving, frames: r.frames });
      if (ks.includes('ShiftLeft')) console.log(`INFO ${name}：着地中の足の速さ（参考。上限を入れると滑るので合否に入れない） 左 ${r.slip[0].stanceMean} 右 ${r.slip[1].stanceMean} 体 ${r.body}`);
      else check(`${name}：着地中の両足の平均の速さ <体の速さの 25%`, r.slip.every(f => f.stanceMean !== null && f.stanceMean < .25 * r.body), { body: r.body, left: r.slip[0].stanceMean, right: r.slip[1].stanceMean, frames: r.slip.map(f => f.stanceFrames) });
      check(`${name}：つま先が上下に動く（両足とも幅 ≥5cm）`, r.slip.every(f => f.range >= .05), r.slip.map(f => +f.range.toFixed(3)));
      { const c = a.meta.clips[clip], ts = r.timeScale[clip]; console.log(`INFO ${name}：${clip} を ${ts.toFixed(2)} 倍で再生（体の速さ ${r.body.toFixed(2)}÷${c.speed}。式どおりなので証拠に数えない）、1分あたり約 ${Math.round(ts * 120 / c.duration)} 歩、1 コマ ${(r.dtMax * 1000).toFixed(1)}ms で進めた`); }
    }
    // 浅い水（水深 0.3m：移動の速さが半分）
    await p.eval("(() => { const A = window.__app; A.state.water = 3.3; A.updateTerrain(); A.setMode('play'); return 1; })()"); await sleep(600);
    { const r = await p.eval("window.__walkProbe(['KeyW'])"); walkRes['浅い水'] = r; await sleep(800);
      check('浅い水（2.5m/秒）：歩きの重み >0.9、両足の着地中の速さ <25%', r.moving && r.walkW > .9 && r.slip.every(f => f.stanceMean !== null && f.stanceMean < .25 * r.body), { body: r.body, timeScale: r.timeScale.walk, walk: r.walkW, slip: r.slip.map(f => f.stanceMean) });
      console.log(`INFO 浅い水：walk を ${r.timeScale.walk.toFixed(2)} 倍で再生、1分あたり約 ${Math.round(r.timeScale.walk * 120 / a.meta.clips.walk.duration)} 歩`); }
    await p.eval("(() => { const A = window.__app; A.state.water = .8; A.updateTerrain(); return 1; })()");
    // 地図の端（通れない）に向かってキーを押したまま止まる → 立ち姿に戻る
    const wall = await p.eval(`(async () => { const A = window.__app, b = A.heroBody, arm = b.skeleton.getBoneByName('LeftArm'); A.setMode('play');
      const idleArm = arm.quaternion.clone(); A.player.x = A.SIZE / 2 - .3; A.player.z = 0; A.playCam.yaw = 0;   // カメラの右（D）＝ +x ＝地図の外
      A.keys.add('KeyD'); window.__runSteps(54); const r = { blend: 1 - b.weights.idle, moving: A.player.moving, armDeg: arm.quaternion.angleTo(idleArm) * 180 / Math.PI }; A.keys.delete('KeyD'); return r; })()`);
    check('壁（地図の端）でキーを押したまま止まると立ち姿に戻る（重み <0.05、腕 <3 度）', !wall.moving && wall.blend < .05 && wall.armDeg < 3, wall);
    // 止まると立ち姿に戻る
    const stop = await p.eval(`(async () => { const A = window.__app, b = A.heroBody, arm = b.skeleton.getBoneByName('LeftArm'); A.setMode('play'); A.playCam.yaw = Math.PI / 4;
      const idleArm = arm.quaternion.clone(); A.keys.add('KeyW'); window.__runSteps(48); const walking = 1 - b.weights.idle; A.keys.delete('KeyW');
      window.__runSteps(42); return { walking, blend: 1 - b.weights.idle, armDeg: arm.quaternion.angleTo(idleArm) * 180 / Math.PI }; })()`);
    check('止まって 0.7 秒で立ち姿に戻る（重み <0.05、腕 <3 度）', stop.walking > .9 && stop.blend < .05 && stop.armDeg < 3, stop);
    // ---- 歩き↔走りの切り替え（PLAN_03 のレビュー）：編集モードで animate を直接呼んで、好きな速さで測る（編集モードではエディターは animate を呼ばない）
    const sw = await p.eval(`(() => {
      const A = window.__app, b = A.heroBody, sk = b.skeleton, DT = 1 / 60; A.setMode('edit');
      const wp = o => o.getWorldPosition(new THREE.Vector3()), names = ['LeftToeBase', 'RightToeBase', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot', 'Hips'], B = Object.fromEntries(names.map(n => [n, sk.getBoneByName(n)]));
      let sumDev = 0; const heavy = () => Object.entries(b.weights).sort((x, y) => y[1] - x[1])[0][0];
      const step = v => { b.animate(DT, v); b.group.updateMatrixWorld(true); sumDev = Math.max(sumDev, Math.abs(Object.values(b.weights).reduce((x, y) => x + y, 0) - 1)); };
      const settle = () => { for (let i = 0; i < 90; i++) step(0); };
      const knee = (u, l, f) => { const a = wp(B[u]), k = wp(B[l]), c = wp(B[f]); return a.sub(k).angleTo(c.sub(k)) * 180 / Math.PI; };
      const pose = () => { const h = wp(B.Hips); return { kl: knee('LeftUpLeg', 'LeftLeg', 'LeftFoot'), kr: knee('RightUpLeg', 'RightLeg', 'RightFoot'), tl: wp(B.LeftToeBase).sub(h), tr: wp(B.RightToeBase).sub(h) }; };
      const out = {};
      // 一定の速さ：2.7（歩き）・3.2（走り）
      for (const [v, want] of [[2.7, 'walk'], [3.2, 'run']]) { settle(); for (let i = 0; i < 60; i++) step(v); out['const_' + v] = { want, weight: b.weights[want], gait: b.gait }; }
      // 境目の前後で揺れる：2.94±0.1 を毎コマ交互に 1 秒。歩きから入った時・走りから入った時
      for (const from of [2.0, 5.0]) { settle(); for (let i = 0; i < 60; i++) step(from); let last = heavy(), n = 0;
        for (let i = 0; i < 60; i++) { step(i % 2 ? 3.04 : 2.84); const h = heavy(); if (h !== last) { n++; last = h; } } out['jitter_from_' + from] = { switches: n, heavy: last }; }
      // 切り替えの前後 0.3 秒：膝の角度とつま先（腰から見た位置）の 1 コマの変化の最大を、始める位置を 40 通り（1 周期の 1/40 ずつ）変えて取り、
      // 切り替えない一定の速さ（速い方）の同じ測り方の最大と比べる（PLAN_03 の 1 回目の後に定義し直した。理由は計画の「実行の記録」）
      // 始める位置：60 コマ進めた後、歩き・走りの再生位置を 1 周期の k/40 だけずらす（1/60 秒の刻みだと、一定の速さでは毎回同じ時刻しか測れず、
      // クリップの中の着地・蹴り出しの 1 コマの速い動きを拾えなかった：PLAN_03 の 3 回目）
      const win = (v0, v1, k) => { settle(); for (let i = 0; i < 60; i++) step(v0); for (const n of ['walk', 'run']) b.actions[n].time = (b.actions[n].time + k / 40 * A.heroBody.meta.clips[n].duration) % A.heroBody.meta.clips[n].duration; step(v0); let prev = pose(), kn = 0, toe = 0;
        for (let i = 0; i < 36; i++) { step(i < 18 ? v0 : v1); const q = pose(); kn = Math.max(kn, Math.abs(q.kl - prev.kl), Math.abs(q.kr - prev.kr)); toe = Math.max(toe, q.tl.distanceTo(prev.tl), q.tr.distanceTo(prev.tr)); prev = q; }
        return { kn, toe }; };
      const worst = (v0, v1) => { let kn = 0, toe = 0; for (let k = 0; k < 40; k++) { const r = win(v0, v1, k); kn = Math.max(kn, r.kn); toe = Math.max(toe, r.toe); } return { kneeJumpDeg: +kn.toFixed(1), toeJumpM: +toe.toFixed(3) }; };
      const steady = {}; for (const v of [2.5, 5, 8]) steady[v] = worst(v, v);
      // 基準は 2 つの速さの一定の時の大きい方（走りの再生倍率に上限を入れたので、速い方が大きいとは限らない）
      for (const [v0, v1] of [[5, 2.5], [2.5, 5], [5, 8], [8, 5]]) { const w = worst(v0, v1), k0 = steady[v0], k1 = steady[v1];
        out['switch_' + v0 + '_' + v1] = { ...w, steadyKneeDeg: Math.max(k0.kneeJumpDeg, k1.kneeJumpDeg), steadyToeM: Math.max(k0.toeJumpM, k1.toeJumpM) }; }
      // 透かし中（岩の中）も動く
      settle(); A.heroStyle(true); const t0 = wp(B.LeftToeBase).sub(wp(B.Hips)); for (let i = 0; i < 40; i++) step(5); const t1 = wp(B.LeftToeBase).sub(wp(B.Hips)); A.heroStyle(false);
      out.xray = { run: b.weights.run, toeMoved: +t0.distanceTo(t1).toFixed(3) };
      // 走っている途中で簡易の人形にして、止まってから Remy に戻す → 0.3 秒で立ち姿に収まる（歩くモードで、エディターの更新から）
      for (let i = 0; i < 60; i++) step(5); A.setHeroLook('box'); A.setMode('play'); window.__runSteps(30); A.setHeroLook('remy'); window.__runSteps(18);
      out.backToRemy = { idle: b.weights.idle }; A.setMode('edit');
      out.sumDev = sumDev; return out; })()`);
    for (const [v, k] of [[2.7, 'const_2.7'], [3.2, 'const_3.2']]) check(`一定の速さ ${v}m/秒：${sw[k].want === 'run' ? '走り' : '歩き'}の重み >0.9`, sw[k].weight > .9, sw[k]);
    check('境目の前後（2.94±0.1m/秒）で毎コマ揺れても、入れ替わりは 1 秒に 2 回以下（歩きから・走りから）', sw.jitter_from_2.switches <= 2 && sw.jitter_from_5.switches <= 2, { walkFrom: sw.jitter_from_2, runFrom: sw.jitter_from_5 });
    for (const k of ['switch_5_2.5', 'switch_2.5_5', 'switch_5_8', 'switch_8_5']) check(`切り替え ${k.slice(7).replace('_', '→')}m/秒：膝の角度・つま先の 1 コマの変化の最大が、切り替えない一定の速さ（2 つの大きい方）の 1.1 倍以下`, sw[k].kneeJumpDeg <= 1.1 * sw[k].steadyKneeDeg && sw[k].toeJumpM <= 1.1 * sw[k].steadyToeM, sw[k]);
    check('重みの合計が常に 1±0.02', sw.sumDev <= .02, sw.sumDev);
    check('透かし中（岩の中）も走りの動きが止まらない', sw.xray.run > .9 && sw.xray.toeMoved > .05, sw.xray);
    check('簡易の人形から Remy に戻して 0.3 秒で立ち姿に収まる（立ち姿の重み >0.9）', sw.backToRemy.idle > .9, sw.backToRemy);
    // 動く所を横（D、5m/秒と Shift＝走り）・正面（S）・浅い水の横（歩き）から 3.2m で 0.1 秒ごとに 8 枚
    for (const [tag, ks, water] of [['side', ['KeyD'], .8], ['side_shift', ['ShiftLeft', 'KeyD'], .8], ['front', ['KeyS'], .8], ['side_water_walk', ['KeyD'], 3.3], ['side_shift_nocap', ['ShiftLeft', 'KeyD'], .8]]) {
      await p.eval(`(() => { window.__app.heroBody.runMaxRate = ${tag === 'side_shift_nocap' ? 'Infinity' : 1.5}; return 1; })()`);   // 既定は上限 1.5 倍。比べる用に上限なしも撮る
      await p.eval(`(() => { const A = window.__app; if (A.state.water !== ${water}) { A.state.water = ${water}; A.updateTerrain(); } A.setMode('play'); A.playCam.yaw = Math.PI / 4; A.playCam.dist = 3.2; A.playCam.pitch = .2; ${JSON.stringify(ks)}.forEach(k => A.keys.add(k)); return 1; })()`);
      await sleep(500);
      for (let i = 0; i < 8; i++) { await p.screenshot(path.join(out, `walk_${tag}_${i}.png`)); await sleep(100); }
      await p.eval(`(() => { ${JSON.stringify(ks)}.forEach(k => window.__app.keys.delete(k)); return 1; })()`); await sleep(700);
    }
    fs.writeFileSync(path.join(out, 'walk_measure.json'), JSON.stringify({ walkRes, wall, stop }, null, 1));
    return { a, loadMs, errors: p.errors };
  }, { w: 1400, h: 850, wait: 7000 });
  check('ページのエラーが 0', res.errors.length === 0, res.errors.slice(0, 3));
  console.log('INFO ページの読み込み', res.loadMs, 'ms（参考。合否に入れない）');
  fs.writeFileSync(path.join(__dirname, 'HERO_VIEW_RESULT.json'), JSON.stringify({ rows, measured: res.a, loadMs: res.loadMs, fail }, null, 1) + '\n');
  console.log(fail ? `${fail} FAILED` : 'ALL PASSED'); process.exit(fail ? 1 : 0);
})();

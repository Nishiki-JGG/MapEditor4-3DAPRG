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
      A.hero.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(b.group), eyes = b.group.getObjectByName('Eyes');
      const eb = new THREE.Box3().setFromObject(eyes);
      // 向き：顔（目）が、体の中心から見て hero の前（ローカル +Z を回した向き）にあるか
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(A.hero.quaternion), c = box.getCenter(new THREE.Vector3()), e = eb.getCenter(new THREE.Vector3());
      const facing = e.clone().sub(c).setY(0).normalize().dot(fwd);
      return { body: true, parts: b.group.children.length, look: A.heroLook, select: document.getElementById('heroLook').value, label: document.getElementById('heroLookRemy').textContent,
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
    const s = await p.eval(`(() => { const A = window.__app, ms = A.heroBody.group.children;
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
    return { a, loadMs, errors: p.errors };
  }, { w: 1400, h: 850, wait: 7000 });
  check('ページのエラーが 0', res.errors.length === 0, res.errors.slice(0, 3));
  console.log('INFO ページの読み込み', res.loadMs, 'ms（参考。合否に入れない）');
  fs.writeFileSync(path.join(__dirname, 'HERO_VIEW_RESULT.json'), JSON.stringify({ rows, measured: res.a, loadMs: res.loadMs, fail }, null, 1) + '\n');
  console.log(fail ? `${fail} FAILED` : 'ALL PASSED'); process.exit(fail ? 1 : 0);
})();

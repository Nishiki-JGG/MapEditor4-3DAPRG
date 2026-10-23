// スマホ・タブレット（Revision 21）：左のメニューの出し入れ、歩く・編集の切り替えボタン、移動のスティック、走るボタン、縦横の切り替え、指での編集と視点。
//   PW=<playwright のパス> node tests/mobile_walk.js
const { chromium } = require(process.env.PW || 'playwright');
const path = require('path');
const url = 'file://' + path.resolve(__dirname, '..', 'index.html') + '#size=48';
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const o = {}, errs = [];
  const open = async opts => {
    const ctx = await b.newContext(opts), p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    await p.goto(url, { timeout: 180000 }); await p.waitForTimeout(6000);
    await p.evaluate(() => { try { localStorage.removeItem('tdj-map-editor/panel'); } catch { } });
    return p;
  };
  const shown = (p, id) => p.evaluate(id => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().width > 0; }, id);

  // ---- PC: no stick, no run, no portrait / landscape button; the menu button hides and shows the left menu
  {
    const p = await open({ viewport: { width: 1300, height: 800 } });
    o.pc = { touch: await p.evaluate(() => window.__app.TOUCH), menuBtn: await shown(p, 'menuBtn'), modeBtn: await shown(p, 'modeBtn'), rotBtn: await shown(p, 'rotBtn'), panelAtStart: await shown(p, 'panel') };
    await p.click('#menuBtn');
    o.pc.panelAfterHide = await shown(p, 'panel'); o.pc.brushAfterHide = await shown(p, 'brushSizePanel');
    o.pc.offsetCleared = await p.evaluate(() => !window.__app.camera.view || !window.__app.camera.view.enabled);
    await p.click('#menuBtn'); o.pc.panelAfterShow = await shown(p, 'panel');
    await p.evaluate(() => window.__app.setMode('play')); await p.waitForTimeout(300);
    o.pc.joyInPlay = await shown(p, 'joy'); o.pc.runInPlay = await shown(p, 'runBtn');
    await p.context().close();
  }

  // ---- phone (portrait 390×844, touch)
  const p = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
  const cdp = await p.context().newCDPSession(p);
  const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map(([x, y], i) => ({ x, y, id: i })) });
  const A = fn => p.evaluate(fn);
  o.phone = { touch: await A(() => window.__app.TOUCH), panelAtStart: await shown(p, 'panel'), modeBtn: await shown(p, 'modeBtn'), rotBtn: await shown(p, 'rotBtn') };
  const rb = await p.evaluate(() => { const r = document.getElementById('rotBtn').getBoundingClientRect(); return { right: innerWidth - r.right, top: r.top }; });
  o.phone.rotTopRight = rb.right < 20 && rb.top < 20;
  // the top bar fits next to the button, not under it
  o.phone.topbarClear = await A(() => document.getElementById('topbar').getBoundingClientRect().right <= document.getElementById('rotBtn').getBoundingClientRect().left + 1);
  await p.tap('#menuBtn'); o.phone.panelAfterTap = await shown(p, 'panel'); await p.tap('#menuBtn');

  // walking: the mode button, then the stick
  await A(() => { const a = window.__app; a.genFlat(); a.updateTerrain(); a.rebuildProps(); a.state.spawn = { x: 0, z: 0 }; });
  await p.tap('#modeBtn'); await p.waitForTimeout(400);
  o.phone.play = await A(() => window.__app.state.mode === 'play'); o.phone.modeBtnLabel = await A(() => document.getElementById('modeBtn').textContent);
  o.phone.joy = await shown(p, 'joy'); o.phone.runBtn = await shown(p, 'runBtn');
  const joyC = await A(() => { const r = document.getElementById('joy').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  // walk with the stick pushed (dx, dy on screen) for `ms`; returns how far the hero went, and how far along the camera's forward
  // push the stick (dx, dy on screen), walk 1 s frame by frame, let go; returns how far the hero went, and how far along the camera's forward
  const walk = async (dx, dy) => {
    await touch('touchStart', [joyC]); await touch('touchMove', [[joyC[0] + dx, joyC[1] + dy]]);
    await p.waitForFunction(() => window.__app.joy.x || window.__app.joy.y, null, { timeout: 60000 });
    const r = await A(() => {
      const a = window.__app, c = a.camera.position, pl = a.player, s = { x: pl.x, z: pl.z, fx: pl.x - c.x, fz: pl.z - c.z };
      for (let i = 0; i < 60; i++) a.update(1 / 60);
      const l = Math.hypot(s.fx, s.fz), mx = pl.x - s.x, mz = pl.z - s.z;
      return { dist: Math.hypot(mx, mz), fwd: (mx * s.fx + mz * s.fz) / l, speed: Math.hypot(mx, mz), joy: { ...a.joy } };
    });
    await touch('touchEnd', []); await p.waitForFunction(() => !window.__app.joy.x && !window.__app.joy.y, null, { timeout: 60000 });
    return r;
  };
  const reset = () => A(() => { const a = window.__app; a.player.x = 0; a.player.z = 0; });
  await reset(); const up = await walk(0, -60);
  o.phone.stickForward = { dist: +up.dist.toFixed(2), fwd: +up.fwd.toFixed(2), joyY: +up.joy.y.toFixed(2) };
  o.phone.stickReleased = await A(() => window.__app.joy.x === 0 && window.__app.joy.y === 0);
  await reset(); const half = await walk(0, -25);
  o.phone.analog = { full: +up.speed.toFixed(2), half: +half.speed.toFixed(2) };
  await p.tap('#runBtn'); await p.waitForFunction(() => window.__app.joy.run); await reset(); const run = await walk(0, -60); await p.tap('#runBtn'); await p.waitForFunction(() => !window.__app.joy.run);
  o.phone.run = { walk: +up.speed.toFixed(2), run: +run.speed.toFixed(2), offAgain: await A(() => !window.__app.joy.run) };
  // one finger on the map turns the view while walking
  const yaw0 = await A(() => { const a = window.__app, c = a.camera.position; return Math.atan2(c.x - a.player.x, c.z - a.player.z); });
  await touch('touchStart', [[250, 400]]); for (let i = 1; i <= 8; i++) await touch('touchMove', [[250 - i * 15, 400]]); await touch('touchEnd', []); await p.waitForTimeout(200);
  const yaw1 = await A(() => { const a = window.__app, c = a.camera.position; return Math.atan2(c.x - a.player.x, c.z - a.player.z); });
  o.phone.swipeTurns = +Math.abs(Math.atan2(Math.sin(yaw1 - yaw0), Math.cos(yaw1 - yaw0))).toFixed(2);

  // portrait / landscape: headless Chromium cannot lock the screen, so the page turns itself 90°
  await p.tap('#rotBtn'); await p.waitForFunction(() => window.__app.view.rotated, null, { timeout: 60000 }); await p.waitForTimeout(500);
  o.rot = await A(() => { const a = window.__app, c = document.getElementById('view'); return { rotated: a.view.rotated, bodyRot: document.body.classList.contains('rot'), canvasW: c.clientWidth, canvasH: c.clientHeight, aspect: +a.camera.aspect.toFixed(3) }; });
  // the rotate button stays at the page's top right corner: the page's top is the screen's right edge (the phone held
  // sideways, turned to the left), its right is the screen's bottom edge
  o.rot.btnCorner = await A(() => { const r = document.getElementById('rotBtn').getBoundingClientRect(); return { screenRight: Math.round(innerWidth - r.right), screenBottom: Math.round(innerHeight - r.bottom) }; });
  // pushing the stick toward the page's "up" (the screen's right after the turn) still walks forward
  const joyR = await A(() => { const r = document.getElementById('joy').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  joyC[0] = joyR[0]; joyC[1] = joyR[1];
  await reset(); const rup = await walk(60, 0);
  o.rot.stickForward = { fwd: +rup.fwd.toFixed(2), dist: +rup.dist.toFixed(2) };
  // a tap is read in the page's own frame: the point under the finger is the point picked
  o.rot.pickMatches = await A(() => { const a = window.__app; const [x, y] = a.toLocal(100, 300); return Math.abs(x - 300) < 1e-6 && Math.abs(y - (innerWidth - 100)) < 1e-6; });
  await p.tap('#rotBtn'); await p.waitForFunction(() => !window.__app.view.rotated, null, { timeout: 60000 }); await p.waitForTimeout(400);
  o.rot.back = await A(() => ({ rotated: window.__app.view.rotated, canvasW: document.getElementById('view').clientWidth }));

  // editing with fingers: a held finger raises the ground, two fingers zoom without editing
  await p.tap('#modeBtn'); await p.waitForTimeout(300);
  await A(() => { const a = window.__app; a.genFlat(); a.updateTerrain(); a.rebuildProps(); a.setTool('raise'); a.state.radius = 5; a.state.strength = 1; });
  const sumH = () => A(() => window.__app.H.reduce((s, v) => s + v, 0));
  const h0 = await sumH();
  await touch('touchStart', [[195, 500]]); await p.waitForFunction(() => window.__app.strokeActive, null, { timeout: 60000 });   // a held finger starts editing after a moment
  await A(() => { for (let i = 0; i < 30; i++) window.__app.update(1 / 60); });
  await touch('touchEnd', []); await p.waitForFunction(() => !window.__app.strokeActive, null, { timeout: 60000 });
  const h1 = await sumH();
  const camD = () => A(() => window.__app.camera.position.length());
  const d0 = await camD();
  await touch('touchStart', [[150, 450], [240, 550]]);
  for (let i = 1; i <= 6; i++) await touch('touchMove', [[150 - i * 12, 450 - i * 12], [240 + i * 12, 550 + i * 12]]);
  await touch('touchEnd', []); await p.waitForTimeout(300);
  const h2 = await sumH(), d1 = await camD();
  o.edit = { mode: await A(() => window.__app.state.mode), held: +(h1 - h0).toFixed(2), pinchEdits: +(h2 - h1).toFixed(3), zoomedIn: +(d0 - d1).toFixed(2) };
  await b.close();

  const checks = [
    ['PC：タッチ用のボタン・スティックは出ない', !o.pc.touch && o.pc.menuBtn && !o.pc.modeBtn && !o.pc.rotBtn && !o.pc.joyInPlay && !o.pc.runInPlay],
    ['PC：☰ でメニューをしまう・出す', o.pc.panelAtStart && !o.pc.panelAfterHide && !o.pc.brushAfterHide && o.pc.offsetCleared && o.pc.panelAfterShow],
    ['スマホ：メニューは閉じて始まり、☰ で出る', o.phone.touch && !o.phone.panelAtStart && o.phone.panelAfterTap],
    ['スマホ：縦横ボタンが右上、上のボタン列と重ならない', o.phone.rotBtn && o.phone.rotTopRight && o.phone.topbarClear],
    ['スマホ：歩く・編集ボタンで歩くモードへ', o.phone.modeBtn && o.phone.play && o.phone.modeBtnLabel === '編集' && o.phone.joy && o.phone.runBtn],
    ['スティックを上へ：前へ歩き、離すと止まる', o.phone.stickForward.fwd > 3 && o.phone.stickForward.fwd > o.phone.stickForward.dist * .9 && o.phone.stickReleased],
    ['スティックを少しだけ倒すと遅い', o.phone.analog.half < o.phone.analog.full * .7 && o.phone.analog.half > .5 && o.phone.stickForward.joyY > .99],
    ['走るボタンで速くなる', o.phone.run.run > o.phone.run.walk * 1.3 && o.phone.run.offAgain],
    ['歩くモード：画面をなぞると視点が回る', o.phone.swipeTurns > .2],
    ['縦横：画面が 90° 回り、描く大きさも入れ替わる', o.rot.rotated && o.rot.bodyRot && o.rot.canvasW === 844 && o.rot.canvasH === 390 && Math.abs(o.rot.aspect - 844 / 390) < .01],
    ['縦横：回したあとも、縦横ボタンは横に持った画面の右上', o.rot.btnCorner.screenRight < 20 && o.rot.btnCorner.screenBottom < 20],
    ['縦横：回したあとも、スティックの上が前', o.rot.stickForward.fwd > 3 && o.rot.stickForward.fwd > o.rot.stickForward.dist * .9 && o.rot.pickMatches],
    ['縦横：もう一度押すと元に戻る', !o.rot.back.rotated && o.rot.back.canvasW === 390],
    ['編集：1本指で地面を上げ、2本指はズームだけ', o.edit.mode === 'edit' && o.edit.held > 1 && Math.abs(o.edit.pinchEdits) < 1e-3 && o.edit.zoomedIn > .5],
    ['ページのエラーなし', errs.length === 0],
  ];
  console.log(JSON.stringify(o, null, 1)); if (errs.length) console.log(errs.slice(0, 5));
  let fail = 0; for (const [n, ok] of checks) { console.log((ok ? '合格 ' : '失敗 ') + n); if (!ok) fail++; }
  console.log(fail ? `失敗 ${fail} / ${checks.length}` : `すべて合格（${checks.length} 項目）`); process.exit(fail ? 1 : 0);
})();

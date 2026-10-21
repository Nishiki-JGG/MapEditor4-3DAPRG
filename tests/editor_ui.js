// 編集画面の操作（Revision 16）：マップ側の取り消し・やり直し、四角いブラシ、1〜9 のスロット、歩くモードでの編集、小物のツリー。
//   PW=<playwright のパス> node tests/editor_ui.js
const { chromium } = require(process.env.PW || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1300, height: 800 } }), p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  const url = 'file://' + path.resolve(__dirname, '..', 'index.html') + '#size=48';
  await p.goto(url); await p.waitForTimeout(6000);
  const o = {};
  // 1) undo / redo on the map side (not inside the scrolling menu), and they work
  o.undoOnMap = await p.evaluate(() => { const u = document.getElementById('undo'), r = document.getElementById('redo'); return !!u && !!r && !u.closest('#panel') && !r.closest('#panel'); });
  o.undoWorks = await p.evaluate(() => {
    const A = window.__app; A.genFlat(); A.updateTerrain(); const h0 = A.H[A.H.length >> 1];
    A.setTool('raise'); A.stroke(0, 0, 30); const h1 = A.H[A.H.length >> 1];
    document.getElementById('undo').click(); const h2 = A.H[A.H.length >> 1];
    document.getElementById('redo').click(); const h3 = A.H[A.H.length >> 1];
    return h1 > h0 + .01 && Math.abs(h2 - h0) < 1e-6 && Math.abs(h3 - h1) < 1e-6;
  });
  // 2) square brush: the corner of the square is raised, the same spot outside the circle is not
  o.square = await p.evaluate(() => {
    const A = window.__app, corner = () => A.heightAt(3.4, 3.4), lift = shape => {
      A.genFlat(); A.updateTerrain(); document.getElementById(shape === 'square' ? 'shapeSquare' : 'shapeCircle').click();
      A.state.radius = 4; A.setTool('raise'); const h0 = corner(); A.stroke(0, 0, 30); return corner() - h0;
    };
    const sq = lift('square'), ci = lift('circle'); return { square: +sq.toFixed(3), circle: +ci.toFixed(3) };
  });
  // 3) slots: Shift+3 stores tool, kind of props, brush; 3 recalls it; it survives a reload; unregistered 2 is still "raise"
  await p.evaluate(() => { localStorage.removeItem('tdj-map-editor/slots'); const A = window.__app; A.setTool('scatter'); A.state.radius = 6.5; A.state.density = 1.3; A.state.types = new Set([A.PROP.findIndex(t => t.id === 'rock'), A.PROP.findIndex(t => t.id === 'fern')]); document.getElementById('shapeSquare').click(); });
  await p.locator('#view').focus(); await p.keyboard.press('Shift+Digit3');
  await p.evaluate(() => { const A = window.__app; A.setTool('lower'); A.state.radius = 2; A.state.types = new Set([0]); document.getElementById('shapeCircle').click(); });
  await p.keyboard.press('Digit3');
  const slotState = () => p.evaluate(() => { const A = window.__app; return { tool: A.state.tool, radius: A.state.radius, density: A.state.density, shape: A.state.brushShape, types: [...A.state.types].map(i => A.PROP[i].id).sort().join(',') }; });
  o.slotRecall = await slotState();
  await p.keyboard.press('Digit2'); o.slotDefault = (await slotState()).tool;
  await p.reload(); await p.waitForTimeout(6000); await p.locator('#view').focus(); await p.keyboard.press('Digit3');
  o.slotAfterReload = await slotState();
  o.slotButton = await p.evaluate(() => document.querySelector('#slots button:nth-child(3)').textContent);
  // 4) walk mode: menu stays, a left drag with a brush edits the ground under the cursor
  await p.evaluate(() => { const A = window.__app; A.genFlat(); A.updateTerrain(); A.rebuildProps(); A.state.spawn = { x: 0, z: 0 }; A.setTool('raise'); A.state.radius = 5; A.state.strength = 1; A.setMode('play'); });
  await p.waitForTimeout(800);
  const sumH = () => p.evaluate(() => window.__app.H.reduce((s, v) => s + v, 0));
  const s0 = await sumH();
  await p.mouse.move(800, 420); await p.mouse.down(); await p.waitForTimeout(1500); await p.mouse.up(); await p.waitForTimeout(300);
  o.playEdit = { panelShown: await p.evaluate(() => getComputedStyle(document.getElementById('panel')).display !== 'none'), raised: +((await sumH()) - s0).toFixed(2), stillPlay: await p.evaluate(() => window.__app.state.mode === 'play') };
  await p.evaluate(() => window.__app.setMode('edit'));
  // 5) prop tree: groups that fold, a group box checks the whole group, counts follow
  o.tree = await p.evaluate(() => {
    const A = window.__app, groups = [...document.querySelectorAll('#types details.pg')], names = groups.map(g => g.querySelector('summary').textContent.replace(/\d+\/\d+$/, '').trim());
    const listed = document.querySelectorAll('#types label[data-type]').length;
    const rocks = groups.find(g => g.textContent.includes('岩・崖')), box = rocks.querySelector('.gall');
    A.state.types = new Set(); box.click();
    const visible = [...rocks.querySelectorAll('label[data-type]')].filter(l => !l.hidden).map(l => +l.dataset.type);
    const allOn = visible.every(i => A.state.types.has(i)) && A.state.types.size === visible.length;
    const cnt = rocks.querySelector('.cnt').textContent;
    box.click(); const allOff = A.state.types.size === 0;
    return { names, listed, total: A.PROP.length, allOn, allOff, cnt, rockGroupHasRock: visible.includes(A.PROP.findIndex(t => t.id === 'rock')) };
  });
  const checks = [
    ['取り消し・やり直しがマップ側にあり、動く', o.undoOnMap && o.undoWorks],
    ['四角いブラシは角まで届き、円は届かない', o.square.square > .05 && o.square.circle < .01],
    ['Shift+3 で登録、3 で呼び出し（ツール・半径・密度・形・小物）', o.slotRecall.tool === 'scatter' && o.slotRecall.radius === 6.5 && o.slotRecall.density === 1.3 && o.slotRecall.shape === 'square' && o.slotRecall.types === 'fern,rock'],
    ['登録していない 2 は元どおり「上げる」', o.slotDefault === 'raise'],
    ['再読み込みしても登録が残る', JSON.stringify(o.slotAfterReload) === JSON.stringify(o.slotRecall)],
    ['スロットのボタンに内容が出る', /3.*小物を撒く/.test(o.slotButton)],
    ['歩くモードでもメニューが出て、ドラッグで地面を編集できる', o.playEdit.panelShown && o.playEdit.raised > 1 && o.playEdit.stillPlay],
    ['小物はグループのツリーで、全種類が入っている', o.tree.names.length >= 5 && o.tree.listed === o.tree.total],
    ['グループの箱で全部入れる・外す（数も出る）', o.tree.allOn && o.tree.allOff && /^\d+\/\d+$/.test(o.tree.cnt) && o.tree.rockGroupHasRock],
    ['ページのエラー 0', errs.length === 0],
  ];
  for (const [n, ok] of checks) console.log((ok ? 'PASS ' : 'FAIL ') + n);
  console.log(JSON.stringify(o), errs.join('\n'));
  await b.close(); process.exit(checks.every(c => c[1]) ? 0 : 1);
})();

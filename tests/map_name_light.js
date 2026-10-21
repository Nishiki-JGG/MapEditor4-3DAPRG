// マップ名・名前を付けて保存・置く物のグループ・太陽光なしの明るさ（Revision 17）。
//   PW=<playwright のパス> node tests/map_name_light.js
const { chromium } = require(process.env.PW || 'playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await b.newContext({ viewport: { width: 1300, height: 800 }, acceptDownloads: true }), p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html') + '#size=48', { timeout: 180000 }); await p.waitForTimeout(6000);
  const o = {};
  // the file name the page asks for (a.download). Chromium ignores it for pages opened from file://, so read it where it is set
  await p.evaluate(() => { window.__dl = []; const c = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) window.__dl.push(this.download); return c.call(this); }; });
  const downloadOf = async click => {
    const n0 = await p.evaluate(() => window.__dl.length); await click();
    await p.waitForFunction(n => window.__dl.length > n, n0, { timeout: 400000, polling: 500 });
    return p.evaluate(() => window.__dl[window.__dl.length - 1]);
  };
  // 1) map name: typed in the map section, shown in the tab title, kept in the save data and the export
  await p.evaluate(() => { window.__app.genFlat(); }); await p.fill('#mapName', '森の入口/北');
  o.title = await p.title();
  o.saved = await p.evaluate(() => window.__app.serialize().name);
  // 2) save: the file is named after the map (unsafe characters replaced); Ctrl+S does the same; export zip too
  o.saveFile = await downloadOf(() => p.click('#save'));
  o.ctrlS = await downloadOf(async () => { await p.focus('#mapName'); await p.keyboard.press('Control+KeyS'); });
  o.exportFile = await downloadOf(() => p.evaluate(() => { setTimeout(() => document.getElementById('export').click(), 0); }));   // the export is heavy: do not wait on the click
  o.metaName = await p.evaluate(async () => { const { files } = await window.__app.buildExport(); return JSON.parse(files.find(f => f.name === 'meta.json').data).mapName; });
  // 名前を付けて保存 with the browser's file picker (stubbed: records what is written); then 保存 overwrites that file
  o.saveAs = await p.evaluate(async () => {
    const writes = []; let asked = null;
    window.showSaveFilePicker = async opt => { asked = opt.suggestedName; return { name: '洞窟B1.json', createWritable: async () => ({ write: async blob => writes.push(JSON.parse(await blob.text()).name), close: async () => { } }) }; };
    document.getElementById('saveAs').click(); await new Promise(r => setTimeout(r, 500));
    document.getElementById('save').click(); await new Promise(r => setTimeout(r, 500));
    return { asked, writes, target: document.getElementById('saveTarget').textContent };
  });
  // without a picker: 名前を付けて保存 asks for the name and downloads
  await p.evaluate(() => { delete window.showSaveFilePicker; });
  p.once('dialog', d => d.accept('地下水路'));
  o.saveAsPrompt = await downloadOf(() => p.click('#saveAs'));
  o.nameAfterPrompt = await p.evaluate(() => window.__app.state.mapName);
  // loading a saved map brings its name back
  o.loaded = await p.evaluate(() => { const A = window.__app, d = A.serialize(); d.name = '読み込んだ部屋'; A.deserialize(d); return [A.state.mapName, document.getElementById('mapName').value]; });
  // 3) things to place, in folding groups; a picked item's group is open
  o.place = await p.evaluate(() => {
    const A = window.__app; A.setTool('place');
    const groups = [...document.querySelectorAll('#variants details.pg')], names = groups.map(g => g.querySelector('summary').firstChild.textContent);
    const rock = groups.find(g => names[groups.indexOf(g)] === '岩・崖'); rock.querySelector('button').click();
    const again = [...document.querySelectorAll('#variants details.pg')], open = again.filter(g => g.open).map(g => g.querySelector('summary').firstChild.textContent);
    const buttons = document.querySelectorAll('#variants details.pg button').length, total = A.PROP.filter((_, i) => A.propVisible(i)).length;
    return { names, open, buttons, total, picked: A.PROP[A.state.variant.place].id };
  });
  // 4) brightness without sunlight: three levels, hidden while the sun is on, saved, undoable, exported
  o.light = await p.evaluate(async () => {
    const A = window.__app, row = document.getElementById('darkRow'), sun = document.getElementById('sunOn'), sel = document.getElementById('darkness');
    const scene = (() => { let r = A.terrain; while (r.parent) r = r.parent; return r; })(), hemi = scene.children.find(c => c.isHemisphereLight);
    const fill = scene.children.filter(c => c.isDirectionalLight).find(l => !l.castShadow);
    sun.checked = true; sun.dispatchEvent(new Event('change')); const hiddenWithSun = row.hidden;
    sun.checked = false; sun.dispatchEvent(new Event('change')); const shownWithoutSun = !row.hidden;
    const levels = {};
    for (const v of ['dark', 'normal', 'bright']) { sel.value = v; sel.dispatchEvent(new Event('change')); levels[v] = [+hemi.intensity.toFixed(2), fill.visible ? +fill.intensity.toFixed(2) : 0]; }
    const saved = A.serialize().darkness;
    document.getElementById('undo').click(); const undone = A.state.darkness;
    sel.value = 'bright'; sel.dispatchEvent(new Event('change'));
    const { files } = await A.buildExport(), meta = JSON.parse(files.find(f => f.name === 'meta.json').data);
    return { hiddenWithSun, shownWithoutSun, options: [...sel.options].map(x => x.textContent), levels, saved, undone, exported: meta.darkness && meta.darkness.level };
  });
  const L = o.light.levels;
  const checks = [
    ['マップ名がタブの題名と保存データに入る', o.title.startsWith('森の入口/北') && o.saved === '森の入口/北'],
    ['保存のファイル名がマップ名（使えない文字は _）', o.saveFile === '森の入口_北.json'],
    ['Ctrl+S（名前の入力中でも）で保存', o.ctrlS === '森の入口_北.json'],
    ['書き出しの zip もマップ名、meta.json に mapName', o.exportFile === '森の入口_北_export_unity.zip' && o.metaName === '森の入口/北'],
    ['名前を付けて保存：保存先を選び、その後の「保存」は同じファイルへ上書き', o.saveAs.asked === '森の入口_北.json' && o.saveAs.writes.length === 2 && /洞窟B1\.json/.test(o.saveAs.target)],
    ['保存先を選べないブラウザでは、名前を聞いてダウンロード', o.saveAsPrompt === '地下水路.json' && o.nameAfterPrompt === '地下水路'],
    ['読み込むとマップ名が戻る', o.loaded[0] === '読み込んだ部屋' && o.loaded[1] === '読み込んだ部屋'],
    ['置く物はグループに分かれ、全種類があり、選んだ物のグループが開く', o.place.names.length >= 5 && o.place.buttons === o.place.total && o.place.open.includes('岩・崖') && o.place.picked === 'rock'],
    ['明るさの欄は太陽光オフのときだけ出る', o.light.hiddenWithSun && o.light.shownWithoutSun && o.light.options.length === 3],
    ['暗い < ふつう < 明るい（暗いは今までどおり補助光なし）', L.dark[1] === 0 && L.normal[0] > L.dark[0] && L.bright[0] > L.normal[0] && L.bright[1] > L.normal[1] && L.normal[1] > 0],
    ['明るさは保存・取り消し・書き出しに入る', o.light.saved === 'bright' && o.light.undone === 'normal' && o.light.exported === 'bright'],
    ['ページのエラー 0', errs.length === 0],
  ];
  for (const [n, ok] of checks) console.log((ok ? 'PASS ' : 'FAIL ') + n);
  console.log(JSON.stringify(o), errs.join('\n'));
  await b.close(); process.exit(checks.every(c => c[1]) ? 0 : 1);
})();

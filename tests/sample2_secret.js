// Sample 2 (48m ruins, secret passage): validation is clean, and the passage is the only way into the sanctum.
// usage: PW=<path to playwright> node tests/sample2_secret.js
const { chromium } = require(process.env.PW || 'playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 700 } }); const errs = []; p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await p.goto('file://' + require('path').resolve(__dirname, '../index.html') + '#size=48'); await p.waitForTimeout(5000);
  const r = await p.evaluate(() => {
    const A = window.__app; A.genSample2(); A.updateTerrain();
    const v = A.runValidation(), s = A.secretRegions();
    const save = A.O.slice(); for (let k = 0; k < A.O.length; k++) if (A.O[k] === 3) A.O[k] = 0; A.updateTerrain();
    const blocked = A.runValidation(); A.O.set(save); A.updateTerrain();
    const x = A.secretLineX(6.5);
    return { size: A.SIZE, errors: v.errors, warnings: v.warnings, passages: s.map(q => ({ id: q.id, cells: q.cells.length, entrances: q.entrances.length, rockAboveMax: +q.rockAboveMax.toFixed(2) })),
      insidePassage: { walkable: A.walkable(x, 6.5), floor: +A.floorAt(x, 6.5).toFixed(2), terrain: +A.heightAt(x, 6.5).toFixed(2) },
      withoutPassage: [...blocked.errors, ...blocked.warnings].filter(m => /mk_0006|link_0009/.test(m)) };
  });
  console.log(JSON.stringify(r, null, 1)); console.log(errs.join('\n') || 'no errors'); await b.close();
})();

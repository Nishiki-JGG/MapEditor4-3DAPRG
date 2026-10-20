// 書き出しの水の試験（ブラウザ＝Chrome/Edge を CDP で操作）。
//   node tests/water_export.js [元のエディターの写しのフォルダ]
// 1) 新しいエディターでサンプルを書き出し、water_flow.png / water_mask.png と meta.waterSim を検査
// 2) 元のエディター（git HEAD の写し）で同じサンプルを書き出し、既存ファイルのバイト列が同じか（meta は waterSim と検査の数を除いて同じか）
// 3) ブラウザで作った画像が、node で同じ入力から作った画像と同じか（再現性）
const path = require('path'), fs = require('fs'), crypto = require('crypto'), zlib = require('zlib');
const { withPage } = require('./cdp'); const W = require('../water.js');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const ROOT = path.resolve(__dirname, '..'), ORIG = path.resolve(process.argv[2] || path.join(ROOT, '..', '_baseline_orig'));
let fail = 0; const out = [];
const check = (name, ok, info) => { out.push({ name, ok: !!ok, info }); console.log(ok ? 'PASS' : 'FAIL', name, info !== undefined ? JSON.stringify(info) : ''); if (!ok) fail++; };

async function exportIn(html, sample) {
  return withPage('file:///' + html.replace(/\\/g, '/') + '#size=64', async p => {
    const r = await p.eval(`(async () => { const A = window.__app; ${sample}; A.updateTerrain && A.updateTerrain(); const e = await A.buildExport();
      const lw = A.buildExport.lastWater; let tw = null;
      if (lw) { const f32 = new Float32Array(lw.input.TH); let s = ''; const u8 = new Uint8Array(f32.buffer); for (let i = 0; i < u8.length; i += 8192) s += String.fromCharCode.apply(null, u8.subarray(i, i + 8192)); tw = { TN: lw.input.TN, TS: lw.input.TS, HALF: lw.input.HALF, level: lw.input.level, falls: lw.input.falls, TH: btoa(s) }; }
      const files = e.files.map(f => { const b = typeof f.data === 'string' ? new TextEncoder().encode(f.data) : f.data; let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192)); return { name: f.name, b64: btoa(s) }; });
      return { files, tw, errors: e.validation.errors, warnings: e.validation.warnings, falls: A.state && 0 }; })()`);
    return { ...r, pageErrors: p.errors };
  });
}
const unb = b64 => Buffer.from(b64, 'base64');

(async () => {
  const sample = "A.genSample(); A.state.roomId = 'water-test-room'";
  const n = await exportIn(path.join(ROOT, 'index.html'), sample);
  check('新エディター：ページエラーなし', n.pageErrors.length === 0, n.pageErrors);
  const nf = Object.fromEntries(n.files.map(f => [f.name, unb(f.b64)]));
  check('water_flow.png と water_mask.png が出る', nf['water_flow.png'] && nf['water_mask.png'], Object.keys(nf).filter(k => k.startsWith('water')));
  const meta = JSON.parse(nf['meta.json'].toString('utf8')), ws = meta.waterSim;
  check('meta.waterSim：available / 画像名 / 解像度', ws && ws.available === true && ws.flowMap === 'water_flow.png' && ws.maskMap === 'water_mask.png' && ws.resolution === meta.terrain.heightmapResolution, ws && { available: ws.available, resolution: ws.resolution });
  check('meta.water は今までと同じ形（level・liquid・sea）', Array.isArray(meta.water) && meta.water[0].id === 'water_main' && 'level' in meta.water[0] && 'liquid' in meta.water[0] && 'sea' in meta.water[0]);
  check('waterSim の保存則と収束', ws.flux && Math.abs(ws.flux.balance) <= 0.03 && ws.cg.relResidual < 1e-3, { flux: ws.flux, cg: ws.cg });
  check('サンプルの滝が着水点を持ち、乾いていない', ws.falls.length >= 1 && ws.falls.every(f => !f.dry && f.wetCells > 0), ws.falls);
  check('検査：エラー0', n.errors.length === 0, n.errors);
  // PNG を復号
  const dec = png => { let pos = 8, idat = []; let w = 0, h = 0; while (pos < png.length) { const len = png.readUInt32BE(pos), type = png.toString('latin1', pos + 4, pos + 8); if (type === 'IHDR') { w = png.readUInt32BE(pos + 8); h = png.readUInt32BE(pos + 12); } if (type === 'IDAT') idat.push(png.subarray(pos + 8, pos + 8 + len)); pos += 12 + len; } const raw = zlib.inflateSync(Buffer.concat(idat)), rl = 1 + w * 4, o = Buffer.alloc(w * h * 4); for (let y = 0; y < h; y++) raw.copy(o, y * w * 4, y * rl + 1, (y + 1) * rl); return { w, h, data: o }; };
  const fl = dec(nf['water_flow.png']), mk = dec(nf['water_mask.png']);
  check('画像の大きさ = 地形の解像度', fl.w === meta.terrain.heightmapResolution && fl.h === fl.w && mk.w === fl.w, [fl.w, fl.h]);
  // 再現性：同じ入力を node で解析 → 同じ画像
  const T = n.tw, TH = new Float32Array(unb(T.TH).buffer.slice(0)); const res = W.analyze({ TN: T.TN, TS: T.TS, HALF: T.HALF, TH, level: T.level, falls: T.falls }), pk = W.pack(res);
  check('再現性：ブラウザの流れの画像 = node の画像（バイト一致）', Buffer.from(pk.flow).equals(fl.data), { browser: sha(fl.data).slice(0, 12), node: sha(pk.flow).slice(0, 12) });
  check('再現性：ブラウザの泡の帯の画像 = node の画像（バイト一致）', Buffer.from(pk.mask).equals(mk.data), { browser: sha(mk.data).slice(0, 12), node: sha(pk.mask).slice(0, 12) });
  // 画像の意味
  let wet = 0, bad = 0; for (let k = 0; k < fl.w * fl.h; k++) { if (fl.data[k * 4 + 3] > 0) wet++; if (fl.data[k * 4 + 3] > 0 && fl.data[k * 4 + 3] < 4) bad++; }
  check('水の印（A）：水のセルがあり、4 未満の水は無い', wet > 100 && bad === 0, { wet });
  // 2) 元のエディターと比べる
  if (fs.existsSync(path.join(ORIG, 'index.html'))) {
    const o = await exportIn(path.join(ORIG, 'index.html'), sample);
    const of = Object.fromEntries(o.files.map(f => [f.name, unb(f.b64)]));
    const same = [], diff = [];
    const noVer = b => { const c = JSON.parse(b.toString('utf8')); delete c.exporterVersion; return JSON.stringify(c); };   // asset_catalog.json は exporterVersion を持つ（r8→r9 で変わるのは当然）
    for (const k of Object.keys(of)) { if (['meta.json', 'manifest.json', 'README.txt', 'validation.json'].includes(k)) continue; const eq = nf[k] && (k === 'asset_catalog.json' ? noVer(nf[k]) === noVer(of[k]) : Buffer.compare(nf[k], of[k]) === 0); (eq ? same : diff).push(k); }
    check('既存ファイルのバイト列が元のエディターの書き出しと同じ（meta・manifest・README・validation 以外。asset_catalog は exporterVersion を除く）', diff.length === 0, { same: same.length, diff });
    const om = JSON.parse(of['meta.json'].toString('utf8')), nm = JSON.parse(nf['meta.json'].toString('utf8'));
    const strip = m => { const c = JSON.parse(JSON.stringify(m)); delete c.waterSim; delete c.exporterVersion; delete c.validation; return c; };
    check('meta.json は waterSim・exporterVersion・validation の数を除いて同じ', JSON.stringify(strip(om)) === JSON.stringify(strip(nm)));
    const ov = JSON.parse(of['validation.json'].toString('utf8')), nv = JSON.parse(nf['validation.json'].toString('utf8'));
    check('validation：エラー増0、警告増0（サンプル）', nv.errors.length <= ov.errors.length && nv.warnings.length <= ov.warnings.length, { orig: [ov.errors.length, ov.warnings.length], now: [nv.errors.length, nv.warnings.length] });
    const mf = JSON.parse(nf['manifest.json'].toString('utf8')); const names = mf.files.map(f => f.name);
    check('manifest の一覧に水の画像が入り、SHA が実物と一致', ['water_flow.png', 'water_mask.png'].every(k => names.includes(k)) && mf.files.every(f => nf[f.name] && sha(nf[f.name]) === f.sha256));
  } else console.log('（元のエディターの写しが無いので、既存ファイルの比較は飛ばしました）');
  // 場面：海・溶岩は available=false（画像なし）、遺跡のサンプル（水位が低い）でも落ちない
  for (const [label, expr, wantAvail] of [['海', "A.genSample(); A.state.roomId='t'; A.state.sea = true", false], ['溶岩', "A.genSample(); A.state.roomId='t'; A.state.biome = 'volcano'", false], ['遺跡のサンプル', "A.genSample2(); A.state.roomId='t'", null]]) {
    const q = await exportIn(path.join(ROOT, 'index.html'), expr); const f = Object.fromEntries(q.files.map(x => [x.name, unb(x.b64)])), m = JSON.parse(f['meta.json'].toString('utf8'));
    const ok = q.pageErrors.length === 0 && m.waterSim && (wantAvail === null ? true : m.waterSim.available === wantAvail && !f['water_flow.png']);
    check('場面：' + label, ok, { available: m.waterSim && m.waterSim.available, reason: m.waterSim && m.waterSim.reason, files: Object.keys(f).filter(k => k.startsWith('water')), errs: q.pageErrors, validationErrors: q.errors.length, warnings: q.warnings.length });
  }
  fs.writeFileSync(path.join(__dirname, 'WATER_EXPORT_RESULT.json'), JSON.stringify({ fail, out }, null, 1));
  console.log(fail ? `\n${fail} FAILED` : '\nALL PASSED'); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERROR', e); process.exit(2); });

// エディターでサンプルを書き出して、フォルダへ展開する（Unity の試験用の入力を作る）。
//   node tests/export_to_folder.js <出力フォルダ> [genSample|genSample2]
const fs = require('fs'), path = require('path'); const { withPage } = require('./cdp');
(async () => {
  const out = path.resolve(process.argv[2]), gen = process.argv[3] || 'genSample'; fs.mkdirSync(out, { recursive: true });
  const url = 'file:///' + path.resolve(__dirname, '../index.html').split(path.sep).join('/') + '#size=64';
  const r = await withPage(url, async p => p.eval(`(async () => { const A = window.__app; A.${gen}(); A.state.roomId = 'water-sample-1'; A.updateTerrain && A.updateTerrain(); const e = await A.buildExport();
    return e.files.map(f => { const b = typeof f.data === 'string' ? new TextEncoder().encode(f.data) : f.data; let s = ''; for (let i = 0; i < b.length; i += 8192) s += String.fromCharCode.apply(null, b.subarray(i, i + 8192)); return { name: f.name, b64: btoa(s) }; }); })()`));
  for (const f of r) fs.writeFileSync(path.join(out, f.name), Buffer.from(f.b64, 'base64'));
  console.log('wrote', r.length, 'files to', out);
})();

const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert/strict');
const { withPage } = require('./cdp');
const root = path.resolve(__dirname, '..');
const server = http.createServer((q, r) => {
  const file = path.resolve(root, '.' + new URL(q.url, 'http://x').pathname);
  if (!file.startsWith(root + path.sep)) return r.writeHead(403).end();
  fs.readFile(file, (error, bytes) => { r.writeHead(error ? 404 : 200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); r.end(error ? '404' : bytes); });
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    await withPage('http://127.0.0.1:' + server.address().port + '/index.html#size=24', async page => {
      for (let i = 0; i < 200; i++) { if (await page.eval('!!window.__app && !__app.preparation')) break; await new Promise(r => setTimeout(r, 100)); }
      const result = await page.eval(`(async () => {
        await __app.bootReady;
        const name = document.getElementById('mapName'); name.value = '森の部屋'; name.dispatchEvent(new Event('input'));
        const original = URL.createObjectURL, click = HTMLAnchorElement.prototype.click;
        let blob = null, filename = null;
        URL.createObjectURL = value => { blob = value; return original(value); };
        HTMLAnchorElement.prototype.click = function () { filename = this.download; };
        try {
          const button = document.getElementById('saveRoom');
          await button.onclick();
          if (!blob) throw Error('部屋セットがダウンロードされませんでした: ' + document.body.innerText.slice(-1000));
          const bytes = new Uint8Array(await blob.arrayBuffer());
          let text = ''; for (let i = 0; i < bytes.length; i += 16384) text += String.fromCharCode(...bytes.subarray(i, i + 16384));
          return { filename, disabled: button.disabled, zip: btoa(text) };
        } finally { URL.createObjectURL = original; HTMLAnchorElement.prototype.click = click; }
      })()`);
      assert.equal(result.filename, '森の部屋_room.zip'); assert.equal(result.disabled, false);
      const buffer = Buffer.from(result.zip, 'base64');
      function entries(b) { const out = {}; for (let offset = 0; b.readUInt32LE(offset) === 0x04034b50;) { const size = b.readUInt32LE(offset + 18), n = b.readUInt16LE(offset + 26), extra = b.readUInt16LE(offset + 28), start = offset + 30 + n + extra; out[b.subarray(offset + 30, offset + 30 + n).toString()] = b.readUInt16LE(offset+8) === 8 ? require('node:zlib').inflateRawSync(b.subarray(start,start+size)) : b.subarray(start,start+size); offset = start + size; } return out; }
      const outer = entries(buffer), inner = entries(outer['森の部屋/森の部屋_export_unity.zip']);
      assert(!inner['map.json']);const original=outer['森の部屋/map.map'];assert(original);
      const sourceRef=JSON.parse(inner['source_ref.json']);assert.equal(require('crypto').createHash('sha256').update(original).digest('hex'),sourceRef.sha256);assert.equal(original.length,sourceRef.bytes);
      const archive=entries(original);assert.equal(JSON.parse(archive['manifest.json']).roomId,sourceRef.roomId);
      const manifest = JSON.parse(inner['manifest.json']);
      assert.equal(manifest.schemaVersion,5);assert(!inner['shared_props.json']);
      const ref=JSON.parse(inner['shared_assets.json']);assert.equal(ref.format,'tdj-shared-assets');
      for (const file of manifest.files) assert.equal(require('crypto').createHash('sha256').update(inner[file.name]).digest('hex'), file.sha256);
      const common = await page.eval(`(async()=>{let blob,name;const create=URL.createObjectURL,click=HTMLAnchorElement.prototype.click;
        URL.createObjectURL=b=>{blob=b;return create(b);};HTMLAnchorElement.prototype.click=function(){name=this.download;};
        try{await document.getElementById('saveSharedAssets').onclick();if(!blob)throw Error('共通資産のダウンロードなし');const b=new Uint8Array(await blob.arrayBuffer());let s='';for(let i=0;i<b.length;i+=16384)s+=String.fromCharCode(...b.subarray(i,i+16384));return{name,zip:btoa(s),disabled:document.getElementById('saveSharedAssets').disabled};}
        finally{URL.createObjectURL=create;HTMLAnchorElement.prototype.click=click;}})()`);
      assert.equal(common.disabled,false);
      const shared=entries(Buffer.from(common.zip,'base64'));
      const mismatches=ref.files.filter(f=>!shared[f.name]||require('crypto').createHash('sha256').update(shared[f.name]).digest('hex')!==f.sha256).map(f=>f.name);assert.deepEqual(mismatches,[]);assert.equal(common.name,'tdj-shared-'+ref.bundleHash+'.zip');
      assert.deepEqual(page.errors, []);
      console.log(JSON.stringify({ pass: true, file: result.filename, entries: Object.keys(inner).length, bytes: buffer.length, sameSource: true, browserErrors: 0 }));
    }, { hardware: true, wait: 1000, w: 1000, h: 700, initScript: "sessionStorage.setItem('me_pending','flat');" });
  } finally { server.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

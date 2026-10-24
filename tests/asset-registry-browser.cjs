const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert/strict');
const { withPage } = require('./cdp');
const root = path.resolve(__dirname, '..');
const server = http.createServer((q, r) => {
  const file = path.resolve(root, '.' + new URL(q.url, 'http://x').pathname);
  if (!file.startsWith(root + path.sep)) return r.writeHead(403).end();
  fs.readFile(file, (error, bytes) => { r.writeHead(error ? 404 : 200, { 'Content-Type': file.endsWith('.js') ? 'text/javascript' : file.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); r.end(error ? '404' : bytes); });
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{await withPage('http://127.0.0.1:'+server.address().port+'/index.html#size=24',async page=>{
  for(let i=0;i<200;i++){if(await page.eval('!!window.__app && !__app.preparation'))break;await new Promise(r=>setTimeout(r,100));}
  const result=await page.eval(`(async()=>{
   await __app.bootReady;const fs=await navigator.storage.getDirectory(),name='registry-test-'+Date.now(),root=await fs.getDirectoryHandle(name,{create:true});
   const original=window.showDirectoryPicker;window.showDirectoryPicker=async()=>root;
   try{
    await document.getElementById('saveGameFolder').onclick();const first=document.getElementById('sharedAssetsHint').textContent;
    await document.getElementById('saveGameFolder').onclick();const second=document.getElementById('sharedAssetsHint').textContent;
    const folders=[];for await(const [n,h]of root.entries())if(n.startsWith('room-'))folders.push(h);
    if(folders.length!==1)throw Error('繰り返し保存で部屋が重複: '+folders.length+' '+first+' '+second);
    const room=folders[0],receipt=JSON.parse(await(await(await room.getFileHandle('saved.txt')).getFile()).text());
    const source=await(await(await room.getFileHandle('map.json')).getFile()).text();
    const b=new Uint8Array(await(await(await room.getFileHandle('map_export_unity.zip')).getFile()).arrayBuffer());let s='';for(let i=0;i<b.length;i+=16384)s+=String.fromCharCode(...b.subarray(i,i+16384));
    const objects=await(await root.getDirectoryHandle('_shared')).getDirectoryHandle('objects');let count=0;for await(const x of objects.entries())count++;
    return{first,second,receipt,source,zip:btoa(s),objects:count,disabled:document.getElementById('saveGameFolder').disabled};
   }finally{window.showDirectoryPicker=original;await fs.removeEntry(name,{recursive:true});}
  })()`);
  assert(result.objects>50);assert.match(result.second,/素材追加 0 件/);assert(!result.disabled);
  const zip=Buffer.from(result.zip,'base64'),files={};for(let p=0;zip.readUInt32LE(p)===0x04034b50;){const len=zip.readUInt32LE(p+18),n=zip.readUInt16LE(p+26),e=zip.readUInt16LE(p+28),start=p+30+n+e;files[zip.subarray(p+30,p+30+n).toString()]=zip.readUInt16LE(p+8)===8?require('zlib').inflateRawSync(zip.subarray(start,start+len)):zip.subarray(start,start+len);p=start+len;}
  assert.equal(files['map.json'].toString(),result.source);assert(files['asset_bindings.json']);assert.deepEqual(page.errors,[]);
  console.log(JSON.stringify({pass:true,first:result.first,second:result.second,objects:result.objects,sameSource:true,browserErrors:0}));
 },{hardware:true,wait:1000,w:1000,h:700,initScript:"sessionStorage.setItem('me_pending','flat');"});}finally{server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

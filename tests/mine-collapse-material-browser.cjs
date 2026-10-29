const fs=require('fs'),http=require('http'),assert=require('assert/strict'),path=require('path');
const root=path.resolve(__dirname,'..').replace(/\\/g,'/'),out=process.env.MINE_COLLAPSE_OUTPUT||path.join(require('os').tmpdir(),'mine-collapse-material'),{withPage}=require(root+'/tests/cdp');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((q,r)=>{let name=decodeURIComponent(new URL(q.url,'http://localhost').pathname).slice(1)||'index.html';if(name.includes('..'))return r.writeHead(403).end();try{let b=fs.readFileSync(root+'/'+name);if(name==='app.js')b=Buffer.from(b.toString().replace('window.__app = {','window.__keyAudit=async(kind,seed)=>({key:await preparationKey(kind,seed),profile:preparedProfile(kind)});window.__app = {'));r.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript':name.endsWith('.html')?'text/html':'application/octet-stream'}).end(b);}catch{r.writeHead(404).end();}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const rows=[];try{
 const delayed=`const DS=DecompressionStream;const gate=new Promise(r=>window.__releasePBR=r);window.DecompressionStream=class{constructor(format){const ds=new DS(format);return{writable:ds.writable,readable:ds.readable.pipeThrough(new TransformStream({async transform(chunk,c){await gate;c.enqueue(chunk);}}))};}};`;
 for(const mode of ['pending','unsupported'])rows.push(await withPage('http://127.0.0.1:'+server.address().port+'/index.html#size=24',async p=>{
  await p.eval(`(async()=>{for(let i=0;i<600&&!window.__app;i++)await new Promise(r=>setTimeout(r,100));await __app.bootReady;})()`);
  const before=await p.eval(`(()=>{const t=TDMineCollapse.maps();window.__preview=TDMineCollapse.material().clone();window.__before=t.colour.slice();return TDMineCollapse.stats();})()`);
  if(mode==='pending'){
   assert.equal(before.status,'loading');await p.eval(`window.__exportDone=false;window.__exportTask=__app.buildExport().then(v=>{window.__exportDone=true;return v;});true`);
   await new Promise(r=>setTimeout(r,150));assert.equal(await p.eval('__exportDone'),false);await p.eval('__releasePBR();true');
  }
  const result=await p.eval(`(async()=>{const pack=await ${mode==='pending'?'__exportTask':'__app.buildExport()'},data=JSON.parse(pack.files.find(f=>f.name==='small_props.json').data),t=TDMineCollapse.maps();return{status:t.status,hasOptional:!!data.mineCollapseV1,assets:data.mineCollapseV1.assets.length,previewShares:__preview.map===TDMineCollapse.material().map,bufferChanged:t.colour.some((v,i)=>v!==__before[i]),packed:data.mineCollapseV1.textures.packed,exportAssets:data.assets.length};})()`);
  assert.equal(result.status,mode==='pending'?'ready':'fallback');assert(result.hasOptional&&result.assets===1&&result.previewShares);assert.equal(result.bufferChanged,mode==='pending');
  fs.writeFileSync(out+'/'+mode+'-packed.png',Buffer.from(result.packed,'base64'));delete result.packed;
  assert.deepEqual(p.errors,[]);return{mode,before,...result,errors:p.errors};
 },{hardware:true,w:900,h:650,wait:200,initScript:"sessionStorage.setItem('me_pending','flat');"+(mode==='pending'?delayed:'window.DecompressionStream=undefined;')}));
 fs.writeFileSync(out+'/browser-contract.json',JSON.stringify({pass:true,rows},null,2));console.log(JSON.stringify({pass:true,rows}));
 }finally{server.close();}})().catch(e=>{console.error(e);process.exitCode=1});

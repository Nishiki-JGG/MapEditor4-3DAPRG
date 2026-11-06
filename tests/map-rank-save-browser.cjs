const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {withPage}=require('./cdp'),root=path.resolve(__dirname,'..');
const inputs=process.env.MAP_RANK_INPUTS,out=process.env.MAP_RANK_OUT;
if(!inputs||!out)throw Error('Set MAP_RANK_INPUTS and MAP_RANK_OUT to private fixture/output directories');
const server=http.createServer((q,r)=>{const url=new URL(q.url,'http://local');let f;if(/^\/fixture\/(normal|boss|control)\.map$/.test(url.pathname))f=path.join(inputs,path.basename(url.pathname));else{f=path.resolve(root,'.'+url.pathname);if(!f.startsWith(root+path.sep))return r.writeHead(403).end();}fs.readFile(f,(e,b)=>r.writeHead(e?404:200,{'Content-Type':/\.(m?js)$/.test(f)?'text/javascript':f.endsWith('.html')?'text/html':'application/octet-stream'}).end(e?'404':b));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));try{await withPage('http://127.0.0.1:'+server.address().port+'/index.html#size=48',async p=>{
 await p.eval('(async()=>{for(let i=0;i<600&&!window.__app;i++)await new Promise(r=>setTimeout(r,100));await __app.bootReady;await TDStartupAssets.ensureAll();})()');
 const results=[];
 for(const name of ['normal','boss','control']){
  const loaded=await p.eval(`(async()=>{const A=__app,bytes=new Uint8Array(await(await fetch('/fixture/${name}.map')).arrayBuffer()),source=await TDMapArchive.read(bytes,A.archiveGeometry);window.rankFixture=source;const ok=await A.prepareMap('load',0,{data:source});if(!ok)return{ok,stats:A.preparationStats};const saved=A.serialize(),same=['heightsF32','splat','walkOverride','props','markers','bridges','stairs','falls'].map(k=>[k,JSON.stringify(source[k])===JSON.stringify(saved[k])]);const hash=o=>A.sha256(TDPreparedCodec.encode(o));return{ok,stats:A.preparationStats,same,surfaceBefore:hash(TDMapArchive.completedFor(source).surface),surfaceAfter:hash(A.captureCompletedSurface()),gl:A.renderer.getContext().getError()};})()`);
  assert(loaded.ok,JSON.stringify(loaded));assert(loaded.same.every(x=>x[1]),JSON.stringify(loaded.same));assert.equal(loaded.surfaceAfter,loaded.surfaceBefore,'Saved terrain must not be rebuilt');assert.equal(loaded.gl,0);assert.equal(loaded.stats.walkReused,name==='control');assert.equal(loaded.stats.walkCompatibilityRepair,name==='control'?null:'legacy-enemy-rank');
  if(name==='normal')await p.screenshot(path.join(out,'normal-loaded.png'));
  const roundtrip=await p.eval(`(async()=>{const A=__app,blob=await A.serializeArchive(),bytes=new Uint8Array(await blob.arrayBuffer()),data=await TDMapArchive.read(bytes,A.archiveGeometry),w=TDMapArchive.completedFor(data).collision.walk;const ok=await A.prepareMap('load',0,{data});return{ok,signatureVersion:w.signatureVersion,stats:A.preparationStats,bytes:bytes.length};})()`);
  assert(roundtrip.ok);assert.equal(roundtrip.signatureVersion,2);assert(roundtrip.stats.walkReused);assert.equal(roundtrip.stats.walkCompatibilityRepair,null);
  results.push({name,loaded,roundtrip});console.log(name+': loaded, terrain unchanged, saved v2 walk reused');
 }
 // A legacy marker without enemyRank must also produce a reusable signature on save.
 const legacy=await p.eval(`(async()=>{const A=__app;delete A.markers.find(m=>m.kind==='enemy').enemyRank;const bytes=new Uint8Array(await(await A.serializeArchive()).arrayBuffer()),data=await TDMapArchive.read(bytes,A.archiveGeometry),ok=await A.prepareMap('load',0,{data});return{ok,stats:A.preparationStats};})()`);assert(legacy.ok&&legacy.stats.walkReused);assert.equal(legacy.stats.walkCompatibilityRepair,null);
 assert.deepEqual(p.errors,[]);fs.writeFileSync(path.join(out,'browser-result.json'),JSON.stringify({results,legacy,errors:p.errors},null,2));
 },{hardware:true,w:1280,h:800,exactViewport:true,wait:500});}finally{server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

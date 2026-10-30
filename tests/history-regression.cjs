// 実ブラウザでUNDO/REDO、滑らかな地形の保持、不要な地形再生成を検査。
// MAP_HISTORY_FIXTURE は任意の保存JSON。ユーザーファイルは読み取りだけ。
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),{withPage}=require('./cdp');
const root=path.resolve(__dirname,'..'),fixture=process.env.MAP_HISTORY_FIXTURE;
const input=fixture?JSON.parse(fs.readFileSync(fixture,'utf8')):null;
const server=http.createServer((q,r)=>{
 const rel=decodeURIComponent(new URL(q.url,'http://localhost').pathname).slice(1)||'index.html',file=path.resolve(root,rel);
 if(rel==='fixture.json'&&fixture){r.setHeader('Content-Type','application/json');fs.createReadStream(fixture).pipe(r);return;}
 if(!file.startsWith(root+path.sep))return r.writeHead(403).end();
 fs.readFile(file,(e,b)=>{if(e)return r.writeHead(404).end();
  if(rel==='app.js')b=Buffer.from(b.toString().replace('const bootReady=',`window.historyRebuilds=0;{const original=rebuildCliffRelief;rebuildCliffRelief=function(){historyRebuilds++;return original();};}window.restoreWork={};{const counted=(name,fn)=>(...args)=>{restoreWork[name]=(restoreWork[name]||0)+1;return fn(...args);};updateTerrain=counted("updateTerrain",updateTerrain);refreshWaterData=counted("refreshWaterData",refreshWaterData);solveSprings=counted("solveSprings",solveSprings);regenGroundProps=counted("regenGroundProps",regenGroundProps);computeWalk=counted("computeWalk",computeWalk);}const bootReady=`));
  r.setHeader('Content-Type',rel.endsWith('.js')?'text/javascript':rel.endsWith('.html')?'text/html':'application/octet-stream');r.end(b);
 });
});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
 const result=await withPage('http://127.0.0.1:'+server.address().port+'/index.html#size='+(input?.size||48),async p=>{
  await p.eval(`(async()=>{for(let i=0;i<600&&!window.__app;i++)await new Promise(r=>setTimeout(r,100));await __app.bootReady;window.requestAnimationFrame=()=>0;})()`);
  if(fixture)assert(await p.eval(`(async()=>await __app.prepareMap('load',0,{data:await(await fetch('/fixture.json')).json()}))()`));
  else await p.eval(`(()=>{const A=__app,N=Math.sqrt(A.H.length);for(let j=0;j<N;j++)for(let i=0;i<N;i++)A.H[j*N+i]=Math.hypot(i-N/2,j-N/2)<N/4?4:0;A.updateTerrain();})()`);
  const result=await p.eval(`(async()=>{
   const A=__app,wait=()=>new Promise(r=>setTimeout(r,450));await wait();
   const hash=a=>A.sha256(new Uint8Array(a.buffer,a.byteOffset,a.byteLength));const shape=()=>({height:hash(A.H),splat:hash(A.S),terrain:hash(A.terrain.geometry.attributes.position.array),water:hash(A.water.geometry.attributes.position.array),fits:A.cliffFits.records.size,props:JSON.stringify(A.props)});
   const smooth=()=>A.terrain.geometry!==A.terrainSource&&A.terrain.geometry.userData.subdivision>1;
   const initial=shape(),cache=new Map(A.cliffFits.cache);
   A.setTool('place');A.state.variant.place=A.PROP.findIndex(t=>t.id==='smallbarrel');A.state.placeRandom=false;A.stroke(0,0,1);await wait();const placed=shape();
   historyRebuilds=0;let start=performance.now();A.undo();const undoMs=performance.now()-start,immediateSmooth=smooth();await wait();const undone=shape(),propUndoRebuilds=historyRebuilds;
   const reused=[...cache].every(([id,c])=>A.cliffFits.cache.get(id)===c);
   A.redo();await wait();const redone=shape();A.undo();await wait();
   const edits=[];for(const tool of ['dirt','raise']){
    const before=shape();A.setTool(tool);A.stroke(0,0,12);await wait();const edited=shape();
    historyRebuilds=0;start=performance.now();A.undo();const ms=performance.now()-start,immediate=smooth();await wait();const restored=shape(),rebuilds=historyRebuilds;
    A.redo();await wait();const repeated=shape();A.undo();await wait();
    edits.push({tool,before,edited,restored,repeated,ms,immediate,rebuilds});
   }
   const saveStart=performance.now(),saved=await A.serializeCompleted(),saveMs=performance.now()-saveStart;
   const expected=shape(),source=JSON.stringify(A.serialize()),decoded=await TDCompletedState.unpack(saved);
   const surfaceHash=hash(TDPreparedCodec.encode(decoded.surface));
   A.setTool('raise');A.stroke(0,0,20);await wait();A.snapshot();
   historyRebuilds=0;window.restoreWork={};start=performance.now();const loaded=await A.prepareMap('load',0,{data:JSON.parse(JSON.stringify(saved))});const loadMs=performance.now()-start;await wait();
   const work={...restoreWork,rebuildCliffRelief:historyRebuilds},loadedShape=shape(),loadedSource=JSON.stringify(A.serialize());
   const loadedSurface=A.snapshot().VS,loadedSurfaceHash=hash(TDPreparedCodec.encode(loadedSurface));
   const differences=[];function diff(a,b,path=''){if(differences.length>12||a===b)return;if(ArrayBuffer.isView(a)){if(!b||a.constructor!==b.constructor||a.length!==b.length||a.some((v,i)=>v!==b[i]))differences.push(path+': '+a.constructor.name+'/'+a.length+' vs '+b?.constructor.name+'/'+b?.length+' first='+a.findIndex((v,i)=>v!==b?.[i]));return;}if(a&&typeof a==='object'){for(const k of new Set([...Object.keys(a),...Object.keys(b||{})]))diff(a[k],b?.[k],path+'.'+k);}else if(a!==b)differences.push(path+':'+a+' / '+b);}diff(decoded.surface,loadedSurface);
   historyRebuilds=0;window.restoreWork={};await A.serializeCompleted();const repeatSaveWork={...restoreWork,rebuildCliffRelief:historyRebuilds};
   let corruptRejected=false;try{await TDCompletedState.unpack({...saved,waterLevel:saved.waterLevel+1});}catch(e){corruptRejected=true;}
   const completed={differences,loaded,saveMs,loadMs,rawBytes:saved.completedState.rawBytes,packedBytes:saved.completedState.data.length,sourceMatch:source===loadedSource,surfaceMatch:surfaceHash===loadedSurfaceHash,shapeMatch:JSON.stringify(expected)===JSON.stringify(loadedShape),work,repeatSaveWork,corruptRejected};
   let valid=true,ticks=0;const tick=setInterval(()=>{ticks++;valid=false;},0);let cancelled=false;
   try{await TDPreparation.each(Array.from({length:100},(_,i)=>i),()=>{const t=performance.now();while(performance.now()-t<1){}},{valid:()=>valid});}catch(e){cancelled=e.name==='AbortError';}finally{clearInterval(tick);}
   return{completed,initial,placed,undone,redone,undoMs,immediateSmooth,propUndoRebuilds,reused,edits,cancelled,ticks,gl:A.renderer.getContext().getError()};
  })()`);
  if(process.env.REPORT_FILE)fs.writeFileSync(process.env.REPORT_FILE,JSON.stringify(result,null,2));assert.deepEqual(result.undone,result.initial);assert.deepEqual(result.redone,result.placed);assert.notEqual(result.placed.props,result.initial.props);
  assert(result.immediateSmooth&&result.reused);assert.equal(result.propUndoRebuilds,0);
  for(const e of result.edits){assert(e.immediate);assert.equal(e.rebuilds,0);assert.notDeepEqual(e.edited,e.before,e.tool+" must change the source data");assert.deepEqual(e.restored,e.before);assert.deepEqual(e.repeated,e.edited);}
  assert(result.completed.loaded&&result.completed.sourceMatch&&result.completed.surfaceMatch&&result.completed.shapeMatch&&result.completed.corruptRejected);assert(Object.values(result.completed.work).every(n=>n===0),JSON.stringify(result.completed.work));assert(Object.values(result.completed.repeatSaveWork).every(n=>n===0),JSON.stringify(result.completed.repeatSaveWork));assert(result.cancelled&&result.ticks>0);assert.equal(result.gl,0);assert.deepEqual(p.errors,[]);return result;
 },{hardware:true,wait:500,w:1000,h:750,initScript:"sessionStorage.setItem('me_pending','flat');"});
 const summary={pass:true,completed:result.completed,fixture:!!fixture,undoMs:result.undoMs,propUndoRebuilds:result.propUndoRebuilds,geometryReused:result.reused,smoothDuringUndo:result.immediateSmooth,edits:result.edits.map(e=>({tool:e.tool,ms:e.ms,rebuilds:e.rebuilds})),messageChannelCancellation:result.cancelled};
 if(process.env.REPORT_FILE)fs.writeFileSync(process.env.REPORT_FILE,JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
}finally{server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

// Demand allocation must survive first placement, growth, ghosting, deletion and saved-map reload.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),{withPage}=require('./cdp');
const out=process.env.DEMAND_PROPS_OUT||path.join(root,'output/playwright/demand-props');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((q,r)=>{const p=path.resolve(root,'.'+new URL(q.url,'http://x').pathname);if(!p.startsWith(root+path.sep))return r.writeHead(403).end();fs.readFile(p,(e,b)=>{r.writeHead(e?404:200,{'Content-Type':p.endsWith('.js')?'text/javascript':p.endsWith('.html')?'text/html':'application/octet-stream'});r.end(e?'404':b);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
 const report=await withPage('http://127.0.0.1:'+server.address().port+'/index.html#size=64',async p=>{
 await p.eval('(async()=>{for(let i=0;i<900&&!window.__app;i++)await new Promise(r=>setTimeout(r,100));await __app.bootReady;})()');
 const result=await p.eval(`(async()=>{
 const a=__app;window.requestAnimationFrame=()=>0;a.genFlat();a.state.water=-10;a.updateTerrain();
 const count=()=>[...a.propMeshes,...a.ghostMeshes].filter(Boolean).length;
 if(count()!==0)throw Error('flat allocated unused props');
 const errors=[];const gl=a.renderer.getContext();
 // Each catalogue entry must remain available on its first placement, including ground-part props.
 for(let t=0;t<a.PROP.length;t++)a.props.push([t,4+(t%12)*4,4+Math.floor(t/12)*3.5,0,1,0,1,null,'lazy-'+t]);
 a.rebuildProps();a.update(0);a.render();
 if(gl.getError())throw Error('first placement GPU error');
 const all=count();const before=JSON.parse(JSON.stringify(a.serialize()));
 a.props.forEach(p=>a.ghosts.add(p));a.rebuildProps();a.render();
 if(gl.getError())throw Error('ghost GPU error');
 a.ghosts.clear();a.rebuildProps();a.render();
 const after=JSON.parse(JSON.stringify(a.serialize()));
 const same=JSON.stringify(before)===JSON.stringify(after);
 a.props.splice(0);a.rebuildProps();a.render();if(count()!==0)throw Error('unused props retained');
 const t=a.PROP.findIndex(t=>t.id==='bush'),caps=[];
 for(const n of [1,17,65]){a.props.splice(0);for(let i=0;i<n;i++)a.props.push([t,8+i%10,8+Math.floor(i/10),0,1,0,1,null,'grow-'+i]);a.rebuildProps();a.render();const m=a.propMeshes[t];if(m.count!==n||m.instanceMatrix.count<n||m.instanceMatrix.count>Math.max(16,n*2))throw Error('capacity/count');caps.push(m.instanceMatrix.count);}
 const saved=JSON.parse(JSON.stringify(a.serialize()));await a.prepareMap('load',0,{data:saved});if(a.props.length!==65)throw Error('reload count');
 a.render();return{allTypes:a.PROP.length,allocatedTypes:all,serializationUnchanged:same,growth:caps,reload:a.props.length,gl:gl.getError()};
 })()`);assert(result.serializationUnchanged);assert.equal(result.gl,0);assert.deepEqual(p.errors,[]);return {...result,errors:p.errors};
 },{hardware:true,wait:600,w:1000,h:700,initScript:"sessionStorage.setItem('me_pending','flat');"});
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

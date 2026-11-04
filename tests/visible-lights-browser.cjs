// 画面内の灯具を、手前の装飾光や40m制限で消さないことを実ブラウザで確認する。
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),{withPage}=require('./cdp');
const server=http.createServer((q,r)=>{const f=path.resolve(root,'.'+new URL(q.url,'http://x').pathname);if(!f.startsWith(root+path.sep))return r.writeHead(403).end();fs.readFile(f,(e,b)=>r.writeHead(e?404:200,{'Content-Type':f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html':'application/octet-stream'}).end(e?'404':b));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
 const report=await withPage('http://127.0.0.1:'+server.address().port+'/index.html#size=96',async p=>{
  await p.eval('(async()=>{for(let i=0;i<600&&!window.__app;i++)await new Promise(r=>setTimeout(r,100));await __app.bootReady;await TDStartupAssets.ensureAll();window.requestAnimationFrame=()=>0;})()');
  const result=await p.eval(`(()=>{const A=__app;A.props.splice(0);A.state.water=-10;A.applyBiome('cave');const torch=A.PROP.findIndex(t=>t.id==='torch'),mush=A.PROP.findIndex(t=>t.id==='glowmush');
   for(let i=0;i<6;i++)A.props.push([mush,(i-2.5)*.5,6,0,1,0,1,null,'near-mush-'+i]);
   for(let i=0;i<10;i++)A.props.push([torch,(i%5-2)*5,-(Math.floor(i/5)*14+8),0,1,0,1,null,'visible-torch-'+i]);
   A.rebuildProps();A.setMode('edit');A.cam.target.set(0,0,-4);A.cam.pitch=1.25;A.cam.yaw=0;A.cam.dist=95;
   const settle=()=>{for(let i=0;i<150;i++)A.update(1/60);A.render();return A.glowLights.filter(l=>l.intensity>.01).map(l=>l.userData.torchSlot?.target?.id)};
   const mixed=settle();
   // 40m外でも画面内なら照らす。実際の歩行カメラより広い俯瞰で境界を確認。
   A.props.splice(0);A.props.push([torch,0,-43,0,1,0,1,null,'far-visible']);A.rebuildProps();A.cam.target.set(0,0,0);A.cam.dist=110;const far=settle();
   const f=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(A.camera.projectionMatrix,A.camera.matrixWorldInverse));const farInView=f.containsPoint(new THREE.Vector3(0,1.7,-43));
   A.cam.target.set(42,0,42);A.cam.dist=5;const away=settle();
   return{mixed,far,farInView,away,slots:A.glowLights.length,shadowLights:A.glowLights.filter(l=>l.castShadow).length,gl:A.renderer.getContext().getError(),badShaders:A.renderer.info.programs.filter(p=>p.diagnostics&&!p.diagnostics.runnable).length};})()`);
  assert.equal(result.slots,16);for(let i=0;i<10;i++)assert(result.mixed.includes('visible-torch-'+i),'画面内の松明が消えた: '+i);
  assert(result.farInView);assert(result.far.includes('far-visible'));assert(!result.away.includes('far-visible'));assert(result.shadowLights<=2);assert.equal(result.gl,0);assert.equal(result.badShaders,0);assert.deepEqual(p.errors,[]);return result;
 },{hardware:true,wait:500,w:1100,h:800,exactViewport:true});console.log(JSON.stringify({pass:true,...report}));
 }finally{server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

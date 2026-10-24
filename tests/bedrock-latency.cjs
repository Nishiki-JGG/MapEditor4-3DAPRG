// 実描画の初回待ちを、CPU更新・画像転送・プログラム準備に分けて記録する。
const fs=require('fs'),path=require('path'),http=require('http'),cp=require('child_process'),assert=require('assert/strict'),{withPage}=require('./cdp');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/playwright/bedrock-latency');fs.mkdirSync(out,{recursive:true});
const noParallel=process.env.BEDROCK_NO_PARALLEL==='1';const refs=process.argv.slice(2);if(!refs.length)refs.push('9d25b6f','working');const sources=new Map();
for(const ref of refs){const m=new Map();for(const n of ['index.html','app.js','terrain/bedrock.js','terrain/bedrock-data.js'])m.set(n,ref==='working'?fs.readFileSync(path.join(root,n)):cp.execFileSync('git',['show',ref+':'+n],{cwd:root,maxBuffer:8e6}));sources.set(ref,m);}
const server=http.createServer((q,r)=>{const p=new URL(q.url,'http://x').pathname.slice(1).split('/'),ref=p.shift(),name=p.join('/');if(!sources.has(ref)||name.includes('..'))return r.writeHead(404).end();let b=sources.get(ref).get(name);if(!b){try{b=fs.readFileSync(path.join(root,name));}catch{return r.writeHead(404).end();}}if(name==='terrain/bedrock.js')b=Buffer.from(b.toString().replace('const texture=','window.bedrockImageStarted=performance.now();const texture=').replace('.load(TDBedrockData)', '.load(TDBedrockData,()=>window.bedrockImageReady=performance.now())'));r.writeHead(200,{'Content-Type':name.endsWith('.js')?'text/javascript':name.endsWith('.html')?'text/html':'application/octet-stream'}).end(b);});
async function measure(kind){
 const A=__app,R=A.renderer,gl=R.getContext(),result={kind,phases:[],image:{ready:!!TDBedrock.texture.image?.complete,loadMs:window.bedrockImageReady-window.bedrockImageStarted},parallel:!!gl.getExtension('KHR_parallel_shader_compile')};
 const calls={},wrappers=new Map();for(const name of ['compileShader','linkProgram','getProgramParameter','getShaderParameter','getShaderInfoLog','getProgramInfoLog','getUniformLocation','getActiveUniform','texImage2D','texSubImage2D','generateMipmap','drawElements','drawElementsInstanced','finish','flush','getParameter','useProgram','fenceSync','clientWaitSync']){const f=gl[name];wrappers.set(name,f);gl[name]=function(...args){const t=performance.now();try{return f.apply(this,args);}finally{const ms=performance.now()-t,q=calls[name]||(calls[name]={count:0,totalMs:0,maxMs:0});q.count++;q.totalMs+=ms;q.maxMs=Math.max(q.maxMs,ms);}};}
 let previous=performance.now(),gaps=[];const beat=setInterval(()=>{const t=performance.now();gaps.push(t-previous);previous=t;},16);
 const phase=async(name,fn)=>{for(const n of Object.keys(calls))delete calls[n];gaps=[];previous=performance.now();const t=performance.now();const value=await fn();const ms=performance.now()-t;await new Promise(r=>setTimeout(r,32));const p={name,ms,maxHeartbeatGapMs:Math.max(0,...gaps),glCalls:structuredClone(calls)};result.phases.push(p);return value;};
 try{
  A.genFlat();A.H.fill(3);A.updateTerrain();A.props.splice(0);A.rebuildProps();A.setPanel(false);A.camera.position.set(0,35,.001);A.camera.lookAt(0,3,0);A.camera.updateMatrixWorld();A.render();gl.finish();
  if(kind==='async'){
   await phase('textureUpload',()=>{R.initTexture(TDBedrock.texture);gl.finish();});
   await phase('paintCpu',()=>{A.setTool('bedrock');A.stroke(0,0,1);});
   await phase('compileAsync',async()=>{if(A.bedrockReady)await A.bedrockReady();await R.compileAsync(A.terrain.parent,A.camera);});
   await phase('firstRenderCpuAfterAsync',()=>A.render());await phase('firstGpuFinishAfterAsync',()=>gl.finish());
  }else{
   await phase('selectToolCpu',()=>A.setTool('bedrock'));
   await phase('firstPaintCpu',()=>A.stroke(0,0,1));
   await phase('firstRenderCpu',()=>A.render());await phase('firstGpuFinish',()=>gl.finish());
   if(A.bedrockReady)await phase('pendingPreparation',()=>A.bedrockReady());
   await phase('completedDraw',()=>{A.render();gl.finish();});
  }
  await phase('warmPaintCpu',()=>A.stroke(1,1,10));
  await phase('warmDraw',()=>{A.render();gl.finish();});
  await phase('fillGrassCpu',()=>A.fillGroundAll('grass'));A.render();gl.finish();
  await phase('warmFillCpu',()=>A.fillGroundAll('bedrock'));
  await phase('fillDraw',()=>{A.render();gl.finish();});
  const saved=JSON.parse(JSON.stringify(A.serialize()));A.fillGroundAll('grass');A.render();gl.finish();
  await phase('savedMapLoad',()=>A.prepareMap('load',0,{data:saved}));
  await phase('loadDraw',()=>{A.render();gl.finish();});
  await phase('rapidSwitch',()=>{for(const id of ['grass','bedrock','ice','bedrock','grass','bedrock']){A.fillGroundAll(id);A.render();}gl.finish();});
  result.programs=R.info.programs.length;result.gl=gl.getError();result.uniformCorrect=R.properties.get(A.terrain.material).uniforms.uBedrock?.value===TDBedrock.texture;
 }finally{clearInterval(beat);for(const[n,f]of wrappers)gl[n]=f;}
 return result;
}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const report={};try{for(const ref of refs){report[ref]={};for(const kind of (noParallel?['direct']:['direct','async'])){console.log('計測',ref,kind);report[ref][kind]=await withPage('http://127.0.0.1:'+server.address().port+'/'+ref+'/index.html#size=48',async p=>{for(let i=0;i<600;i++){if(await p.eval('!!window.__app'))break;await new Promise(r=>setTimeout(r,100));}await p.eval('(async()=>{await __app.bootReady;window.requestAnimationFrame=()=>0;})()');await new Promise(r=>setTimeout(r,100));const v=await p.eval('('+measure+')('+JSON.stringify(kind)+')');assert.equal(v.gl,0);assert.deepEqual(p.errors,[]);return v;},{hardware:true,exactViewport:true,w:1280,h:900,wait:1000,initScript:"sessionStorage.setItem('me_pending','flat');"+(noParallel?"for(const P of [WebGLRenderingContext.prototype,WebGL2RenderingContext.prototype]){const f=P.getExtension;P.getExtension=function(n){return n==='KHR_parallel_shader_compile'?null:f.call(this,n);};}":''),browserArgs:['--disable-gpu-shader-disk-cache']});fs.writeFileSync(path.join(out,noParallel?'latency-no-parallel.json':'latency.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ref,kind,...report[ref][kind]}));}}}finally{server.close();}})().catch(e=>{console.error(e.message);process.exitCode=1;});

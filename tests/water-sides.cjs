const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..');
const {withPage}=require(root+'/tests/cdp');
const out=path.resolve(process.argv[2]||path.join(__dirname,'verify'));fs.mkdirSync(out,{recursive:true});
const server=http.createServer((q,r)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(q.url,'http://local').pathname));if(!f.startsWith(path.resolve(root)+path.sep))return r.writeHead(403).end();fs.readFile(f,(e,b)=>{r.writeHead(e?404:200,{'Content-Type':f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html':'application/octet-stream'}).end(e?'404':b);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const report={};try{await withPage('http://127.0.0.1:'+server.address().port+'/index.html#size=24',async p=>{
for(let i=0;i<400;i++){if(await p.eval('!!window.__app'))break;await new Promise(r=>setTimeout(r,100));}
await p.eval('(async()=>{await __app.bootReady;window.requestAnimationFrame=()=>0;})()');await new Promise(r=>setTimeout(r,150));
report.wave=await p.eval(`(()=>{const A=__app,R=A.renderer,scene=new THREE.Scene(),cam=new THREE.Camera(),time={value:0},depth={value:2};
const mat=new THREE.ShaderMaterial({toneMapped:false,uniforms:{uTime:time,uWaveH:{value:.93},uDepth:depth},vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:'uniform float uTime,uWaveH,uDepth;'+TDSea.GLSL_PRELUDE+TDSea.COMMON+'void main(){vec2 p=vec2(.7,.2);float s=5.,h,ph,b;float phase=SEA_WK*s+(seaFbm(p*.03)-.5)*5.;float depth=uDepth;'+
'vec2 grad=seaWave(p,s,depth,vec2(1.,0.),vec2(0.),h,ph,b);gl_FragColor=vec4(h,grad,h+depth);}'
});
// Compute the phase's noise in the GPU once, then sample the real shared wave around the seam.
const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),mat);scene.add(quad);const rt=new THREE.WebGLRenderTarget(1,1,{type:THREE.FloatType,format:THREE.RGBAFormat,depthBuffer:false}),buf=new Float32Array(4),old=R.getRenderTarget();
const original=mat.fragmentShader;mat.fragmentShader=original.replace('gl_FragColor=vec4(h,grad,h+depth);','gl_FragColor=vec4(phase,0.,0.,1.);');mat.needsUpdate=true;
function read(){R.setRenderTarget(rt);R.render(scene,cam);R.readRenderTargetPixels(rt,0,0,1,1,buf);return Array.from(buf);}
const phase=read()[0];mat.fragmentShader=original;mat.needsUpdate=true;
let maxJump=0,minDepth=100,bad=0;
for(let cycle=1;cycle<=16;cycle++){const t=(Math.PI*2*cycle-phase)/(Math.PI*2/4.4);time.value=t-.0001;const a=read();time.value=t+.0001;const b=read();maxJump=Math.max(maxJump,Math.abs(a[0]-b[0]));}
depth.value=.08;for(let i=0;i<48;i++){time.value=i*.19;const a=read();minDepth=Math.min(minDepth,a[3]);if(a[3]<0)bad++;}
R.setRenderTarget(old);rt.dispose();quad.geometry.dispose();mat.dispose();return {maxJump,minDepth,belowBed:bad};})()`);
assert(report.wave.maxJump<.001,'Wave cycle has a discontinuity');assert(report.wave.minDepth>0,'Wave trough intersects bed');
await p.eval(`(()=>{const A=__app;A.genFlat();A.props.splice(0);A.applyBiome('beach');A.state.water=.8;A.H.fill(-2.6);A.updateTerrain();A.rebuildProps();A.refreshWaterData();A.setPanel(false);A.state.sunOn=true;A.state.timeOfDay='day';A.state.weather={kind:'gale',amount:1};A.applyAtmo();A.camera.position.set(27,4,-27);A.camera.lookAt(0,-.2,0);A.camera.updateMatrixWorld();A.setTime(5.4);})()`);
async function shot(n,exp='1'){report[n]=await p.eval(`(()=>{const A=__app;${exp};A.render();A.render();const g=A.waterSides.geometry;return {gl:A.renderer.getContext().getError(),shaderErrors:A.renderer.info.programs.filter(p=>p.diagnostics&&!p.diagnostics.runnable).map(p=>p.diagnostics),quads:g.index.count/6,visible:A.waterSides.visible,light:A.waterSides.material.uniforms.uLight.value.toArray(),single:A.waterSides.material.forceSinglePass};})()`);await p.screenshot(path.join(out,n+'.png'));assert.equal(report[n].gl,0);assert.deepEqual(report[n].shaderErrors,[]);}
await shot('sea-day');assert.equal(report['sea-day'].quads,192);assert(report['sea-day'].single);
await shot('sea-night',`A.state.timeOfDay='night';A.applyAtmo()`);
await shot('sea-evening',`A.state.timeOfDay='evening';A.applyAtmo()`);
await shot('opposite',`A.camera.position.set(-27,4,27);A.camera.lookAt(0,-.2,0);A.camera.updateMatrixWorld()`);
await shot('lava',`A.applyBiome('volcano')`);assert.equal(report.lava.visible,false);
await shot('pond',`A.applyBiome('forest');A.state.timeOfDay='day';A.state.weather.kind='none';A.applyAtmo()`);
assert.equal(report.pond.visible,true);
await shot('cave',`A.applyBiome('cave');A.state.sunOn=false;A.applyAtmo();A.updateTerrain()`);
await shot('dry',`A.H.fill(2);A.updateTerrain()`);assert.equal(report.dry.quads,0);assert.equal(report.dry.visible,false);
await shot('inland-pond',`const n=Math.sqrt(A.H.length);for(let j=0;j<n;j++)for(let i=0;i<n;i++)A.H[j*n+i]=Math.hypot(i-(n-1)/2,j-(n-1)/2)<12?-2:2;A.updateTerrain()`);assert.equal(report['inland-pond'].quads,0);
await shot('coast',`A.state.sunOn=true;A.state.timeOfDay='day';A.applyBiome('beach');A.makeCoast({x:-4,z:0},{x:8,z:0});A.updateTerrain();A.camera.position.set(23,2,-20);A.camera.lookAt(6,0,0);A.camera.updateMatrixWorld()`);
await shot('shallow-gale-night',`A.state.timeOfDay='night';A.state.weather={kind:'gale',amount:1};A.applyAtmo();A.H.fill(.72);A.updateTerrain();A.camera.position.set(10,22,10);A.camera.lookAt(0,.8,0);A.camera.updateMatrixWorld();A.setTime(2.1)`);
assert.deepEqual(p.errors,[]);report.errors=p.errors;
},{hardware:true,w:1100,h:800,exactViewport:true,wait:1000,initScript:"sessionStorage.setItem('me_pending','flat');"});fs.writeFileSync(path.join(out,'RESULT.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report.wave));}finally{server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

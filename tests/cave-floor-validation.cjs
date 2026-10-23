// 洞窟床の視覚表現だけを検査。専用Chrome/localhost。ゲームの保存・通路は保持する。
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),{withPage}=require('./cdp');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.EVIDENCE_OUT||'../cave-floor-evidence');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((q,r)=>{const f=path.resolve(root,'.'+new URL(q.url,'http://x').pathname);if(!f.startsWith(root+path.sep))return r.writeHead(403).end();fs.readFile(f,(e,b)=>{r.writeHead(e?404:200,{'Content-Type':f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html':'application/octet-stream'});r.end(e?'404':b);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));try{const report=await withPage('http://127.0.0.1:'+server.address().port+'/tests/cave-kit-view.html',async page=>{
 for(let k=0;k<300;k++){if(await page.eval('!!window.caveReady'))break;await new Promise(r=>setTimeout(r,100));}
 const result=await page.eval(`(async()=>{
 layout.value='kit';view.value='walk';damp.checked=true;slope.checked=true;arrange();
 const A=editor.contentWindow.__app,W=editor.contentWindow,T=W.THREE,checks=[];
 const check=(v,label)=>{checks.push(label);if(!v)throw Error(label);};
 const before=JSON.stringify(A.serialize()),positions=Array.from(A.terrainSource.attributes.position.array),paint=Array.from(A.S),height=Array.from(A.H),programs=A.renderer.info.programs.length;
 const walk=[];for(let z=-4;z<=4;z+=.4)for(let x=-7;x<=7;x+=.4)walk.push(A.walkable(x,z));
 const draw=[];for(const old of [true,false,true,false]){W.TDCaveFloor.active.value=old?0:1;A.render();draw.push({old,calls:A.renderer.info.render.calls,triangles:A.renderer.info.render.triangles,programs:A.renderer.info.programs.length});}
 check(JSON.stringify(A.serialize())===before,'Floor switch does not change saved map');check(JSON.stringify(Array.from(A.H))===JSON.stringify(height),'Height unchanged');check(JSON.stringify(Array.from(A.S))===JSON.stringify(paint),'Game paint unchanged');check(JSON.stringify(Array.from(A.terrainSource.attributes.position.array))===JSON.stringify(positions),'Terrain topology/positions unchanged');
 let k=0;for(let z=-4;z<=4;z+=.4)for(let x=-7;x<=7;x+=.4)check(walk[k++]===A.walkable(x,z),'Walk sample '+k);
 check(draw.every(r=>r.calls===draw[0].calls&&r.triangles===draw[0].triangles&&r.programs===draw[0].programs),'No new draw or compile on floor switch');
 const saved=A.serialize(),props=JSON.stringify(A.props);await A.prepareMap('load',0,{data:saved});check(W.TDCaveFloor.active.value===1,'Load restores cave visual');check(JSON.stringify(A.props)===props,'Save reload placements');
 for(const biome of ['forest','canyon','beach','cave']){A.applyBiome(biome);check(W.TDCaveFloor.active.value===(biome==='cave'?1:0),'Biome isolation '+biome);}A.applyBiome('cave');
 const cBefore=Array.from(A.C);A.setTool('cliffpaint');A.state.variant.cliffpaint=4;A.stroke(-5,2,1);check(A.C.some((v,i)=>v!==cBefore[i]),'Existing rock paint tool can mark local cave dampness');A.C.set(cBefore);A.applyCliffStyle();A.updateTerrain();A.rebuildProps();
 const files=(await A.buildExport()).files.map(f=>{const b=typeof f.data==='string'?new TextEncoder().encode(f.data):f.data;let s='';for(let k=0;k<b.length;k+=8192)s+=String.fromCharCode(...b.subarray(k,k+8192));return{name:f.name,b64:btoa(s)};});
 const gl=A.renderer.getContext();check(!!gl.getExtension('EXT_color_buffer_float'),'Float GPU reference available');
 const target=new T.WebGLRenderTarget(256,8,{type:T.FloatType,format:T.RGBAFormat,depthBuffer:false});target.texture.colorSpace=T.NoColorSpace;
 const probeMat=new T.ShaderMaterial({uniforms:{mode:{value:0}},vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',fragmentShader:W.TDCaveFloor.GLSL+'\\nuniform float mode;void main(){CaveFloorSample f=sampleCaveFloor(vec2((gl_FragCoord.x-.5)*.127-16.,(gl_FragCoord.y-.5)*.343-4.),.7);gl_FragColor=mode<.5?vec4(f.albedo,f.wet):vec4(f.relief,0.,0.,1.);}',depthTest:false,depthWrite:false,toneMapped:false});
 const scene=new T.Scene(),mesh=new T.Mesh(new T.PlaneGeometry(2,2),probeMat);scene.add(mesh);const camera=new T.Camera(),oldTarget=A.renderer.getRenderTarget(),probe={width:256,height:8};
 for(const [name,mode]of [['color',0],['relief',1]]){probeMat.uniforms.mode.value=mode;A.renderer.setRenderTarget(target);A.renderer.render(scene,camera);const data=new Float32Array(256*8*4);A.renderer.readRenderTargetPixels(target,0,0,256,8,data);check(Array.from(data).every(Number.isFinite),'Finite GPU '+name);probe[name]=Array.from(data);}
 A.renderer.setRenderTarget(oldTarget);target.dispose();mesh.geometry.dispose();probeMat.dispose();
 const extensions=gl.getExtension('EXT_disjoint_timer_query_webgl2'),timings=[];
 for(const old of [true,false,true,false]){W.TDCaveFloor.active.value=old?0:1;for(let i=0;i<8;i++)A.render();const q=extensions?gl.createQuery():null;if(q)gl.beginQuery(extensions.TIME_ELAPSED_EXT,q);const start=performance.now();for(let i=0;i<60;i++)A.render();const cpu=(performance.now()-start)/60;if(q)gl.endQuery(extensions.TIME_ELAPSED_EXT);let gpu=null;if(q){for(let i=0;i<100;i++){if(gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)){if(!gl.getParameter(extensions.GPU_DISJOINT_EXT))gpu=gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6/60;break;}await new Promise(r=>setTimeout(r,20));}gl.deleteQuery(q);}timings.push({old,cpuSubmitMs:cpu,gpuMs:gpu});}
 W.TDCaveFloor.active.value=1;A.render();check(!A.renderer.info.programs.some(p=>p.diagnostics&&!p.diagnostics.runnable),'Shaders runnable');check(gl.getError()===0,'No GL error');
 return{pass:true,checks:checks.length,draw,walkSamples:walk.length,files,probe,timings};})()`);
 assert.deepEqual(page.errors,[]);const ed=path.join(out,'export');fs.mkdirSync(ed,{recursive:true});for(const f of result.files)fs.writeFileSync(path.join(ed,f.name),Buffer.from(f.b64,'base64'));delete result.files;
 fs.writeFileSync(path.join(out,'floor-gpu-reference.json'),JSON.stringify(result.probe));delete result.probe;const contract=JSON.parse(fs.readFileSync(path.join(ed,'shared_ground.json'),'utf8')).caveFloor;assert.equal(contract.id,'cave-limestone-floor/1');assert(fs.existsSync(path.join(ed,contract.surfaceMaskFile)));result.contract=contract;return result;
 },{hardware:true,wait:1000,w:1000,h:800,exactViewport:true,initScript:"sessionStorage.setItem('me_pending','flat');"});fs.writeFileSync(path.join(out,'validation.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}finally{server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

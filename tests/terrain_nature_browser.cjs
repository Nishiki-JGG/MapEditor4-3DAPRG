const fs=require('fs'),path=require('path'),assert=require('assert');const {withPage}=require('./cdp');
const repo=path.resolve(__dirname,'..'),out=path.resolve(process.env.EVIDENCE_OUT||path.join(repo,'../ground-texture-evidence'));
const url='file:///'+path.join(repo,'index.html').replaceAll('\\','/')+'#size=64';
(async()=>{const results=await withPage(url,async p=>{
 await p.eval(`(()=>{const A=__app;A.genFlat();A.H.fill(3);A.props.splice(0);A.updateTerrain();A.rebuildProps();A.applyAtmo();
 document.querySelectorAll('body>:not(canvas):not(script):not(style)').forEach(e=>e.style.display='none');
 const scene=A.hero.parent;for(const o of scene.children)if(!o.isLight&&o!==A.terrain)o.visible=false;
 A.state.showGrid=false;A.state.showWalk=false;A.cam.target.set(0,3,0);A.cam.pitch=.65;A.cam.yaw=.15;return 1;})()`);
 const stats=await p.eval(`({vertices:__app.terrain.geometry.attributes.position.count,triangles:__app.terrain.geometry.index.count/3,uv:!!__app.terrain.geometry.attributes.uv,map:__app.terrain.material.map,texture:{width:__app.groundTexture.image.width,height:__app.groundTexture.image.height,mips:__app.groundTexture.generateMipmaps,min:__app.groundTexture.minFilter,aniso:__app.groundTexture.anisotropy},dpr:__app.renderer.getPixelRatio()})`);
 for(const dist of [7,17,35])for(const legacy of [true,false]){
  await p.eval(`__app.groundTrial.value=${legacy?0:1};__app.cam.dist=${dist};__app.cam.target.x=0;1`);await new Promise(r=>setTimeout(r,400));
  await p.screenshot(path.join(out,`ground-${legacy?'before':'after'}-${dist}m.png`));
  await p.eval('__app.cam.target.x=.01;1');await new Promise(r=>setTimeout(r,250));await p.screenshot(path.join(out,`ground-${legacy?'before':'after'}-${dist}m-shift.png`));
 }
 assert.equal(p.errors.length,0,JSON.stringify(p.errors));return{status:'Passed',stats,errors:p.errors,browser:'User PC Chrome via disposable headless CDP, SwiftShader; not mobile performance'};
 },{wait:7000,w:1024,h:768});fs.writeFileSync(path.join(out,'terrain-browser.json'),JSON.stringify(results,null,2));console.log(results);
})().catch(e=>{console.error(e);process.exit(1)});

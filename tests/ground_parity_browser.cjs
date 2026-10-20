const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');const{withPage}=require('./cdp');
const repo=path.resolve(__dirname,'..'),out=path.resolve(repo,'../ground-parity-evidence');
(async()=>{
 const result=await withPage('file:///'+path.join(__dirname,'ground_parity_view.html').replaceAll('\\','/'),async p=>{
  const variants=[];for(const dist of [7,17])for(const mode of ['unlit','lit'])for(const repeat of ['single','mixed']){
   await p.eval(`preview(${dist},'${mode}','${repeat}');1`);await new Promise(r=>setTimeout(r,150));await p.screenshot(path.join(out,`browser-ground-${dist}m-${mode}-${repeat}.png`));variants.push({dist,mode,repeat});
  }
  assert.equal(p.errors.length,0,JSON.stringify(p.errors));const info=await p.eval(`({width:TDGround.texture.image.width,height:TDGround.texture.image.height,textureBytes:atob(TDGroundData.imageBase64).length,parameters:TDGround.uniforms.uGroundParams.value.toArray(),offset:TDGround.uniforms.uGroundOffset.value.toArray(),waveA:TDGround.uniforms.uGroundWaveA.value.toArray(),waveB:TDGround.uniforms.uGroundWaveB.value.toArray(),glError:renderer.getContext().getError(),triangles:plane.geometry.index.count/3})`);assert.equal(info.glError,0);
  return{status:'Passed',variants,info,errors:p.errors,browser:'User PC Chrome; disposable profile; SwiftShader; no smartphone performance measurement'};
 },{wait:4000,w:1296,h:895});
 const text=fs.readFileSync(path.join(repo,'terrain/grass.js'),'utf8'),data=JSON.parse(text.split('window.TDGroundData = ')[1].trim().slice(0,-1));data.dirt=JSON.parse(fs.readFileSync(path.join(repo,'terrain/dirt.js'),'utf8').split('TDGroundData.dirt = ')[1].trim().slice(0,-1));fs.writeFileSync(path.join(out,'shared_ground.json'),JSON.stringify(data));const legacy={...data,materialVersion:2};delete legacy.dirt;fs.writeFileSync(path.join(out,'legacy_shared_ground.json'),JSON.stringify(legacy));fs.writeFileSync(path.join(out,'ground-browser.json'),JSON.stringify(result,null,2));console.log(result.info);
 await withPage('file:///'+path.join(__dirname,'terrain_nature_view.html').replaceAll('\\','/'),async p=>{for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5]){await p.eval(`old.rotation.y=pine.rotation.y=${yaw};preview('pine');1`);await new Promise(r=>setTimeout(r,150));await p.screenshot(path.join(out,`pine-crown-${Math.round(yaw*180/Math.PI)}deg.png`));}assert.equal(p.errors.length,0,JSON.stringify(p.errors));},{wait:2500,w:1296,h:895});
})().catch(e=>{console.error(e);process.exit(1)});

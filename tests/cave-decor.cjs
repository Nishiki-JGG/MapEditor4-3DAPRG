const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=process.argv[2],out=process.argv[3];fs.mkdirSync(out,{recursive:true});
const {withPage}=require(path.join(root,'tests/cdp.js'));
(async()=>{const result=await withPage('file:///'+root.replaceAll('\\','/')+'/index.html#size=24',async p=>{
 await p.eval('(async()=>{await __app.bootReady;await TDStartupAssets.ensureAll();window.requestAnimationFrame=()=>0;})()');
 await p.eval(`(()=>{const A=__app;A.genFlat();A.H.fill(0);A.state.water=-10;A.applyBiome('forest');A.state.timeOfDay='day';A.applyAtmo();A.props.splice(0);A.S.fill(0);A.state.spawn={x:10,z:10};A.updateTerrain();
 const defs=TDCaveDecorData.definitions;for(let i=0;i<defs.length;i++){const t=A.PROP.findIndex(t=>t.id===defs[i].id),x=(i%5-2)*2.7,z=(Math.floor(i/5)-1.5)*2.6;A.props.push([t,x,z,0,1,0,1,TDCaveDecor.baseY(A.PROP[t],0,1)]);}
 A.rebuildProps();A.setPanel(false);A.cam.target.set(0,.6,0);A.cam.dist=17;A.cam.pitch=.82;A.cam.yaw=.15;A.update(0);A.render();})()`);
 await new Promise(r=>setTimeout(r,800));
 const info=await p.eval(`(()=>{const A=__app;A.render();A.render();return TDCaveDecor.ids.map(id=>{const t=A.PROP.findIndex(x=>x.id===id),m=A.propMeshes[t],g=m.geometry;return{id,triangles:g.index.count/3,count:m.count,textureLoaded:m.material.map.image.complete,cutoff:m.material.alphaTest,side:m.material.side,wind:!!TDSharedProps.asset(id).wind};});})()`);
 assert.equal(info.length,20);assert.equal(info.reduce((s,x)=>s+x.triangles,0),1381);assert(info.every(x=>x.count===1&&x.textureLoaded&&x.cutoff===.5&&x.side===2));
 await p.screenshot(path.join(out,'gallery.png'));
 // Save restores stable type IDs, transforms and authored mounting pivot height.
 const roundtrip=await p.eval(`(()=>{const A=__app;A.ensureIds();const before=JSON.stringify(A.props);A.deserialize(A.serialize());return before===JSON.stringify(A.props);})()`);assert(roundtrip);
 // Cave IDs retain their contiguous order; newer kits may legitimately follow this pack.
 const appendOnly=await p.eval(`(()=>{const ids=TDProps.ids();return ids.slice(ids.indexOf('cnd001'),ids.indexOf('cnd001')+20).join(',')===TDCaveDecor.ids.join(',');})()`);assert(appendOnly);
 const fileData=await p.eval(`(async()=>{const A=__app,{files}=await A.buildExport();const names=['shared_props.json','asset_bindings.json','props.csv','asset_catalog.json'];return Object.fromEntries(files.filter(f=>names.includes(f.name)).map(f=>[f.name,typeof f.data==='string'?f.data:new TextDecoder().decode(f.data)]));})()`);
 const lib=JSON.parse(fileData['shared_props.json']),bindings=JSON.parse(fileData['asset_bindings.json']).bindings;
 assert.equal(lib.libraryVersion,'shared-registry/1');
 for(const {id} of info){const a=lib.assets.find(a=>a.id===id);assert(a);assert.equal(a.assetKey,'tdj/'+id);assert(bindings.some(b=>b.id===id&&b.sharedModel.id===id));assert(fileData['props.csv'].includes(','+id+','));}
 assert.equal(lib.textures.filter(t=>t.id==='cave-decor-atlas-v1').length,1);
 // Keep just the new subset as small, inspectable Unity-import contract evidence.
 fs.writeFileSync(path.join(out,'shared_props.json'),JSON.stringify({...lib,assets:lib.assets.filter(a=>a.id.startsWith('cnd')),textures:lib.textures.filter(t=>lib.assets.some(a=>a.id.startsWith('cnd')&&a.material.texture===t.id))}));
 fs.writeFileSync(path.join(out,'asset_bindings.json'),JSON.stringify({schemaVersion:1,bindings:bindings.filter(b=>b.id.startsWith('cnd'))}));
 fs.writeFileSync(path.join(out,'props.csv'),fileData['props.csv']);
 const packed=await p.eval(`(async()=>{const x=await __app.buildExport({sharedAssets:true});const bytes=x.sharedFiles.reduce((n,f)=>n+(typeof f.data==='string'?new TextEncoder().encode(f.data).length:f.data.length),0);return{sharedCount:x.sharedFiles.length,sharedBytes:bytes,roomHasLibrary:x.files.some(f=>f.name==='shared_props.json')};})()`);
 assert(packed.sharedCount>0);assert.equal(packed.roomHasLibrary,false);
 // The real placement event uses the same height in preview, saved data and rendered instance.
 await p.eval(`(()=>{const A=__app;A.props.splice(0);A.rebuildProps();A.setTool('place');A.state.variant.place=A.PROP.findIndex(t=>t.id==='cnd012');A.setTool('place');A.state.placeScale=1;A.state.placeRandom=false;A.state.placeRot=90;A.cam.target.set(0,0,0);A.cam.dist=12;A.cam.yaw=.3;A.cam.pitch=.8;A.update(0);A.render();const e=document.getElementById('caveDecorHeight');e.value=1.2;e.dispatchEvent(new Event('input'));})()`);
 const location=await p.eval(`(()=>{const A=__app,v=new THREE.Vector3(0,0,0).project(A.camera),r=A.renderer.domElement.getBoundingClientRect();return{x:r.left+(v.x+1)*r.width/2,y:r.top+(1-v.y)*r.height/2};})()`);
 await p.cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...location});
 await p.cdp('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,...location});
 await p.cdp('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,...location});
 const placed=await p.eval(`(()=>{const A=__app,p=A.props.at(-1);if(!p)return null;const t=A.PROP[p[0]],m=new THREE.Matrix4();A.propMeshes[p[0]].getMatrixAt(0,m);return{id:t.id,height:p[7],bottom:m.elements[13]+t.sourceMinY*p[4],ground:A.heightAt(p[1],p[2]),visible:!document.getElementById('caveDecorHeightRow').hidden};})()`);
 assert.equal(placed.id,'cnd012');assert(Math.abs(placed.bottom-placed.ground-1.2)<1e-5);assert(placed.visible);
 const gpu=await p.eval(`(()=>{const A=__app;A.render();return{gl:A.renderer.getContext().getError(),shaderErrors:A.renderer.info.programs.filter(p=>p.diagnostics?.runnable===false).length};})()`);assert.equal(gpu.gl,0);assert.equal(gpu.shaderErrors,0);assert.deepEqual(p.errors,[]);
 return{info,roundtrip,appendOnly,exported:20,atlasCount:2,packed,placed,gpu};
 },{hardware:true,wait:3000,w:1200,h:900,exactViewport:true,initScript:"sessionStorage.setItem('me_pending','flat');"});
 fs.writeFileSync(path.join(out,'RESULT.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1;});

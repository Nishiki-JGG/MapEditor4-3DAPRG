const fs=require('fs'),path=require('path'),assert=require('assert'),{withPage}=require('./cdp');
const repo=path.resolve(process.argv[2]||path.join(__dirname,'..')),phase=process.argv[3]||'after',out=path.resolve(__dirname,'../../plant-polish-evidence');fs.mkdirSync(out,{recursive:true});
(async()=>{
 const gallery=await withPage('file:///'+path.join(repo,'tests/plant_set_view.html').replaceAll('\\','/'),async p=>{
  assert(await p.eval('window.plantGalleryReady===true'));await p.screenshot(path.join(out,phase+'-gallery-initial.png'));
  for(const id of ['all','willow','hazel','bramble','ivy','sedge','dock','horsetail'])for(const angle of ['top','oblique']){await p.eval(`view('${id}','${angle}');1`);await new Promise(r=>setTimeout(r,150));await p.screenshot(path.join(out,`${phase}-${id}-${angle}.png`));}
  return{errors:p.errors};
 },{wait:6000,w:1616,h:1095});assert.equal(gallery.errors.length,0);
 const map=await withPage('file:///'+path.join(repo,'index.html').replaceAll('\\','/')+'#size=64',async p=>{
  await p.eval('window.requestAnimationFrame=()=>0;1');await new Promise(r=>setTimeout(r,150));
  const state=await p.eval(`(()=>{const A=__app;A.genFlat();A.deserialize(A.serialize());A.updateTerrain();let s=19271;const R=()=>((s=(Math.imul(s,1664525)+1013904223)>>>0)/4294967296),add=(id,x,z,k=0,scale=1)=>A.props.push([A.PROP.findIndex(t=>t.id===id),x,z,R()*Math.PI*2,scale,0,1,null]);
   for(const [id,x,z]of [['birch',-9,-8],['willow',0,-8],['scotspine',9,-8]])for(let k=0;k<3;k++)add(id,x+(R()-.5)*4,z+(R()-.5)*3,k,1+R()*.12);
   for(const [id,x,z,n,r]of [['hazel',-10,0,7,3],['bramble',-4,0,9,2.7],['ivy',3,0,13,3],['sedge',10,0,9,2.4],['dock',-9,8,13,2.5],['horsetail',-3,8,15,2.2],['foxglove',4,8,12,2.2],['grass',10,8,30,3],['reed',12,-9,7,2],['flowers',-14,-7,10,2]])for(let k=0;k<n;k++){const a=R()*Math.PI*2,d=Math.sqrt(R())*r;add(id,x+Math.cos(a)*d,z+Math.sin(a)*d,k,.8+R()*.4);}
   A.ensureIds();A.rebuildProps();A.scene=A.terrain.parent;A.scene.fog=null;const keep=new Set([A.terrain,...A.propMeshes]);for(const o of A.scene.children)if(!o.isLight&&!keep.has(o))o.visible=false;A.hero.visible=false;A.ghostMeshes.forEach(m=>m.visible=false);document.querySelectorAll('body>:not(canvas):not(script):not(style)').forEach(e=>e.style.display='none');TDPineWind.set(0,1,0,0);A.cam.pitch=Math.PI/2;A.cam.yaw=0;A.cam.dist=42;A.cam.target.set(0,3,0);A.camera.up.set(0,0,-1);A.camera.position.set(0,45,0);A.camera.lookAt(0,3,0);A.renderer.render(A.scene,A.camera);return{props:A.props.length,ids:A.PROP.map(t=>t.id),map:A.serialize(),gl:A.renderer.getContext().getError(),cameraDirection:A.camera.getWorldDirection(new THREE.Vector3()).toArray()};})()`);
  await new Promise(r=>setTimeout(r,250));await p.eval('__app.camera.position.set(0,45,0);__app.camera.lookAt(0,3,0);__app.renderer.render(__app.scene,__app.camera);1');await new Promise(r=>setTimeout(r,250));await p.screenshot(path.join(out,phase+'-map-top.png'));assert(Math.abs(state.cameraDirection[1]+1)<1e-7);
  for(const [name,x,z,dist,pitch]of [['low-close',1,2,22,Math.PI/2],['grass-close',10,8,8,Math.PI/2],['map-oblique',0,0,45,.94],['map-far',0,0,70,Math.PI/2]]){await p.eval(`(()=>{const A=__app;A.camera.position.set(${x},3+Math.sin(${pitch})*${dist},${z}+Math.cos(${pitch})*${dist});A.camera.lookAt(${x},3,${z});A.renderer.render(A.scene,A.camera);return 1;})()`);await new Promise(r=>setTimeout(r,200));await p.screenshot(path.join(out,phase+'-'+name+'.png'));}
  assert.equal(p.errors.length,0,JSON.stringify(p.errors));return{status:'Passed',...state,errors:p.errors};
 },{wait:8000,w:1616,h:1095});
 fs.writeFileSync(path.join(out,phase+'-capture.json'),JSON.stringify({status:'Passed',gallery,map,browser:'User PC Chrome disposable profile / SwiftShader',seed:19271},null,2));console.log({status:'Passed',phase,props:map.props,types:map.ids.length});
})().catch(e=>{console.error(e);process.exit(1)});

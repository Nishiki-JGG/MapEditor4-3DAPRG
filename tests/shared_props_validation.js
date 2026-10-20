// node tests/shared_props_validation.js <evidence directory> [baseline checkout]
// Uses the existing disposable CDP browser harness; no packages or user browser profile.
const fs=require('fs'),path=require('path'),assert=require('assert'),crypto=require('crypto');
const {withPage}=require('./cdp');
const out=path.resolve(process.argv[2]||'output/shared-props'),base=process.argv[3]&&path.resolve(process.argv[3]);fs.mkdirSync(out,{recursive:true});
const url=dir=>'file:///'+path.join(dir,'index.html').replaceAll('\\','/')+'#size=24';
const repo=path.resolve(__dirname,'..'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const setup=`(() => {const A=window.__app;A.genFlat();A.H.fill(0);A.props.splice(0);
 for(const [id,x,z,r,s,sy,by] of [['rock',-2,1,0,1,1,null],['fern',1,1,0,1,1,null],['rock',-2,-2,Math.PI/2,.75,1.4,1.25],['fern',2,-2,.63,1.2,.8,null],['bush',6,4,0,1,1,null]])
  A.props.push([A.PROP.findIndex(t=>t.id===id),x,z,r,s,0,sy,by]);
 A.state.catalog={types:{rock:{yawOffsetDeg:25},fern:{yawOffsetDeg:-17}},floorLinks:{}};A.applyCatalog();A.ensureIds();A.updateTerrain();A.rebuildProps();return A.serialize();})()`;
const exportExpr=`(async()=>{const e=await window.__app.buildExport();const files={};for(const f of e.files){const b=typeof f.data==='string'?new TextEncoder().encode(f.data):f.data;let s='';for(let i=0;i<b.length;i+=8192)s+=String.fromCharCode(...b.subarray(i,i+8192));files[f.name]=btoa(s);}return files;})()`;
const decode=files=>Object.fromEntries(Object.entries(files).map(([n,b])=>[n,Buffer.from(b,'base64')]));
function normalized(n,b){if(n.endsWith('.json')){const j=JSON.parse(b);const strip=o=>{if(o&&typeof o==='object'){delete o.exportedAt;Object.values(o).forEach(strip);}};strip(j);return Buffer.from(JSON.stringify(j));}return b;}
(async()=>{
 const checks=[];const check=(name,ok,detail)=>{checks.push({name,status:ok?'Passed':'Failed',detail});assert(ok,name+': '+JSON.stringify(detail));};
 let baseline;
 if(base) baseline=await withPage(url(base),async p=>{const map=await p.eval(setup);return{map,files:decode(await p.eval(exportExpr)),counts:await p.eval(`window.__app.PROP.filter(t=>['rock','fern'].includes(t.id)).map(t=>({id:t.id,triangles:(t.geo.index?t.geo.index.count:t.geo.attributes.position.count)/3,materials:1}))`)};},{wait:6500});
 const pilot=await withPage(url(repo),async p=>{
  const map=await p.eval(setup);
  if(baseline){await p.eval('window.__app.deserialize('+JSON.stringify(baseline.map)+');window.__app.rebuildProps();1');}
  const files=decode(await p.eval(exportExpr));
  const data=await p.eval(`(() => {const A=window.__app;const result=[];
   for(const id of ['rock','fern']){const t=A.PROP.find(t=>t.id===id),type=A.PROP.indexOf(t),m=A.propMeshes[type],a=TDSharedProps.asset(id),g=m.geometry;let error=0;
    for(let i=0;i<a.positions.length;i++)error=Math.max(error,Math.abs(g.attributes.position.array[i]-(i%3===2?-a.positions[i]:a.positions[i])));
    const instances=A.props.filter(p=>p[0]===type).map((p,k)=>{const matrix=new THREE.Matrix4();m.getMatrixAt(k,matrix);const world=[];for(let i=0;i<g.attributes.position.count;i++){const v=new THREE.Vector3().fromBufferAttribute(g.attributes.position,i).applyMatrix4(matrix);world.push([v.x+A.SIZE/2,v.y,A.SIZE/2-v.z]);}return{instanceId:p[8],matrix:matrix.toArray(),world,groundY:matrix.elements[13],expectedY:p[7]??A.heightAt(p[1],p[2])};});
    result.push({id,triangles:(g.index?g.index.count:g.attributes.position.count)/3,materials:1,geometryError:error,minY:g.boundingBox.min.y,alphaTest:m.material.alphaTest,transparent:m.material.transparent,side:m.material.side,lighting:m.material.type,loaded:m.material.map.image.complete,instances});
   }return result;})()`);
  await p.eval("window.__app.cam.target.set(0,.3,0);window.__app.cam.dist=13;window.__app.cam.pitch=.65;window.__app.cam.yaw=.1;window.__app.render();1");
  await new Promise(r=>setTimeout(r,700));await p.screenshot(path.join(out,'browser-editor.png'));
  check('Browser has no uncaught exceptions',p.errors.length===0,p.errors);
  return{map,files,data};
 },{wait:6500,w:1100,h:760});
 const lib=JSON.parse(pilot.files['shared_props.json']);
 check('Export uses exact authoritative data',sha(pilot.files['shared_props.json'])===sha(Buffer.from(fs.readFileSync(path.join(repo,'props/shared/assets.js'),'utf8').split('window.TDSharedData = ')[1].trim().slice(0,-1))),sha(pilot.files['shared_props.json']));
 for(const row of pilot.data){check(row.id+' geometry/ground/material',row.geometryError<1e-6&&Math.abs(row.minY)<1e-6&&row.instances.every(i=>Math.abs(i.groundY-i.expectedY)<1e-6)&&row.loaded&&row.lighting==='MeshLambertMaterial'&&!row.transparent&&row.alphaTest===(row.id==='fern'?.42:0),{triangles:row.triangles,geometryError:row.geometryError,minY:row.minY,alphaTest:row.alphaTest,lighting:row.lighting});}
 if(baseline){
  check('Baseline triangle counts unchanged',JSON.stringify(baseline.counts)===JSON.stringify(pilot.data.map(({id,triangles,materials})=>({id,triangles,materials}))),baseline.counts);
  const expectedDifferences=['asset_catalog.json','manifest.json'];const compare=[];
  for(const [n,b] of Object.entries(baseline.files)){if(expectedDifferences.includes(n))continue;compare.push({file:n,equal:normalized(n,b).equals(normalized(n,pilot.files[n]))});}
  check('Existing exports unchanged except additive catalog/manifest',compare.every(x=>x.equal),compare.filter(x=>!x.equal));
  const old=JSON.parse(baseline.files['asset_catalog.json']),now=JSON.parse(pilot.files['asset_catalog.json']);for(const x of Object.values(now.types))delete x.sharedModel;
  // The later nature batch deliberately updates these three height metadata values and appends rootfan.
  delete now.types.rootfan;for(const id of ['pine','log','stump'])if(old.types[id])now.types[id].height=old.types[id].height;
  check('Catalog existing fields unchanged',JSON.stringify(old)===JSON.stringify(now));
 }
 const exportDir=path.join(out,'export');fs.mkdirSync(exportDir,{recursive:true});for(const[n,b]of Object.entries(pilot.files))fs.writeFileSync(path.join(exportDir,n),b);
 await withPage('file:///'+path.join(__dirname,'shared_props_view.html').replaceAll('\\','/'),async p=>{
  check('Comparison renderer has no uncaught exceptions',p.errors.length===0,p.errors);await p.screenshot(path.join(out,'browser-front.png'));await p.eval('window.backView=true;window.preview(true);1');await new Promise(r=>setTimeout(r,300));await p.screenshot(path.join(out,'browser-back.png'));
  for(const mode of ['unlit','orientation','ground-rock','ground-fern','plant-7m','plant-17m','plant-17m-shift']){await p.eval('window.mode='+JSON.stringify(mode)+';window.backView=false;window.preview(false);1');await new Promise(r=>setTimeout(r,300));await p.screenshot(path.join(out,'browser-'+mode+'.png'));}
  fs.writeFileSync(path.join(out,'orientation.png'),Buffer.from(await p.eval('window.orientationPNG'),'base64'));
  check('Diagnostic renders have no exceptions',p.errors.length===0,p.errors);
 },{w:1040,h:735});
 const stats=lib.assets.map(a=>{const t=lib.textures.find(t=>t.id===a.material.texture);return{id:a.id,triangles:a.triangles.length/3,materials:1,texture:[t.width,t.height],rgba8Bytes:t.width*t.height*4,pngBytes:Buffer.from(t.png,'base64').length,alphaCutout:a.material.alphaCutoff,transparentBlending:false,fronds:a.id==='fern'?11:0};});
 fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify({checks,baselineCommit:lib.sourceCommit,stats,world:pilot.data},null,2));
 const meta=JSON.parse(pilot.files['meta.json']);
 fs.writeFileSync(path.join(out,'unity-expected.json'),JSON.stringify({instances:pilot.data.flatMap(t=>t.instances.map(i=>({instanceId:i.instanceId,world:i.world.flatMap(v=>[v[0],v[1]-meta.terrain.editorYOfZero,v[2]])})))}));
 console.log(JSON.stringify({checks:checks.length,status:'Passed',stats,exportDir},null,2));
})().catch(e=>{console.error(e);process.exit(1);});

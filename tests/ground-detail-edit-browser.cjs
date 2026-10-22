const assert=require('assert/strict'),path=require('path'),{withPage}=require('./cdp');
const repo=path.resolve(__dirname,'..');
async function exercise(){
 const A=__app;window.requestAnimationFrame=()=>0;A.genFlat();A.H.fill(3);A.updateTerrain();A.rebuildProps();
 const heights=JSON.stringify(Array.from(A.H)),paint=JSON.stringify(Array.from(A.S)),walk=Array.from({length:100},(_,i)=>A.walkable(-5+i%10,-5+Math.floor(i/10)));
 document.querySelector('#refreshGroundProps').click();A.ensureIds();
 const short=A.props.find(p=>A.PROP[p[0]].id==='shortgrass'&&p[1]>3&&p[1]<8&&p[2]>3&&p[2]<8),original=JSON.stringify(short),id=short[8];
 document.querySelector('[data-tool="detail"]').click();A.stroke(short[1],short[2],0);
 const selected=A.selectedGroundDetail()?.[8]===id;
 for(const [key,value] of [['detailX','10'],['detailZ','9'],['detailYaw','37'],['detailScale','1.3']])document.getElementById(key).value=value;
 document.getElementById('detailApply').click();const edited=A.props.find(p=>p[8]===id);
 const applied=edited[1]===10&&edited[2]===9&&Math.abs(edited[3]-37*Math.PI/180)<1e-10&&edited[4]===1.3&&edited[5]===0;
 A.undo();const undo=JSON.stringify(A.props.find(p=>p[8]===id))===original;A.redo();
 A.stroke(11,8,0,{shift:true});const shifted=A.selectedGroundDetail()[1]===11&&A.selectedGroundDetail()[2]===8;
 const held=JSON.stringify(A.selectedGroundDetail());document.querySelector('#refreshGroundProps').click();const preserved=held===JSON.stringify(A.props.find(p=>p[8]===id));
 const beforeInvalid=JSON.stringify(A.props);document.getElementById('detailScale').value='';document.getElementById('detailApply').click();const rejectsBlank=beforeInvalid===JSON.stringify(A.props);
 document.getElementById('detailScale').value='99';document.getElementById('detailApply').click();const rejectsOversize=beforeInvalid===JSON.stringify(A.props);
 // Newly authored assets are also reachable through the existing placement palette.
 document.querySelector('[data-tool="place"]').click();const litterType=A.PROP.findIndex(p=>p.id==='groundlitter');document.querySelectorAll('#variants button').forEach(b=>{if(b.textContent==='落ち葉と小枝')b.click();});A.state.placeRandom=false;A.stroke(7,2,0);
 const placeWorks=A.props.some(p=>p[0]===litterType&&p[1]===7&&p[2]===2&&p[5]===0);
 const saved=JSON.stringify(A.serialize());A.deserialize(JSON.parse(saved));const roundtrip=saved===JSON.stringify(A.serialize());
 const ex=await A.buildExport(),shared=JSON.parse(ex.files.find(f=>f.name==='shared_props.json').data);
 const meshes=['shortgrass','groundlitter'].map(id=>{const a=shared.assets.find(x=>x.id===id);let degenerate=0;for(let i=0;i<a.triangles.length;i+=3){const v=k=>new THREE.Vector3(...a.positions.slice(a.triangles[i+k]*3,a.triangles[i+k]*3+3)),o=v(0);if(v(1).sub(o).cross(v(2).sub(o)).lengthSq()<1e-16)degenerate++;}return{id,triangles:a.triangles.length/3,degenerate,finite:[...a.positions,...a.normals,...a.colors,...a.uv].every(Number.isFinite),normalUnit:a.normals.every((v,i,n)=>i%3!==0||Math.abs(Math.hypot(v,n[i+1],n[i+2])-1)<1e-5)};});
 A.setTool('detail');A.stroke(11,8,0);A.cam.target.set(11,3,8);A.cam.dist=12;A.cam.pitch=.9;A.update(.016);A.render();
 return {selected,applied,undo,shifted,preserved,rejectsBlank,rejectsOversize,placeWorks,roundtrip,heightsUnchanged:heights===JSON.stringify(Array.from(A.H)),paintUnchanged:paint===JSON.stringify(Array.from(A.S)),walkUnchanged:JSON.stringify(walk)===JSON.stringify(Array.from({length:100},(_,i)=>A.walkable(-5+i%10,-5+Math.floor(i/10)))),meshes,shaderErrors:A.renderer.info.programs.filter(p=>p.diagnostics?.runnable===false).length};
}
(async()=>{const r=await withPage('file:///'+repo.replaceAll('\\','/')+'/index.html#size=48',async p=>{const r=await p.eval('('+exercise+')()');if(process.env.GROUND_EDIT_SCREENSHOT)await p.screenshot(process.env.GROUND_EDIT_SCREENSHOT);return{...r,errors:p.errors};},{wait:5000});console.log(JSON.stringify(r));for(const [k,v] of Object.entries(r))if(typeof v==='boolean')assert(v,k);assert(r.meshes.every(a=>a.finite&&a.normalUnit&&!a.degenerate));assert.equal(r.shaderErrors,0);assert.equal(r.errors.length,0);})().catch(e=>{console.error(e);process.exitCode=1;});

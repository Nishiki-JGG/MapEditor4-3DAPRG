const assert=require('assert/strict'),fs=require('fs'),path=require('path'),{withPage}=require('./cdp');
const repo=path.resolve(__dirname,'..');
async function exercise(){
 const A=__app;window.requestAnimationFrame=()=>0;A.genFlat();A.applyBiome('forest');A.H.fill(3);A.S.fill(0);
 const N=Math.sqrt(A.H.length),half=A.SIZE/2;
 // Left dry clay / right dirt, with a submerged band at the far side.
 for(let j=0;j<N;j++)for(let i=0;i<N;i++){const k=j*N+i,x=-half+i*A.SIZE/(N-1),z=-half+j*A.SIZE/(N-1);A.S[k*9+(x<0?3:0)]=255;if(z>10)A.H[k]=A.state.water-.5;}
 A.updateTerrain();const heights=JSON.stringify(Array.from(A.H)),paint=JSON.stringify(Array.from(A.S));A.regenGroundProps();
 const isFlake=p=>A.PROP[p[0]].id.startsWith('drysoil_');const flakes=A.props.filter(isFlake);
 const confined=flakes.every(p=>p[1]<-.25&&p[2]<10&&A.heightAt(p[1],p[2])>A.state.water+.12);
 const baseline=JSON.stringify(A.props);A.regenGroundProps();const deterministic=baseline===JSON.stringify(A.props);
 A.ensureIds();const chosen=A.props.find(p=>isFlake(p)&&p[1]<-3&&p[2]>-6&&p[2]<6),id=chosen[8];A.setTool('detail');A.stroke(chosen[1],chosen[2],0);const selected=A.selectedGroundDetail()?.[8]===id;
 for(const [k,v]of [['detailX',String(chosen[1])],['detailZ',String(chosen[2])],['detailYaw','37'],['detailScale','1.1']])document.getElementById(k).value=v;
 document.getElementById('detailApply').click();const fixed=A.props.find(p=>p[8]===id),held=JSON.stringify(fixed);const edited=fixed[5]===0&&fixed[4]===1.1&&Math.abs(fixed[3]-37*Math.PI/180)<1e-10;
 A.regenGroundProps();const preserved=held===JSON.stringify(A.props.find(p=>p[8]===id));const saved=JSON.stringify(A.serialize());A.deserialize(JSON.parse(saved));const roundtrip=saved===JSON.stringify(A.serialize());
 const ex=await A.buildExport(),shared=JSON.parse(ex.files.find(f=>f.name==='shared_props.json').data);
 const models=['drysoil_curl','drysoil_cup','drysoil_flake'].map(id=>{const a=shared.assets.find(x=>x.id===id);let degenerate=0;for(let i=0;i<a.triangles.length;i+=3){const v=k=>new THREE.Vector3(...a.positions.slice(a.triangles[i+k]*3,a.triangles[i+k]*3+3)),o=v(0);if(v(1).sub(o).cross(v(2).sub(o)).lengthSq()<1e-16)degenerate++;}return{id,finite:[...a.positions,...a.normals,...a.colors,...a.uv].every(Number.isFinite),normalUnit:a.normals.every((v,i,n)=>i%3!==0||Math.abs(Math.hypot(v,n[i+1],n[i+2])-1)<1e-5),degenerate,collider:A.PROP.find(p=>p.id===id).r,texture:shared.textures.some(t=>t.id===a.material.texture)};});
 return{count:flakes.length,confined,deterministic,selected,edited,preserved,roundtrip,heightsUnchanged:heights===JSON.stringify(Array.from(A.H)),paintUnchanged:paint===JSON.stringify(Array.from(A.S)),models};
}
(async()=>{const r=await withPage('file:///'+repo.replaceAll('\\','/')+'/index.html#size=48',async p=>({...await p.eval('('+exercise+')()'),errors:p.errors}),{wait:4500});console.log(JSON.stringify(r));if(process.env.DRYSOIL_RESULT)fs.writeFileSync(process.env.DRYSOIL_RESULT,JSON.stringify(r,null,2));assert(r.count>20);for(const[k,v]of Object.entries(r))if(typeof v==='boolean')assert(v,k);assert(r.models.every(m=>m.finite&&m.normalUnit&&!m.degenerate&&m.collider===0&&m.texture));assert.equal(r.errors.length,0);})().catch(e=>{console.error(e);process.exitCode=1;});

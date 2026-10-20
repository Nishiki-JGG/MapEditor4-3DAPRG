const fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process'),assert=require('assert');
const repo=path.resolve(__dirname,'..'),ctx={THREE:require('../three.min.js'),console};ctx.window=ctx;vm.createContext(ctx);
for(const f of ['props/common.js','props/foliage.js','props/log.js','props/stump.js'])vm.runInContext(cp.execFileSync('git',['show','c9128cf:'+f],{cwd:repo,encoding:'utf8'}),ctx);
const before=ctx.TDProps.build();vm.runInContext(fs.readFileSync(path.join(repo,'props/shared/assets.js'),'utf8'),ctx);
const data=ctx.TDSharedData,checks=[];const check=(name,ok,detail)=>{checks.push({name,status:ok?'Passed':'Failed',detail});assert(ok,name)};
check('Six unique shared IDs',data.assets.length===6&&new Set(data.assets.map(a=>a.id)).size===6);
for(const a of data.assets){const n=a.positions.length/3;check(a.id+' coherent finite arrays',a.normals.length===n*3&&a.colors.length===n*3&&a.uv.length===n*2&&[...a.positions,...a.normals,...a.colors,...a.uv].every(Number.isFinite));
 let bad=0;for(let k=0;k<a.triangles.length;k+=3){const p=a.triangles.slice(k,k+3).map(i=>new ctx.THREE.Vector3(...a.positions.slice(i*3,i*3+3)));if(new ctx.THREE.Vector3().subVectors(p[1],p[0]).cross(new ctx.THREE.Vector3().subVectors(p[2],p[0])).length()<1e-10)bad++;}
 check(a.id+' no degenerate triangles and grounded',bad===0&&Math.abs(Math.min(...a.positions.filter((_,i)=>i%3===1)))<1e-6,{triangles:a.triangles.length/3,bad});
 if(['log','stump'].includes(a.id))check(a.id+' triangle budget unchanged',a.triangles.length/3===before.find(t=>t.id===a.id).geo.attributes.position.count/3,a.triangles.length/3);
}
const pine=data.assets.find(a=>a.id==='pine');let branch=Infinity,trunkRadius=0;for(let i=0;i<pine.positions.length/3;i++){if(pine.uv[i*2+1]>.5)branch=Math.min(branch,pine.positions[i*3+1]);else trunkRadius=Math.max(trunkRadius,Math.hypot(pine.positions[i*3],pine.positions[i*3+2]));}
check('Pine branches clear 1.8m agent plus 0.3m headroom',branch>=2.1,{branchMinY:branch,headGap:branch-1.8,trunkRadius,proxyRadius:.45,horizontalExtraExclusion:.45-trunkRadius,scaleYFor2_1m:2.1/branch,scaleYFor1_8m:1.8/branch,clearanceAtScalePoint8:branch*.8});
let mipBytes=(w,h)=>{let bytes=0;while(true){bytes+=w*h*4;if(w===1&&h===1)return bytes;w=Math.max(1,w>>1);h=Math.max(1,h>>1)}};
console.log(JSON.stringify({status:'Passed',checks,textures:data.textures.map(t=>({id:t.id,width:t.width,height:t.height,pngBytes:Buffer.from(t.png,'base64').length,rgba8WithMipsBytes:t.mipmaps?mipBytes(t.width,t.height):t.width*t.height*4})),addedGroundRgba8WithMipsBytes:mipBytes(512,512)},null,2));

// Prove the frozen pilot preserves the lightweight editor's source mesh (no Unity replacement).
// node tests/shared_props_source.js [baseline commit]
const fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process'),assert=require('assert');
const root=path.resolve(__dirname,'..'),ref=process.argv[2]||'c9128cf7f49c877a1aefc5fc4cf0f55f624fdfc4';
const ctx={THREE:require('../three.min.js'),console};ctx.window=ctx;vm.createContext(ctx);
for(const name of ['props/common.js','props/foliage.js','props/detail.js','props/rock.js','props/fern.js'])vm.runInContext(cp.execFileSync('git',['show',ref+':'+name],{cwd:root,encoding:'utf8'}),ctx,{filename:name});
const baseline=ctx.TDProps.build();vm.runInContext(fs.readFileSync(path.join(root,'props/shared/assets.js'),'utf8'),ctx);
const results=[];
for(const a of ctx.TDSharedData.assets.filter(a=>['rock','fern'].includes(a.id))){const old=baseline.find(t=>t.id===a.id).geo;let error=0;
 for(const[key,target]of[['position',a.positions],['normal',a.normals],['color',a.colors]]){
  const src=old.attributes[key].array;assert.equal(src.length,target.length);
  for(let i=0;i<src.length;i++){let v=src[i];if((key==='position'||key==='normal')&&i%3===2)v=-v;if(key==='position'&&i%3===1){v+=a.sourceYOffset;const g=a.groundOffsets?.find(g=>i/3>=g.firstVertex&&i/3<g.firstVertex+g.count);if(g)v+=g.deltaY;}error=Math.max(error,Math.abs(v-target[i]));}
 }
 assert(error<1e-6,a.id+' shape/normal/colour changed');assert.equal(a.triangles.length,old.attributes.position.count);
 assert(a.triangles.every((ix,i)=>ix===i-i%3+[0,2,1][i%3]));results.push({id:a.id,baselineTriangles:old.attributes.position.count/3,pilotTriangles:a.triangles.length/3,increase:0,maxErrorAfterDocumentedGroundTranslations:error,groundOffsets:a.groundOffsets||[]});
}
console.log(JSON.stringify({status:'Passed',baselineCommit:ref,results},null,2));

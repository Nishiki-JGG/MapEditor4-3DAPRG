const assert=require('assert/strict'),path=require('path'),fs=require('fs'),{withPage}=require('./cdp');
const root=process.argv[2]||path.resolve(__dirname,'..');
(async()=>{
const result=await withPage('file:///'+root.replaceAll('\\','/')+'/index.html#size=24',async p=>{
 const result=await p.eval(`(()=>{
 const A=__app;A.genFlat();A.updateTerrain();A.rebuildProps();const type=A.PROP.findIndex(t=>t.id==='cliff'),results=[];
 for(const scale of [.9,1.2])for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
  A.props.length=0;A.props.push([type,0,0,angle,scale,0]);A.rebuildProps();
  const hit=[];A.getColliders().query(0,0,5,c=>hit.push(c));
  const blocked=!A.walkable(0,0),outside=A.walkable(3,0)&&A.walkable(-3,0)&&A.walkable(0,3)&&A.walkable(0,-3);
  results.push({scale,angle,blocked,outside,meshFootprint:hit.length===1&&!!hit[0][5]});
 }
 A.render();return{results,glError:A.renderer.getContext().getError(),shaderErrors:A.renderer.info.programs.filter(x=>x.diagnostics&&!x.diagnostics.runnable).length};
 })()`);return{...result,errors:p.errors};
},{wait:4000});
for(const row of result.results){assert(row.blocked,JSON.stringify(row));assert(row.outside,JSON.stringify(row));assert(row.meshFootprint,JSON.stringify(row));}
assert.equal(result.glError,0);assert.equal(result.shaderErrors,0);assert.equal(result.errors.length,0);
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2));
console.log(JSON.stringify({pass:true,cases:result.results.length,glError:result.glError,errors:result.errors}));
})().catch(e=>{console.error(e);process.exitCode=1;});

const assert=require('node:assert/strict'),path=require('node:path'),{withPage}=require('./cdp');
const root=process.argv[2]||path.resolve(__dirname,'..');
(async()=>{
 const result=await withPage('file:///'+root.replaceAll('\\','/')+'/index.html#size=24',async p=>{
  return await p.eval(`(async()=>{
   const A=__app;A.genFlat();A.updateTerrain();A.rebuildProps();
   const hash=a=>A.sha256(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)),N=A.pavingMask.image.width,k=(N*N-1)/2;
   const empty=hash(A.pavingMask.image.data),height=hash(A.H);
   A.state.tool='cobble';A.state.radius=1;A.state.strength=1;A.stroke(0,0,40);
   const painted=hash(A.pavingMask.image.data),live=A.pavingMask.image.data[k*4]===A.S[k*9+1]&&A.S[k*9+1]>200;
   A.undo();const undo=hash(A.pavingMask.image.data)===empty;
   A.redo();const redo=hash(A.pavingMask.image.data)===painted;
   const saved=A.serialize();A.deserialize(saved);const reload=hash(A.pavingMask.image.data)===painted;
   const first=await A.buildExport(),second=await A.buildExport(),manifest=e=>JSON.parse(e.files.find(f=>f.name==='manifest.json').data);
   const repeat=manifest(first).contentHash===manifest(second).contentHash;
   A.state.tool='grass';A.stroke(0,0,40);const erase=A.pavingMask.image.data[k*4]===0&&A.S[k*9+1]===0;
   A.render();return{live,undo,redo,reload,repeat,erase,heightUnchanged:height===hash(A.H),glError:A.renderer.getContext().getError(),shaderErrors:A.renderer.info.programs.filter(x=>x.diagnostics&&!x.diagnostics.runnable).length};
  })()`);
 },{wait:4000});
 for(const k of ['live','undo','redo','reload','repeat','erase','heightUnchanged'])assert.equal(result[k],true,k);
 assert.equal(result.glError,0);assert.equal(result.shaderErrors,0);
 console.log(JSON.stringify({pass:true,...result}));
})().catch(e=>{console.error(e);process.exitCode=1;});

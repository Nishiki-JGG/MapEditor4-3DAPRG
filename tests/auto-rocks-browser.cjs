const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs'),{withPage}=require('./cdp');
const root=process.argv[2]||path.resolve(__dirname,'..'),size=+(process.argv[3]||64);
(async()=>{const result=await withPage('file:///'+root.replaceAll('\\','/')+'/index.html#size='+size,async p=>{
 const data=await p.eval(`(()=>{const A=__app;${size===48?'A.genSample2(11)':'A.genSample(7)'};A.updateTerrain();A.rebuildProps();
 const hash=a=>A.sha256(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)),height=hash(A.H),paint=hash(A.S),manual=JSON.stringify(A.props.filter(p=>p[5]!==1));
 const generated=()=>JSON.stringify(A.props.filter(p=>p[5]===1).map(p=>p.slice(0,8)));
 A.autoRocks(12345);const first=generated();A.autoRocks(67890);A.autoRocks(12345);const repeat=generated()===first;
 const points=A.props.filter(p=>p[5]===1),cliff=A.PROP.find(t=>t.id==='cliff'),width=cliff.geo.boundingBox.max.x-cliff.geo.boundingBox.min.x;
 const distance=(x,z,b)=>{const dx=b.x2-b.x1,dz=b.z2-b.z1,t=Math.max(0,Math.min(1,((x-b.x1)*dx+(z-b.z1)*dz)/(dx*dx+dz*dz)));return Math.hypot(x-b.x1-t*dx,z-b.z1-t*dz);};
 let clearFeatures=true;for(const p of points){const r=A.PROP[p[0]].id==='cliff'?width*p[4]*.55:.8*p[4];for(const b of A.bridges)if(distance(p[1],p[2],b)<b.w/2+.8+r+A.state.agent.radius-1e-5)clearFeatures=false;for(const s of A.stairs)if(distance(p[1],p[2],s)<s.w/2+.9+r+A.state.agent.radius-1e-5)clearFeatures=false;}
 const before=generated(),now=Date.now;Date.now=()=>9876;try{document.getElementById('autoRocks').click();}finally{Date.now=now;}const changed=generated();A.undo();const undo=generated()===before;A.redo();const redo=generated()===changed;
 const validation=A.runValidation();A.render();return{size:${size},count:points.length,noStretch:points.every(p=>(p[6]??1)===1),smallBoulders:points.filter(p=>A.PROP[p[0]].id==='rock').every(p=>p[4]<=.65),manualPreserved:JSON.stringify(A.props.filter(p=>p[5]!==1))===manual,heightPreserved:hash(A.H)===height,paintPreserved:hash(A.S)===paint,repeat,clearFeatures,undo,redo,validation,glError:A.renderer.getContext().getError(),shaderErrors:A.renderer.info.programs.filter(p=>p.diagnostics&&!p.diagnostics.runnable).length};})()`);return{...data,errors:p.errors};
 },{wait:4500});
 for(const key of ['noStretch','smallBoulders','manualPreserved','heightPreserved','paintPreserved','repeat','clearFeatures','undo','redo'])assert(result[key],key);
 assert(result.count>0&&result.count<150);assert.equal(result.glError,0);assert.equal(result.shaderErrors,0);assert.equal(result.errors.length,0);
 if(process.argv[4])fs.writeFileSync(process.argv[4],JSON.stringify(result,null,2));
 console.log(JSON.stringify({pass:true,size,count:result.count,clearFeatures:result.clearFeatures,validationErrors:result.validation.errors}));
})().catch(e=>{console.error(e);process.exitCode=1;});

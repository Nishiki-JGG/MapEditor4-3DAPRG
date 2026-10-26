const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const {withPage}=require('./cdp');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||path.join(root,'output/time-of-day'));
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((q,r)=>{const f=path.resolve(root,'.'+decodeURIComponent(new URL(q.url,'http://local').pathname));if(!f.startsWith(root+path.sep))return r.writeHead(403).end();fs.readFile(f,(e,b)=>{r.writeHead(e?404:200,{'Content-Type':f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html':'application/octet-stream'}).end(e?'404':b);});});
const report={};
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
 await withPage('http://127.0.0.1:'+server.address().port+'/index.html#size=24',async p=>{
  for(let i=0;i<400;i++){if(await p.eval('!!window.__app'))break;await new Promise(r=>setTimeout(r,100));}
  await p.eval('(async()=>{await __app.bootReady;window.requestAnimationFrame=()=>0;})()');
  await p.eval(`(()=>{const A=__app;A.genFlat();A.state.sunOn=true;A.applyBiome('forest');const n=Math.sqrt(A.H.length);for(let j=0;j<n;j++)for(let i=0;i<n;i++){const x=-12+i*.5,z=-12+j*.5;A.H[j*n+i]=2+.2*Math.sin(z*.6)-2.6*Math.exp(-((x+7)**2+z*z)/18);}A.props.splice(0);for(const [id,x,z,s]of [['tree',-1,-6,1],['pine',7,-5,1],['bush',4,2,1],['rock',-2,1,1],['torch',3,0,1]]){const t=A.PROP.findIndex(t=>t.id===id);if(t>=0)A.props.push([t,x,z,0,s,0]);}A.updateTerrain();A.rebuildProps();A.regenGroundProps();A.camera.position.set(19,24,23);A.camera.lookAt(0,1,0);A.camera.updateMatrixWorld();A.setTime(4);A.setPanel(false);window.originalH=Array.from(A.H);})()`);
  for(const id of ['day','evening','night']){
   report[id]=await p.eval(`(async()=>{const A=__app,s=document.getElementById('timeOfDay');s.value='${id}';s.dispatchEvent(new Event('change'));A.render();const saved=A.serialize();A.state.timeOfDay='day';A.deserialize(JSON.parse(JSON.stringify(saved)));const roundtrip=A.state.timeOfDay==='${id}';const ex=await A.buildExport({sharedAssets:true});const m=JSON.parse(ex.files.find(f=>f.name==='meta.json').data);A.setTime(4);A.render();const lights=A.terrain.parent.children.filter(o=>o.isDirectionalLight||o.isHemisphereLight).map(l=>({type:l.type,color:l.color.toArray(),intensity:l.intensity,visible:l.visible,position:l.position.toArray()}));return{roundtrip,saved:saved.timeOfDay,metadata:m.timeOfDay,manifest:m,lights,unchangedHeight:A.H.every((v,i)=>v===window.originalH[i]),gl:A.renderer.getContext().getError()};})()`);
   assert(report[id].roundtrip&&report[id].unchangedHeight,id);assert.equal(report[id].saved,id);assert.equal(report[id].metadata,id);assert.equal(report[id].gl,0);
   fs.writeFileSync(path.join(out,'meta-'+id+'.json'),JSON.stringify(report[id].manifest,null,2));delete report[id].manifest;
   await p.screenshot(path.join(out,'web-'+id+'.png'));
  }
  report.contract=await p.eval(`(async()=>{const A=__app,s=document.getElementById('timeOfDay');s.value='evening';s.dispatchEvent(new Event('change'));A.undo();const undo=A.state.timeOfDay==='night';A.redo();const redo=A.state.timeOfDay==='evening';const d=A.serialize();delete d.timeOfDay;A.deserialize(d);const legacy=A.state.timeOfDay==='day';d.timeOfDay='bogus';A.deserialize(d);const invalid=A.state.timeOfDay==='day';d.timeOfDay='night';d.sunlight=false;A.deserialize(d);const indoor=!A.state.sunOn&&s.disabled&&A.state.timeOfDay==='night';d.sunlight=true;await A.prepareMap('load',0,{data:d});const prepared=A.state.timeOfDay==='night'&&!s.disabled;return{undo,redo,legacy,invalid,indoor,prepared};})()`);
  Object.entries(report.contract).forEach(([k,v])=>assert(v,k));assert.deepEqual(p.errors,[]);report.errors=p.errors;
 },{hardware:true,w:1100,h:800,exactViewport:true,wait:1000,initScript:"sessionStorage.setItem('me_pending','flat');"});
 fs.writeFileSync(path.join(out,'WEB_RESULT.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({result:'PASS',cases:Object.keys(report),out}));
}finally{server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});


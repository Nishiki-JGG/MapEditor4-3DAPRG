const fs=require('fs'),path=require('path'),http=require('http'),{withPage}=require('./cdp');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/playwright/wall-torch');
const server=http.createServer((q,r)=>{const f=path.resolve(root,'.'+new URL(q.url,'http://x').pathname);if(!f.startsWith(root+path.sep))return r.writeHead(403).end();fs.readFile(f,(e,b)=>{r.writeHead(e?404:200,{'Content-Type':f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html':'application/octet-stream'});r.end(e?'404':b);});});
const evidenceOnly=process.env.TORCH_EVIDENCE_ONLY==='1';
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
 await withPage('http://127.0.0.1:'+server.address().port+'/tests/wall-torch-'+(evidenceOnly?'evidence':'compare')+'.html',async p=>{
  if(evidenceOnly){await p.screenshot(path.join(out,'wall-torch-comparison.png'));return;}
  await p.screenshot(path.join(out,'web-compare-close.png'));
  await p.eval('compare.pose(true);compare.frame(0);true');
  await p.screenshot(path.join(out,'web-compare-overhead.png'));
  const d=await p.eval('({metrics:compare.effect.metrics,source:TDWallTorchSource.flameMaterial,gl:compare.renderer.getContext().getError()})');
  if(d.gl||p.errors.length)throw Error(JSON.stringify({d,errors:p.errors}));
  fs.writeFileSync(path.join(out,'visual.json'),JSON.stringify({pass:true,...d},null,2));console.log(JSON.stringify(d));
 },{hardware:true,w:evidenceOnly?1600:1280,h:evidenceOnly?1040:720,exactViewport:true,wait:1000});
 }finally{server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

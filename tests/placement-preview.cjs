const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),cp=require('child_process');
const root=path.resolve(__dirname,'..'),stage=process.argv[2],out=root+'/output/preview225/'+stage,{withPage}=require('./cdp');assert(['before','after'].includes(stage));fs.mkdirSync(out,{recursive:true});
const base=cp.execFileSync('git',['show','6d6a9a0:app.js'],{cwd:root,maxBuffer:5e6,encoding:'utf8'});
const server=http.createServer((q,r)=>{const n=new URL(q.url,'http://x').pathname.slice(1)||'index.html',f=path.resolve(root,n);if(!f.startsWith(root+path.sep))return r.writeHead(403).end();fs.readFile(f,(e,b)=>{if(n==='app.js')b=Buffer.from((stage==='before'?base:b.toString()).replace('window.__app = {','window.__preview225=()=>({preview,scene});window.__app = {'));r.writeHead(e?404:200,{'Content-Type':n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':'application/octet-stream'}).end(e?'404':b);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));try{const result=await withPage('http://127.0.0.1:'+server.address().port+'/index.html#size=32',async p=>{
 await p.eval(`(async()=>{while(!window.__app)await new Promise(r=>setTimeout(r,100));await __app.bootReady;await TDStartupAssets.ensureAll();window.requestAnimationFrame=()=>0;const A=__app;A.genFlat();A.H.fill(0);A.state.water=-10;A.state.spawn={x:10,z:10};A.updateTerrain();A.setPanel(false);A.cam.target.set(0,0,2);A.cam.dist=24;A.cam.yaw=.35;A.cam.pitch=1.05;A.update(0);A.render();})()`);
 const cases=[];
 for(const [id,touch] of [['cnd014',false],['smallbarrel',false],['mine_rail_curve',true]]){
  await p.eval(`(()=>{const A=__app;A.setTool('place');A.props.splice(0);A.rebuildProps();const t=A.PROP.find(t=>t.id==='${id}');if(!t)throw Error('Missing type ${id}');[...document.querySelectorAll('#variants button')].find(b=>b.textContent===t.name).click();A.state.placeScale=1;A.state.placeRot=90;A.state.placeRandom=false;A.update(0);A.render();})()`);
  const pt=await p.eval(`(()=>{const v=new THREE.Vector3(0,0,0).project(__app.camera);return{x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};})()`);
  await p.cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...pt,button:'none',buttons:0});
  await p.eval('__app.update(0);__app.render();true');
  await p.cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...pt,button:'none',buttons:0});
  if(touch)await p.cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...pt,id:1}]});
  const preview=await p.eval(`(()=>{__app.update(0);__app.render();const{preview:q,scene}=__preview225(),t=__app.PROP[__app.state.variant.place];return{visible:q.visible,attached:q.parent===scene,sceneChildren:scene.children.filter(x=>x===q).length,geometry:q.geometry===t.geo,position:q.position.toArray(),rotation:q.rotation.y,scale:q.scale.x,order:q.renderOrder,ready:t.ready};})()`);
  const pair=await p.eval(`(()=>{const A=__app,{preview:q}=__preview225();A.render();const visible=A.renderer.domElement.toDataURL('image/png');const was=q.visible;q.visible=false;A.render();const hidden=A.renderer.domElement.toDataURL('image/png');q.visible=was;A.render();return{visible,hidden};})()`);for(const[k,v]of Object.entries(pair))fs.writeFileSync(out+'/'+id+'-'+k+'.png',Buffer.from(v.split(',')[1],'base64'));
  if(touch)await p.cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});else{await p.cdp('Input.dispatchMouseEvent',{type:'mousePressed',...pt,button:'left',buttons:1,clickCount:1});await p.cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...pt,button:'left',buttons:0,clickCount:1});}
  const placed=await p.eval(`__app.props.map(p=>({id:__app.PROP[p[0]].id,position:[p[1],p[7]??__app.heightAt(p[1],p[2]),p[2]],rotation:p[3],scale:p[4]}))`);
  const pass=preview.visible&&preview.attached&&preview.sceneChildren===1&&preview.geometry&&placed.length===1&&placed[0].id===id&&Math.abs(placed[0].rotation-preview.rotation)<1e-8&&Math.abs(placed[0].scale-preview.scale)<1e-8&&placed[0].position.every((v,i)=>Math.abs(v-preview.position[i])<1e-5);
  cases.push({id,touch,pass,preview,placed});
 }
 const guards={};
 if(stage==='after'){
  await p.eval(`(()=>{const A=__app;A.setTool('place');const t=A.PROP.find(t=>t.id==='smallbarrel');[...document.querySelectorAll('#variants button')].find(b=>b.textContent===t.name).click();t.ready=false;})()`);
  await p.cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:640,y:400,button:'none',buttons:0});
  guards.pendingHidden=await p.eval('(()=>{__app.update(0);__app.render();return !__preview225().preview.visible;})()');
  await p.eval("__app.PROP.find(t=>t.id==='smallbarrel').ready=true;true");
  await p.cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:641,y:400,button:'none',buttons:0});
  guards.readyVisible=await p.eval('(()=>{__app.update(0);__app.render();return __preview225().preview.visible&&__preview225().preview.parent===__preview225().scene;})()');
  await p.eval("__app.setTool('raise');true");
  await p.cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:642,y:400,button:'none',buttons:0});
  guards.otherToolHidden=await p.eval('(()=>{__app.update(0);__app.render();return !__preview225().preview.visible;})()');
  await p.eval("__app.setMode('play');__app.update(0);__app.render();true");
  guards.playHidden=await p.eval('(()=>{__app.update(0);__app.render();return !__preview225().preview.visible;})()');
  await p.eval("__app.setMode('edit');__app.setTool('place');__app.cam.target.set(0,0,2);__app.cam.dist=24;__app.cam.yaw=.35;__app.cam.pitch=1.05;__app.update(0);true");
  await p.cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:643,y:400,button:'none',buttons:0});
  guards.editRestored=await p.eval('(()=>{__app.update(0);__app.render();return __preview225().preview.visible&&__preview225().scene.children.filter(x=>x===__preview225().preview).length===1;})()');
  assert(Object.values(guards).every(Boolean),JSON.stringify(guards));
 }
 assert.deepEqual(p.errors,[]);return{pass:cases.every(c=>c.pass),cases,guards,errors:p.errors,scope:'Real headless mouse/touch; read-only closure getter instrumented in served app. ready guard tested by temporarily toggling existing ready state; no delayed network-load claim.'};
 },{hardware:true,w:1280,h:800,exactViewport:true,wait:500,initScript:"sessionStorage.setItem('me_pending','flat');"});fs.writeFileSync(out+'/checks.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(stage==='before')assert(!result.pass&&result.cases.every(c=>!c.preview.attached&&c.placed.length===1));else assert(result.pass);}finally{server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

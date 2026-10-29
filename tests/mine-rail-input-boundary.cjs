const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=process.env.RAIL_DRAG_ROOT||path.resolve(__dirname,'..'),out=process.env.RAIL_BOUNDARY_OUTPUT||path.join(root,'output','rail-boundary'),{withPage}=require(root+'/tests/cdp');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((q,r)=>{try{const n=decodeURIComponent(new URL(q.url,'http://x').pathname).slice(1)||'index.html';if(n.includes('..'))throw Error();const data=fs.readFileSync(root+'/'+n);r.writeHead(200,{'Content-Type':n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':'application/octet-stream'}).end(data);}catch{r.writeHead(404).end();}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));try{const result=await withPage(process.env.RAIL_DRAG_URL||('http://127.0.0.1:'+server.address().port+'/index.html#size=32'),async p=>{
await p.eval(`(async()=>{for(let i=0;i<600&&!window.__app;i++)await new Promise(r=>setTimeout(r,100));const A=__app;await A.bootReady;window.requestAnimationFrame=()=>0;A.genFlat();A.H.fill(0);A.state.water=-10;A.state.spawn={x:10,z:10};A.updateTerrain();A.setPanel(false);window.boundaryReset=(id='mine_rail_straight')=>{A.setTool('place');A.props.splice(0);A.rebuildProps();[...document.querySelectorAll('#variants button')].find(b=>b.textContent===A.PROP.find(t=>t.id===id).name).click();A.state.placeScale=1;A.state.placeRot=0;A.cam.target.set(0,0,2);A.cam.dist=24;A.cam.yaw=.35;A.cam.pitch=1.05;A.update(0);A.render();};boundaryReset();window.inputTrace=[];for(const type of ['pointerdown','pointermove','pointerup'])A.renderer.domElement.addEventListener(type,e=>inputTrace.push({type,button:e.button,buttons:e.buttons,pointerType:e.pointerType}));})()`);
const pos=async(x,z)=>p.eval(`(()=>{const v=new THREE.Vector3(${x},0,${z}).project(__app.camera);return{x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};})()`);
const mouse=async(type,pt,button='none',buttons=0)=>{await p.cdp('Input.dispatchMouseEvent',{type,...pt,button,buttons,...(type==='mouseMoved'?{}:{clickCount:1})});await p.eval('__app.update(0);__app.render();true');};
const begin=async()=>{await p.eval('boundaryReset();inputTrace.length=0;true');const a=await pos(0,0),b=await pos(0,4);await mouse('mouseMoved',a);await mouse('mousePressed',a,'left',1);await mouse('mouseMoved',b,'left',1);return b;};
const cases=[];
// Inspect while the real touch is held, then compare with its actual single placement.
await p.eval(`boundaryReset('mine_rail_curve');__app.state.placeRot=90;true`);const tp=await pos(0,0);await mouse('mouseMoved',tp);
await p.cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...tp,id:1}]});
const before=await p.eval(`(()=>{__app.update(0);__app.render();const t=__app.PROP[__app.state.variant.place],preview=__app.sun.parent.children.find(o=>o.isMesh&&o.renderOrder===9&&o.material.opacity===.65&&o.visible);return{geometryMatches:preview.geometry===t.geo,position:preview.position.toArray(),rotation:preview.rotation.y,scale:preview.scale.x,visible:preview.visible};})()`);
await p.cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
const placed=await p.eval(`__app.props.map(p=>({id:__app.PROP[p[0]].id,position:[p[1],p[7],p[2]],rotation:p[3],scale:p[4]}))`);
cases.push({name:'touch curve preview equals committed geometry and pose',pass:before.geometryMatches&&before.visible&&placed.length===1&&placed[0].id==='mine_rail_curve'&&Math.abs(placed[0].rotation-before.rotation)<1e-8&&Math.abs(placed[0].scale-before.scale)<1e-8&&placed[0].position.every((v,i)=>Math.abs(v-before.position[i])<1e-5),before,placed});
for(const [button,mask,axis]of [['right',2,'orbit'],['middle',4,'pan']]){
 const b=await begin(),initial=await p.eval('({yaw:__app.cam.yaw,target:__app.cam.target.toArray()})');
 await mouse('mousePressed',b,button,1|mask);const canceled=await p.eval("document.getElementById('railDragStatus').hidden");
 await mouse('mouseMoved',{x:b.x+45,y:b.y+20},button,1|mask);const moved=await p.eval('({yaw:__app.cam.yaw,target:__app.cam.target.toArray()})');
 await mouse('mouseReleased',{x:b.x+45,y:b.y+20},button,1);const atRelease=await p.eval('({yaw:__app.cam.yaw,target:__app.cam.target.toArray()})');
 await mouse('mouseMoved',{x:b.x+80,y:b.y+35},'left',1);const after=await p.eval('({yaw:__app.cam.yaw,target:__app.cam.target.toArray()})');
 await mouse('mouseReleased',{x:b.x+80,y:b.y+35},'left',0);
 const trace=await p.eval('inputTrace'),count=await p.eval('__app.props.length');
 const cameraMoved=axis==='orbit'?Math.abs(initial.yaw-moved.yaw)>.01:initial.target.some((v,i)=>Math.abs(v-moved.target[i])>.01);
 const onlyFirstDown=trace.filter(t=>t.type==='pointerdown').length===1;
 cases.push({name:'left + '+button+' chord cancels and hands off camera',pass:canceled&&cameraMoved&&JSON.stringify(atRelease)===JSON.stringify(after)&&count===0&&onlyFirstDown,canceled,cameraMoved,stoppedAfterButtonRelease:JSON.stringify(atRelease)===JSON.stringify(after),count,onlyFirstDown,trace});
}
const b=await begin(),start=await p.eval('__app.cam.target.toArray()');
await p.cdp('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyW',key:'w'});await p.eval('__app.update(.2);__app.render();true');
const motion=await p.eval("({active:!document.getElementById('railDragStatus').hidden,target:__app.cam.target.toArray(),previewCount:__app.sun.parent.children.filter(g=>g.isGroup).flatMap(g=>g.children).filter(o=>o.isMesh&&o.renderOrder===9&&o.material.opacity===.65).length})");
await p.cdp('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyW',key:'w'});await mouse('mouseReleased',b,'left',0);
const count=await p.eval('__app.props.length');cases.push({name:'stationary pointer with WASD movement cancels pending rails',pass:!motion.active&&motion.previewCount===0&&count===0&&start.some((v,i)=>Math.abs(v-motion.target[i])>.01),motion,count});
assert.deepEqual(p.errors,[]);return{pass:cases.every(c=>c.pass),cases,errors:p.errors,privateHeadless:true,gui:false};
},{hardware:true,w:1280,h:800,exactViewport:true,wait:500,initScript:"sessionStorage.setItem('me_pending','flat');"});fs.writeFileSync(out+'/checks.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(!result.pass)process.exitCode=1;}finally{server.close();}})().catch(e=>{fs.writeFileSync(out+'/error.txt',e.stack);console.error(e);process.exitCode=1});

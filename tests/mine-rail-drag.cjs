const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=process.env.RAIL_DRAG_ROOT||path.resolve(__dirname,'..'),out=process.env.RAIL_DRAG_OUTPUT||path.join(root,'output','rail-drag'), {withPage}=require(root+'/tests/cdp');
fs.mkdirSync(out,{recursive:true});
const server=http.createServer((q,r)=>{try{const rel=decodeURIComponent(new URL(q.url,'http://x').pathname).slice(1);if(rel.includes('..'))throw Error();const bytes=fs.readFileSync(root+'/'+(rel||'index.html'));r.writeHead(200,{'Content-Type':rel.endsWith('.js')?'text/javascript':rel.endsWith('.html')?'text/html':'application/octet-stream'}).end(bytes);}catch{r.writeHead(404).end();}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
 const result=await withPage('http://127.0.0.1:'+server.address().port+'/index.html#size=32',async p=>{
 await p.eval(`(async()=>{for(let i=0;i<600&&!window.__app;i++)await new Promise(r=>setTimeout(r,100));const A=__app;await A.bootReady;window.requestAnimationFrame=()=>0;A.genFlat();A.H.fill(0);A.state.water=-10;A.state.spawn={x:10,z:10};A.updateTerrain();A.props.splice(0);A.setPanel(false);A.setTool('place');window.choose=id=>{[...document.querySelectorAll('#variants button')].find(b=>b.textContent===A.PROP.find(t=>t.id===id).name).click();};choose('mine_rail_straight');A.state.placeScale=1;A.state.placeRot=0;A.state.placeRandom=true;A.rebuildProps();A.cam.target.set(0,0,2);A.cam.dist=29;A.cam.yaw=.35;A.cam.pitch=1.05;A.update(0);A.render();})()`);
 const pure=await p.eval(`(()=>{const A=__app,D=TDMineRailDrag,R=TDMineRails,flat=()=>0,rows=[],ok=(b,m)=>{if(!b)throw Error(m);rows.push(m)},idx=id=>A.PROP.findIndex(t=>t.id===id),row=(id,x,z,a=0,s=1,y=0)=>[idx(id),x,z,a,s,0,1,y];
 const run=(points,placed=[],angle=0,scale=1,start={x:0,z:0},floor=flat)=>{const q=D.begin(start.x,start.z,angle,scale,placed,A.PROP,floor);for(const t of points)D.update(q,{x:t[0],z:t[1]},placed,A.PROP,floor);return q;};
 const q=run([[0,6]]);ok(q.valid&&q.pieces.length===3,'three straights');
 for(const sign of [-1,1]){const a=run([[0,1.2],[sign*2,2],[sign*6,2]]);ok(a.valid&&a.pieces.length===3&&a.pieces[0].turn===sign,'replace provisional tail with '+sign+' turn');for(const item of a.pieces){const es=R.worldEnds(R.definitions.find(d=>d.id===item.id),item);for(const n of [item.start,item.end])ok(es.some(e=>Math.hypot(e.p[0]-n.x,e.p[2]-n.z)<1e-8),'actual mesh port '+sign);}
 const rows2=D.placements(a,A.PROP);for(let i=1;i<rows2.length;i++){const prev=a.pieces[i-1].end,n=a.pieces[i].start;ok(Math.hypot(prev.x-n.x,prev.z-n.z)<1e-9,'continuous '+sign+' '+i);}}
 const s=run([[0,4],[2,6],[4,6],[6,4],[6,0]]);ok(s.valid&&s.pieces.filter(p=>p.turn).length===2,'two successive bends');
 const loop=run([[2,2],[4,0],[2,-2],[0,0]]);ok(loop.valid&&loop.pieces.length===4,'four curves closed loop');D.update(loop,{x:0,z:0},[],A.PROP,flat);ok(loop.valid&&loop.pieces.length===4,'closed loop stable on pointer release');
 const back=run([[0,8],[0,2]]);ok(back.valid&&back.pieces.length===1,'retract to earlier endpoint');
 const anchor=row(R.ids[0],0,-2),conn=run([[0,4]],[anchor],Math.PI/2,1,{x:.02,z:.01});ok(conn.valid&&conn.snapped&&conn.start.rot===0,'existing start sets outward tangent');
 const close=run([[0,4]],[row(R.ids[0],0,4)]);ok(close.valid,'finish at matching existing port');
 ok(!run([[0,4]],[row(R.ids[0],0,4,Math.PI/2)]).valid,'perpendicular end rejected');
 ok(!run([[0,4]],[row(R.ids[0],0,4,0,.8)]).valid,'end scale mismatch rejected');
 ok(!run([[0,4]],[row(R.ids[0],0,4,0,1,.2)]).valid,'end height mismatch rejected');
 ok(!run([[0,4]],[row(R.ids[0],0,2)]).valid,'duplicate/interior overlap rejected');
 ok(!run([[0,4]],[anchor,row(R.ids[0],0,0)],0,1,{x:0,z:0}).valid,'occupied start rejected');
 ok(!run([[0,4]],[],0,1,{x:0,z:0},(x,z)=>z>3?.2:0).valid,'uneven ground rejected');
 ok(!run([[1.5,0]]).valid,'impossible short sideways move rejected');
 const scaled=run([[6,0]],[],Math.PI/2,1.5);ok(scaled.valid&&scaled.pieces.length===2,'scale and QE heading');
 const bounded=run([[0,200]]);ok(!bounded.valid&&bounded.pieces.length===64,'bounded stroke');
 const boundary=run([[0,6]]);D.update(boundary,{x:0,z:6},[],A.PROP,flat,(x,z,r)=>Math.abs(z)+r<5);ok(!boundary.valid,'map bounds rejected');
 const many=Array.from({length:225},(_,i)=>row(R.ids[0],20+(i%15)*4,20+Math.floor(i/15)*4)),ms=[];const load=D.begin(0,0,0,1,many,A.PROP,flat);for(let i=0;i<20;i++){const t=performance.now();D.update(load,{x:0,z:16+(i%2)*2},many,A.PROP,flat);ms.push(performance.now()-t);}window.railDragTiming={existing:225,maxStroke:64,updateMedianMs:ms.sort((a,b)=>a-b)[10],updateMaxMs:Math.max(...ms),gpuMeasured:false};ok(load.valid,'225 existing rail scene');
 const data={rows,route:D.placements(s,A.PROP)};return data;})()`);
 const move=async(x,z,type='mouseMoved',button='none',buttons=0,y=0)=>{const pos=await p.eval(`(()=>{const v=new THREE.Vector3(${x},${y},${z}).project(__app.camera);return{x:(v.x+1)*innerWidth/2,y:(1-v.y)*innerHeight/2};})()`);await p.cdp('Input.dispatchMouseEvent',{type,...pos,button,buttons,...(type==='mouseMoved'?{}:{clickCount:1})});await p.eval('__app.update(0);__app.render();true');return pos;};
 const down=(x,z)=>move(x,z,'mousePressed','left',1),up=(x,z)=>move(x,z,'mouseReleased','left',0),drag=(x,z)=>move(x,z,'mouseMoved','left',1);
 const count=()=>p.eval('__app.props.length'),status=()=>p.eval(`({active:!document.getElementById('railDragStatus').hidden,text:document.getElementById('railDragStatus').textContent})`);
 await move(0,0);await down(0,0);await drag(0,6);assert.equal(await count(),0);assert((await status()).text.startsWith('3部品'));assert.equal(await p.eval('__app.serialize().props.length'),0);await p.screenshot(out+'/preview-straight.png');
 await p.cdp('Input.dispatchKeyEvent',{type:'keyDown',code:'KeyE',key:'e'});await p.cdp('Input.dispatchKeyEvent',{type:'keyUp',code:'KeyE',key:'e'});
 const loc=await move(0,6,'mouseMoved','left',1);await p.cdp('Input.dispatchMouseEvent',{type:'mouseWheel',...loc,deltaY:-120,deltaX:0,modifiers:2});
 assert.deepEqual(await p.eval('({scale:__app.state.placeScale,rot:__app.state.placeRot})'),{scale:1,rot:0});await up(0,6);assert.equal(await count(),3);
 await p.eval('__app.undo();true');assert.equal(await count(),0);await p.eval('__app.redo();true');assert.equal(await count(),3);
 await down(0,6);await drag(2,8);await drag(6,8);assert.equal(await count(),3);await p.screenshot(out+'/preview-bend.png');await up(6,8);assert.equal(await count(),6);
 const final=await p.eval('__app.props.map(p=>p.slice())');await p.screenshot(out+'/placed-route.png');
 for(const mode of ['escape','cancel','blur','type','tool','mode','capture']){
   await p.eval(`__app.setMode('edit');__app.setTool('place');choose('mine_rail_straight');true`);await down(-6,-4);await drag(-6,0);
   if(mode==='escape'){await p.cdp('Input.dispatchKeyEvent',{type:'keyDown',code:'Escape',key:'Escape'});await p.cdp('Input.dispatchKeyEvent',{type:'keyUp',code:'Escape',key:'Escape'});}
   else await p.eval(mode==='cancel'?`__app.renderer.domElement.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,pointerType:'mouse'}));true`:mode==='blur'?`window.dispatchEvent(new Event('blur'));true`:mode==='type'?`choose('mine_rail_end');true`:mode==='tool'?`__app.setTool('pick');true`:mode==='mode'?`__app.setMode('play');true`:`__app.renderer.domElement.dispatchEvent(new PointerEvent('lostpointercapture',{pointerId:1}));true`);
   await up(-6,0);assert.equal(await count(),6,mode);assert(!(await status()).active,mode);
 }
 await p.eval(`__app.setMode('edit');__app.setTool('place');choose('mine_rail_straight');true`);await down(0,2);await drag(0,6);assert(!(await status()).text.includes('離す'));await up(0,6);assert.equal(await count(),6);
 await down(-6,-4);await drag(-4.5,-4);assert(!(await status()).text.includes('離す'));await p.screenshot(out+'/invalid-short-turn.png');await up(-4.5,-4);assert.equal(await count(),6);
 await p.eval(`choose('mine_rail_end');true`);await down(-6,0);await up(-6,0); // requested rotation does not match; still regular one-piece placement
 assert.equal(await count(),7);await p.eval('__app.undo();true');assert.equal(await count(),6);
 const reload=await p.eval(`(async()=>{const A=__app,d=JSON.parse(JSON.stringify(A.serialize())),before=JSON.stringify(d.props);const success=await A.prepareMap('load',0,{data:d});return{success,equal:before===JSON.stringify(A.serialize().props),count:A.props.length};})()`);assert(reload.success&&reload.equal);assert.equal(reload.count,6);
 const pack=await p.eval(`(async()=>{const result=await __app.buildExport();return Object.fromEntries(result.files.filter(f=>['props.csv','asset_catalog.json','small_props.json'].includes(f.name)).map(f=>[f.name,f.data]));})()`);
 for(const [name,data]of Object.entries(pack))fs.writeFileSync(out+'/'+name,data);
 await p.eval(`__app.setTool('place');choose('mine_rail_straight');true`);await down(-6,-6);for(const [x,z]of [[-4,-4],[-2,-6],[-4,-8],[-6,-6]])await drag(x,z);await up(-6,-6);assert.equal(await count(),10,'closed loop commits on mouse release');await p.eval('__app.undo();true');assert.equal(await count(),6,'loop one undo');
 await p.eval(`__app.setTool('place');choose('smallbarrel');__app.state.placeRandom=false;true`);await down(-6,0);await drag(-6,4);await up(-6,4);assert.equal(await count(),7,'ordinary prop still only one placement');await p.eval('__app.undo();true');assert.equal(await count(),6);
 await p.eval(`(()=>{const A=__app;A.props.splice(0);A.H.fill(3.5);A.tunnels=[{id:'drag-floor',style:'mine',w:2.4,h:2.8,pts:[{x:0,z:-7,y:0},{x:0,z:7,y:0}]}];A.updateTerrain();A.rebuildTunnels();A.setTool('place');choose('mine_rail_straight');A.state.placeScale=1;A.state.placeRot=0;A.cam.target.set(0,0,0);A.update(0);A.render();return true;})()`);await down(0,-4);await drag(0,4);await up(0,4);assert.equal(await count(),4,'underground drag count');assert(await p.eval('__app.props.every(p=>p[7]===0)'), 'actual tunnel floor, not terrain roof');await p.screenshot(out+'/tunnel-floor.png');
 assert.deepEqual(p.errors,[]);
 return{pass:true,pure:pure.rows,final,reload,cancelModes:['escape','cancel','blur','type','tool','mode','capture'],oneStrokeOneUndo:true,dragScaleHeadingLocked:true,ordinaryPropUnchanged:true,undergroundFloor:true,timing:await p.eval('railDragTiming'),errors:p.errors,privateHeadless:true,gui:false};
 },{hardware:true,w:1280,h:800,exactViewport:true,wait:500,initScript:"sessionStorage.setItem('me_pending','flat');"});
 fs.writeFileSync(out+'/checks.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{server.close();}})().catch(e=>{fs.writeFileSync(out+'/error.txt',e.stack);console.error(e);process.exitCode=1});

const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),{withPage}=require('./cdp');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/playwright/pureblack');
const server=http.createServer((q,r)=>{const name=new URL(q.url,'http://x').pathname,f=path.resolve(root,'.'+name);if(!f.startsWith(root+path.sep))return r.writeHead(403).end();fs.readFile(f,(e,b)=>r.writeHead(e?404:200,{'Content-Type':name.endsWith('.js')?'text/javascript':name.endsWith('.html')?'text/html':'application/octet-stream'}).end(e?'404':b));});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let report;try{await withPage('http://127.0.0.1:'+server.address().port+'/index.html#size=24',async p=>{
 for(let i=0;i<400;i++){if(await p.eval('!!window.__app'))break;await sleep(50);}await p.eval('(async()=>{await __app.bootReady;})()');
 await p.eval("(()=>{const A=__app;A.genFlat();A.H.fill(3);A.props.splice(0);A.rebuildProps();A.updateTerrain();A.state.radius=3;A.state.strength=1;A.setPanel(false);document.querySelector('[data-tool=pureblack]').click();})()");
 const pos=await p.eval('(()=>{const A=__app,p=new THREE.Vector3(0,3,0).project(A.camera);return{x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};})()');
 await p.cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...pos});await p.cdp('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...pos});await sleep(700);await p.cdp('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...pos});
 const painted=await p.eval('({hash:__app.sha256(__app.S),count:__app.S.reduce((n,v,i)=>n+(i%11===10&&v>0?1:0),0),center:__app.S[((__app.H.length-1)/2)*11+10]})');assert(painted.count>0&&painted.center>0);
 for(const type of ['keyDown','keyUp'])await p.cdp('Input.dispatchKeyEvent',{type,key:'z',code:'KeyZ',modifiers:type==='keyDown'?2:0,windowsVirtualKeyCode:90});
 const undone=await p.eval('__app.S.every((v,i)=>i%11!==10||v===0)');assert(undone);
 for(const type of ['keyDown','keyUp'])await p.cdp('Input.dispatchKeyEvent',{type,key:'y',code:'KeyY',modifiers:type==='keyDown'?2:0,windowsVirtualKeyCode:89});
 assert.equal(await p.eval('__app.sha256(__app.S)'),painted.hash);
 await p.eval("document.getElementById('fillGround').value='pureblack';document.getElementById('fillGroundAll').click();__app.setPanel(true);true");
 await p.screenshot(path.join(out,'selection-ui.png'));
 const filled=await p.eval('__app.S.every((v,i)=>v===(i%11===10?255:0))');assert(filled);report={painted,keyboardUndo:undone,keyboardRedo:true,fillUI:filled,gl:await p.eval('__app.renderer.getContext().getError()'),errors:p.errors};assert.equal(report.gl,0);assert.deepEqual(p.errors,[]);report.pass=true;
 },{hardware:true,w:1280,h:900,exactViewport:true,wait:1000,initScript:"sessionStorage.setItem('me_pending','flat');"});}finally{server.close();fs.writeFileSync(path.join(out,'input-verification.json'),JSON.stringify(report,null,2));}console.log(JSON.stringify(report));})().catch(e=>{console.error(e.stack);process.exitCode=1;});

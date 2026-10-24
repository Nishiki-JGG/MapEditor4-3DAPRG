// 入力イベント・携帯表示・旧JSON・書き出しチャンネルを実ブラウザーで確認する。
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{withPage}=require('./cdp');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/playwright/bedrock');
(async()=>{const all=[];for(const mobile of [false,true]){
 const r=await withPage('file:///'+root.replaceAll('\\','/')+'/index.html#size=24',async p=>{
  await p.eval('(async()=>{await __app.bootReady;const A=__app;A.genFlat();A.H.fill(3);A.updateTerrain();A.setPanel(false);A.setTool("bedrock");A.state.radius=3;A.state.strength=1;})()');
  const initial=await p.eval('({shader:!!__app.terrain.material.defines?.BEDROCK_FLOOR,uploaded:!!__app.renderer.properties.get(TDBedrock.texture).__webglTexture})');assert(!initial.shader&&!initial.uploaded);
  await new Promise(r=>setTimeout(r,200));
  const pos=await p.eval('(()=>{const A=__app,r=document.getElementById("view").getBoundingClientRect(),v=new THREE.Vector3(0,3,0).project(A.camera);return{x:r.x+(v.x+1)*r.width/2,y:r.y+(1-v.y)*r.height/2};})()');
  if(mobile)await p.cdp('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:pos.x,y:pos.y}]});
  else{await p.cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...pos});await p.cdp('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,...pos});}
  await new Promise(r=>setTimeout(r,1200));
  if(mobile)await p.cdp('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  else await p.cdp('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,...pos});
  await p.eval('__app.bedrockReady()');await new Promise(r=>setTimeout(r,50));
  await p.screenshot(path.join(out,mobile?'mobile-input.png':'mouse-input.png'));
  const result=await p.eval(`(async()=>{const A=__app,ns=A.S.length/A.H.length,k=(A.H.length-1)/2,paint=A.S[k*ns+9];A.fillGroundAll('bedrock');const ex=await A.buildExport(),meta=JSON.parse(ex.files.find(f=>f.name==='meta.json').data);const px=async name=>{const f=ex.files.find(f=>f.name===name),im=await createImageBitmap(new Blob([f.data],{type:'image/png'})),c=document.createElement('canvas');c.width=im.width;c.height=im.height;c.getContext('2d').drawImage(im,0,0);return Array.from(c.getContext('2d').getImageData(0,0,1,1).data);};const masks=await px('mask_3.png'),weights=await px('weights_3.png');A.fillGroundAll('grass');const old=A.serialize(),bytes=new Uint8Array(A.H.length*9);for(let k=0;k<A.H.length;k++)bytes[k*9]=255;let s='';for(const b of bytes)s+=String.fromCharCode(b);old.splat=btoa(s);A.deserialize(old);const priorSave=A.S.every((v,i)=>v===(i%10===0?255:0));return{paint,touch:A.TOUCH,masks,weights,priorSave,exportTexture:ex.files.some(f=>f.name==='bedrock.png'),requiresFeature:meta.requiredFeatures.includes('bedrockFloorV1'),maskChannels:meta.textures['mask_3.png'].channels,layerOrder:meta.groundBlend.layers,gl:A.renderer.getContext().getError()};})()`);
  return{mobile,initial,...result,errors:p.errors};
 },{hardware:true,fileAccess:false,w:mobile?844:1280,h:mobile?390:900,exactViewport:true,mobile,hasTouch:mobile,wait:1500,initScript:"sessionStorage.setItem('me_pending','flat');"});all.push(r);assert(r.paint>0,'入力で実際に岩盤が塗られる');assert(r.priorSave&&r.exportTexture&&r.requiresFeature);assert.deepEqual(r.masks,[0,255,0,255]);assert.deepEqual(r.weights,[0,0,255,255]);assert.equal(r.gl,0);assert.deepEqual(r.errors,[]);}
fs.writeFileSync(path.join(out,'input-export.json'),JSON.stringify(all,null,2));console.log(JSON.stringify(all));})().catch(e=>{console.error(e);process.exitCode=1;});

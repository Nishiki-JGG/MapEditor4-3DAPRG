// 公開実体のバイト一致、VFX配置、固定サンプルとTABの再生成0を確認。
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),crypto=require('crypto'),{execFileSync}=require('child_process'),{withPage}=require('./cdp');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/playwright/wall-torch'),base=process.env.TORCH_URL||'https://nishiki-jgg.github.io/MapEditor4-3DAPRG/';
const report={pass:false,url:base,commit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),files:[],samples:[]};
const save=()=>fs.writeFileSync(path.join(out,'published.json'),JSON.stringify(report,null,2)),wait=ms=>new Promise(r=>setTimeout(r,ms));
const init="window.cliffRegenerations=0;let layer;Object.defineProperty(window,'TDCliffLayering',{configurable:true,get:()=>layer,set:v=>{layer=v;v.fitAsync=async()=>{cliffRegenerations++;throw Error('固定サンプル再生成禁止');};}});";
(async()=>{
 const files=execFileSync('git',['diff','--name-only','bfc47bd','HEAD','--','index.html','app.js','props/wall_torch.js','props/wall-torch-source.js','prepared','tunnels.js'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/).filter(f=>f&&fs.existsSync(path.join(root,f)));
 const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
 for(const file of files){const response=await fetch(new URL(file,base)+'?verify='+report.commit);assert.equal(response.status,200,file);const expected=hash(execFileSync('git',['show','HEAD:'+file],{cwd:root,maxBuffer:64*1024*1024})),actual=hash(Buffer.from(await response.arrayBuffer()));assert.equal(actual,expected,file);report.files.push({file,sha256:actual});}save();
 for(const [kind,size] of [['sample',64],['sample2',48]])await withPage(base+'index.html#size='+size,async p=>{
  for(let i=0;i<600;i++){if(await p.eval('!!window.__app&&!__app.preparation&&!!__app.preparationStats'))break;await wait(100);}
  const before=await p.eval(`(()=>{const A=__app;window.oldMap=JSON.stringify(A.serialize());window.oldH=A.H;window.oldProps=A.props;return{source:A.preparationStats.preparedSource,walk:A.preparationStats.walkReused,fit:A.preparationStats.fitStats,props:A.props.length,regen:cliffRegenerations};})()`);
  assert.equal(before.source,'bundle');assert(before.walk);assert.equal(before.fit,null);assert.equal(before.regen,0);
  await p.eval("document.querySelector('#view').focus();true");for(let i=0;i<4;i++){await p.cdp('Input.dispatchKeyEvent',{type:'keyDown',code:'Tab',key:'Tab',windowsVirtualKeyCode:9});await p.cdp('Input.dispatchKeyEvent',{type:'keyUp',code:'Tab',key:'Tab',windowsVirtualKeyCode:9});await wait(150);}
  const after=await p.eval(`({sameMap:oldMap===JSON.stringify(__app.serialize()),sameH:oldH===__app.H,sameProps:oldProps===__app.props,regen:cliffRegenerations,gl:__app.renderer.getContext().getError()})`);assert(after.sameMap&&after.sameH&&after.sameProps);assert.equal(after.regen,0);assert.equal(after.gl,0);
  const torch=await p.eval(`(()=>{const A=__app,t=A.PROP.findIndex(t=>t.id==='wall_torch');A.props.push([t,0,0,0,1,0,1,null,'published-check']);A.rebuildProps();for(let i=0;i<180;i++)A.update(1/60);A.render();const saved=A.serialize();return{metrics:{...A.wallTorches.metrics},saved:!!saved.props.find(p=>p[8]==='published-check'),gl:A.renderer.getContext().getError()};})()`);assert.equal(torch.metrics.count,1);assert(torch.saved);assert.equal(torch.gl,0);assert.deepEqual(p.errors,[]);report.samples.push({kind,size,before,after,torch,pass:true});save();
 },{hardware:true,w:1280,h:720,exactViewport:true,wait:500,initScript:init+(kind==='sample2'?"sessionStorage.setItem('me_pending','sample2');":'')});
 report.pass=true;save();console.log(JSON.stringify(report));
})().catch(e=>{report.error=e.stack;save();console.error(e);process.exitCode=1;});

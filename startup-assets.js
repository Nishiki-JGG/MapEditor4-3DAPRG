// Background data downloads and one-at-a-time prop preparation. No editor-wide lock.
window.TDStartupAssets=(()=>{
 'use strict';
 let types=[],finish,changed,running=null,complete=false,done=0,total=1,failed=[],completed;
 const loaded=new Set(),pause=()=>new Promise(r=>setTimeout(r,16));
 function panel(text){const p=document.getElementById('assetProgress');if(!p)return;p.hidden=false;p.querySelector('span').textContent=text;p.querySelector('progress').max=total;p.querySelector('progress').value=done;p.querySelector('button').hidden=!failed.length;}
 function load(node){const src=node.getAttribute('src');if(loaded.has(src))return Promise.resolve();return new Promise((resolve,reject)=>{
  const s=document.createElement('script');s.dataset.presentationOnly='';s.async=true;s.src=src;
  const timer=setTimeout(()=>end(Error('素材の通信がタイムアウトしました: '+src)),30000);
  function end(error){clearTimeout(timer);s.onload=s.onerror=null;s.remove();if(error)reject(error);else{loaded.add(src);done++;panel('素材を読み込み中 '+done+' / '+total);resolve();}}
  s.onload=()=>end();s.onerror=()=>end(Error('素材を読み込めません: '+src));document.head.appendChild(s);
 });}
 async function dataFiles(){
  const nodes=[...document.querySelectorAll('script[type="application/x-map-asset"]')];
  const shared=nodes.filter(n=>/props\/shared\/(assets|rock-surface|cave-save-compat)\.js/.test(n.src));
  const independent=nodes.filter(n=>!shared.includes(n));
  // Shared generated definitions already appended during core initialization must survive the payload assignment.
  const sharedTask=(async()=>{const shell=window.TDSharedData;
   for(const n of shared){await load(n);if(window.TDSharedData!==shell){const full=window.TDSharedData;for(const key of ['assets','textures']){const merged=new Map(shell[key].map(x=>[x.id,x]));for(const x of full[key])merged.set(x.id,x);shell[key]=[...merged.values()];}shell.libraryVersion=full.libraryVersion;window.TDSharedData=shell;}}
  })();
  let cursor=0;const workers=Array.from({length:3},async()=>{while(cursor<independent.length){const n=independent[cursor++];await load(n);if(n.src.includes('/cave-decor-data.js')){const d=window.TDSharedData,p=window.TDCaveDecorData;for(const key of ['assets','textures'])for(const x of p[key]){const i=d[key].findIndex(a=>a.id===x.id);if(i<0)d[key].push(x);else d[key][i]=x;}}await pause();}});
  const result=await Promise.allSettled([sharedTask,...workers]);const errors=result.filter(x=>x.status==='rejected');if(errors.length)throw errors[0].reason;
 }
 async function start(){
  if(complete)return;if(running)return running;
  running=(async()=>{
   await pause();failed=[];total=document.querySelectorAll('script[type="application/x-map-asset"]').length+types.length;done=loaded.size+types.filter(t=>t.ready).length;
   panel('素材を読み込み中 '+done+' / '+total);
   await dataFiles();
   for(const t of types){if(t.ready)continue;await pause();panel('素材を準備中 '+done+' / '+total+'：'+t.name);finish(t);done++;changed();}
   complete=true;completed?.();panel('素材の読み込み完了');setTimeout(()=>{if(complete)document.getElementById('assetProgress').hidden=true;},2000);
  })().catch(e=>{failed=[e.message];panel(e.message+'。地形の編集は続けられます。');throw e;}).finally(()=>running=null);
  return running;
 }
 return{configure(p,f,c,onComplete){types=p;finish=f;changed=c;completed=onComplete;const b=document.querySelector('#assetProgress button');if(b)b.onclick=()=>start().catch(()=>{});},start,ensureAll:start,get complete(){return complete;},get status(){return{done,total,complete,failed:[...failed],ready:types.filter(t=>t.ready).length};}};
})();

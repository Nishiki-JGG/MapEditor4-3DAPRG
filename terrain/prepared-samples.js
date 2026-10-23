// 固定の完成品だけを配布資産から読む。新しいランダムや編集条件の生成とは分離する。
(()=>{'use strict';
const recipeVersion='fixed-samples/1',requests=new Map();let manifestPromise;
const canonical=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.keys(x).sort().map(k=>[k,x[k]])):x);
const sha=async b=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',b)),v=>v.toString(16).padStart(2,'0')).join('');
function script(url){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.async=true;s.dataset.preparedSample='1';s.src=url;s.onload=()=>{s.remove();resolve();};s.onerror=()=>{s.remove();reject(Error('処理済みサンプルを読み込めません: '+url));};document.head.append(s);});}
async function manifest(key){return manifestPromise||=(async()=>{await script('prepared/manifest.js?v='+recipeVersion+'&key='+encodeURIComponent(key));const m=window.TDPreparedManifest;if(m?.version!==1||m.recipeVersion!==recipeVersion||!Array.isArray(m.entries))throw Error('処理済みサンプルの生成版が一致しません');return m;})();}
function register(id,text){const r=requests.get(id);if(!r)return;r.text=text;}
async function inflate(bytes,limit,job){
 if(typeof DecompressionStream!=='function')throw Error('このブラウザは完成サンプルの圧縮展開に対応していません');
 const reader=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader(),chunks=[];let length=0,done=false;
 try{for(;;){TDPreparation.check(job);const r=await reader.read();TDPreparation.check(job);if(r.done){done=true;break;}length+=r.value.length;if(length>limit)throw Error('完成サンプルの展開サイズが不正です');chunks.push(r.value);}}finally{if(!done)await reader.cancel().catch(()=>{});}
 if(length!==limit)throw Error('完成サンプルが途中で切れています');const raw=new Uint8Array(length);let n=0;for(const c of chunks){raw.set(c,n);n+=c.length;}return raw;
}
async function load(q,job){
 const fixed=q.kind==='sample'&&q.seed===7&&q.size===64||q.kind==='sample2'&&q.seed===11&&q.size===48;if(!fixed)return null;
 job?.progress('処理済みサンプルの版を確認',0,0);const m=await manifest(q.key);TDPreparation.check(job);
 const e=m.entries.find(e=>e.kind===q.kind&&e.seed===q.seed&&e.size===q.size);if(!e)throw Error('この固定サンプルの完成品がありません');
 // 体格・biome・カタログなどを編集した派生条件だけは通常の生成へ戻す。
 if(canonical(e.profile)!==canonical(q.profile))return null;
 if(e.key!==q.key||!/^sample:[a-f0-9]{64}$/.test(e.key)||!/^[a-z0-9-]+\.js$/.test(e.file)||!Number.isInteger(e.rawBytes)||e.rawBytes<16||e.rawBytes>100*1024*1024||!Number.isInteger(e.gzipBytes)||e.gzipBytes<1||e.gzipBytes>16*1024*1024)throw Error('完成サンプルと現在の生成条件が一致しません');
 job?.progress('処理済みの岩と衝突情報を読込',0,0);let request=requests.get(e.file);
 if(!request){request={};requests.set(e.file,request);request.promise=script('prepared/'+e.file).then(()=>{if(typeof request.text!=='string')throw Error('完成サンプルのデータがありません');return request.text;}).finally(()=>requests.delete(e.file));}
 const text=await request.promise;TDPreparation.check(job);if(text.length>Math.ceil(e.gzipBytes/3)*4+4)throw Error('完成サンプルの圧縮長が不正です');
 const packed=Uint8Array.from(atob(text),c=>c.charCodeAt(0));if(packed.length!==e.gzipBytes||await sha(packed)!==e.sha256)throw Error('完成サンプルの検査値が一致しません');TDPreparation.check(job);
 const start=performance.now(),raw=await inflate(packed,e.rawBytes,job);TDPreparation.check(job);await TDPreparation.pause(job);const value=TDPreparedCodec.decode(raw);TDPreparation.check(job);
 if(value.version!==1||value.kind!==q.kind||value.seed!==q.seed||value.size!==q.size||value.key!==q.key||canonical(value.profile)!==canonical(q.profile)||!value.collision?.walk)throw Error('完成サンプルの内容が一致しません');
 return{value,bytes:e.gzipBytes,decodeMs:performance.now()-start};
}
window.TDPreparedSamples={recipeVersion,load,register};
})();

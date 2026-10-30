(function(root){
 'use strict';
 const enc=new TextEncoder(), dec=new TextDecoder();
 const bytes=x=>typeof x==='string'?enc.encode(x):x;
 // Preserve the exact source bytes; separate complete model/texture records, not fixed-size chunks.
 function recipe(name,source,sha){
  const s=typeof source==='string'?source:dec.decode(source);JSON.parse(s);
  function end(i){
   if(s[i]==='"'){for(let j=i+1;j<s.length;j++){if(s[j]==='\\'){j++;continue;}if(s[j]==='"')return j+1;}throw Error('JSON文字列');}
   if(s[i]==='{'||s[i]==='['){let depth=0;for(let j=i;j<s.length;j++){if(s[j]==='"'){j=end(j)-1;continue;}if(s[j]==='{'||s[j]==='[')depth++;if(s[j]==='}'||s[j]===']')if(--depth===0)return j+1;}throw Error('JSON構造');}
   let j=i;while(j<s.length&&!/[\s,}\]]/.test(s[j]))j++;return j;
  }
  const skip=i=>{while(/\s/.test(s[i]||'')&&i<s.length)i++;return i;},spans=[];
  let i=skip(0)+1;
  while((i=skip(i))<s.length&&s[i]!=='}'){
   const k=end(i),key=JSON.parse(s.slice(i,k));i=skip(k);if(s[i++]!==':')throw Error('JSON key');i=skip(i);const e=end(i);
   if((key==='assets'||key==='textures')&&s[i]==='['){let j=skip(i+1),index=0;while(j<e-1){const q=end(j),v=JSON.parse(s.slice(j,q));spans.push([j,q,name+'/'+key+'/'+(v.id||index++)]);j=skip(q);if(s[j]===',')j=skip(j+1);}}
   else if(e-i>1024||s[i]==='{')spans.push([i,e,name+'/'+key]);
   i=skip(e);if(s[i]===',')i++;
  }
  const objects=new Map(),parts=[];let pos=0;
  for(const [a,b,id]of spans){if(a>pos)parts.push({text:s.slice(pos,a)});const data=enc.encode(s.slice(a,b)),hash=sha(data);objects.set(hash,data);parts.push({sha256:hash,bytes:data.length,id});pos=b;}
  if(pos<s.length)parts.push({text:s.slice(pos)});
  return{recipe:{format:'tdj-source-recipe',schemaVersion:1,name,sha256:sha(enc.encode(s)),bytes:enc.encode(s).length,parts},objects};
 }
 async function directory(parent,path){let d=parent;for(const part of path.split('/'))d=await d.getDirectoryHandle(part,{create:true});return d;}
 async function put(dir,name,data,sha){
  const b=bytes(data);let handle;
  try{handle=await dir.getFileHandle(name);const old=new Uint8Array(await(await handle.getFile()).arrayBuffer());if(sha(old)!==sha(b))throw Error('保存済みデータと不一致: '+name);return false;}
  catch(e){if(e.name!=='NotFoundError')throw e;}
  handle=await dir.getFileHandle(name,{create:true});const w=await handle.createWritable();try{await w.write(b);await w.close();}catch(e){try{await w.abort();}catch{}try{await dir.removeEntry(name);}catch{}throw e;}return true;
 }
 async function save(root,result,name,makeZip,sha){
  const refFile=result.files.find(f=>f.name==='shared_assets.json');if(!refFile)throw Error('共通素材参照がありません');
  const ref=JSON.parse(refFile.data),common=await directory(root,'_shared'),objects=await directory(common,'objects');
  const set=await directory(common,ref.bundleHash);let added=0,reused=0;
  for(const f of result.sharedFiles){if(f.name==='shared_assets.json')continue;const r=recipe(f.name,f.data,sha);
   for(const [hash,data]of r.objects){if(await put(objects,hash+'.json',data,sha))added++;else reused++;}
   await put(set,f.name+'.recipe.json',JSON.stringify(r.recipe),sha);
  }
  await put(set,'shared_assets.json',refFile.data,sha);
  const safe=String(name||'map').replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').replace(/[. ]+$/,'').slice(0,60)||'map';
  const folder='room-'+safe+'-'+result.manifest.contentHash.slice(0,16),room=await directory(root,folder);
  const map=result.authoring||result.files.find(f=>f.name==='map.json');
  if(!map)throw Error('編集原稿がありません');
  if(result.authoring){const ref=JSON.parse(result.files.find(f=>f.name==='source_ref.json').data);if(sha(map.data)!==ref.sha256||map.data.length!==ref.bytes)throw Error('編集原稿の照合に失敗しました');}
  await put(room,map.name,map.data,sha);
  // exportedAt is intentionally excluded from contentHash: retain an already verified same-content ZIP.
  const zipName='map_export_unity.zip';let receipt=null;
  for(const file of ['saved.txt','saving.txt']){
   try{receipt=JSON.parse(await(await(await room.getFileHandle(file)).getFile()).text());break;}catch(e){if(e.name!=='NotFoundError')throw e;}
  }
  if(receipt){
   if(receipt.contentHash!==result.manifest.contentHash)throw Error('部屋の保存先が競合しています');
   let old;try{old=new Uint8Array(await(await(await room.getFileHandle(zipName)).getFile()).arrayBuffer());}catch(e){if(e.name!=='NotFoundError')throw e;}
   if(old){if(sha(old)!==receipt.zipSha256)throw Error('保存済みZIPが変更されています');}
   else{const zip=new Uint8Array(await(await makeZip(result.files)).arrayBuffer());
    // Missing ZIP after interrupted staging: update only the uncommitted receipt, never a finished room.
    try{await room.getFileHandle('saved.txt');throw Error('完了済みの部屋ZIPがありません');}catch(e){if(e.name!=='NotFoundError')throw e;}
    await room.removeEntry('saving.txt');receipt={format:'tdj-room-folder',contentHash:result.manifest.contentHash,zipSha256:sha(zip),sharedHash:ref.bundleHash};
    await put(room,'saving.txt',JSON.stringify(receipt),sha);await put(room,zipName,zip,sha);
   }
  }else{const zip=new Uint8Array(await(await makeZip(result.files)).arrayBuffer());
   receipt={format:'tdj-room-folder',contentHash:result.manifest.contentHash,zipSha256:sha(zip),sharedHash:ref.bundleHash};
   await put(room,'saving.txt',JSON.stringify(receipt),sha);await put(room,zipName,zip,sha);
  }
  await put(room,'saved.txt',JSON.stringify(receipt),sha);
  try{await room.removeEntry('saving.txt');}catch(e){if(e.name!=='NotFoundError')throw e;}
  return{folder,added,reused,sharedHash:ref.bundleHash};
 }
 const api={recipe,save};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TDAssetRegistry=api;
})(typeof globalThis==='undefined'?this:globalThis);

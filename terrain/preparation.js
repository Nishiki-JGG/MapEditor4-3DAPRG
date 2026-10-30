// マップ準備専用。既存の保存領域やユーザーファイルには触れない。
(() => {
'use strict';
const memory = new Map();
const abort = () => new DOMException('準備を中止しました', 'AbortError');
function check(job) { if (job && !job.valid()) throw abort(); }
const yields=[];
const yieldChannel=typeof MessageChannel==='function'?new MessageChannel():null;
if(yieldChannel)yieldChannel.port1.onmessage=()=>yields.shift()?.();
async function pause(job) {
  check(job);
  // Yield to UI/cancellation between 6ms work slices without a 4ms timer tax per slice.
  await new Promise(r=>{if(yieldChannel){yields.push(r);yieldChannel.port2.postMessage(0);}else setTimeout(r,0);});
  check(job);
}
async function each(items, fn, job) {
  let since = performance.now(), i = 0;
  for (const item of items) {
    check(job); await fn(item, i++);
    if (performance.now() - since >= 6) { await pause(job); since = performance.now(); }
  }
}
async function run(iterator, job) {
  let since = performance.now();
  try { for (;;) { check(job); const r = iterator.next(); if (r.done) return r.value;
    if (r.value?.phase) job?.progress(r.value.phase, r.value.current, r.value.total);
    if (performance.now() - since >= 6) { await pause(job); since = performance.now(); }
  } } catch (e) { iterator.return?.(); throw e; }
}
let database;
function db() {
  if (!globalThis.indexedDB) return Promise.resolve(null);
  return database ||= new Promise(resolve => {
    let q;try { q = indexedDB.open('MapEditorPreparedSamples', 1); } catch { resolve(null); return; }
    q.onupgradeneeded = () => q.result.createObjectStore('entries');
    q.onsuccess = () => resolve(q.result); q.onerror = q.onblocked = () => resolve(null);
  });
}
function remember(key,value) { memory.delete(key);memory.set(key,value);while(memory.size>1)memory.delete(memory.keys().next().value); }
async function get(key) {
  if(memory.has(key))return memory.get(key);
  try { const d=await db();if(!d)return null;
    return await new Promise(resolve=>{const q=d.transaction('entries').objectStore('entries').get(key);
      q.onsuccess=()=>{const value=q.result||null;if(value)remember(key,value);resolve(value);};q.onerror=()=>resolve(null);});
  }catch{return null;}
}
async function put(key,value,persistent) {
  remember(key,value);if(!persistent)return false;
  try {const d=await db();if(!d)return false;
    return await new Promise(resolve=>{const t=d.transaction('entries','readwrite'),s=t.objectStore('entries');
      const cursor=s.openCursor();cursor.onsuccess=()=>{const c=cursor.result;if(c){if(String(c.key).startsWith('sample:')&&c.key!==key)c.delete();c.continue();}};s.put(value,key);t.oncomplete=()=>resolve(true);t.onerror=t.onabort=()=>resolve(false);});
  }catch{return false;}
}
async function remove(key) {
  memory.delete(key);try {const d=await db();if(d)await new Promise(resolve=>{const t=d.transaction('entries','readwrite');t.objectStore('entries').delete(key);t.oncomplete=t.onerror=t.onabort=resolve;});}catch{}
}
// サイズ変更でページを作り直す間だけ使う。大きい保存JSONを sessionStorage に入れない。
async function stash(token,data) {
 try {const d=await db();if(!d)return false;return await new Promise(resolve=>{const t=d.transaction('entries','readwrite'),s=t.objectStore('entries');
  const cursor=s.openCursor();cursor.onsuccess=()=>{const c=cursor.result;if(c){if(String(c.key).startsWith('handoff:')&&c.value.createdAt<Date.now()-86400000)c.delete();c.continue();}};
  s.put({token,data,createdAt:Date.now()},'handoff:'+token);t.oncomplete=()=>resolve(true);t.onerror=t.onabort=()=>resolve(false);});}catch{return false;}
}
async function pending(token) {
 if(!/^[a-f0-9-]{36}$/i.test(token))return null;
 try {const d=await db();if(!d)return null;return await new Promise(resolve=>{const q=d.transaction('entries').objectStore('entries').get('handoff:'+token);q.onsuccess=()=>resolve(q.result?.token===token?q.result.data:null);q.onerror=()=>resolve(null);});}catch{return null;}
}
async function clearPending(token){await remove('handoff:'+token);}
window.TDPreparation = { check, pause, each, run, get, put, remove, stash, pending, clearPending, version: 'prepared-samples/1' };
})();

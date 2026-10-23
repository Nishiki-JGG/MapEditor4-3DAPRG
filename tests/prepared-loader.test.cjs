// 配布物の形式/整合性/中止。ファイルやネットワークへの書込みは行わない。
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),zlib=require('zlib'),crypto=require('crypto'),codec=require('../terrain/prepared-codec');
const source=fs.readFileSync(require.resolve('../terrain/prepared-samples.js'),'utf8'),key='sample:'+'a'.repeat(64),q={kind:'sample',size:64,seed:7,key,profile:{biome:'forest',agent:{height:1.8}}};
const value={version:1,...q,collision:{walk:{}}},hex=b=>crypto.createHash('sha256').update(b).digest('hex');
function environment(change={}){
 const raw=change.raw||codec.encode(change.value||value),packed=zlib.gzipSync(raw),entry={...q,file:'sample-64-7-test.js',rawBytes:raw.length,gzipBytes:packed.length,sha256:hex(packed),...change.entry},manifest={version:1,recipeVersion:'fixed-samples/1',entries:[entry],...change.manifest};let requested=[];
 const context={console,Uint8Array,Blob,Response,TextDecoder,DecompressionStream:change.noDecompression?undefined:DecompressionStream,crypto:crypto.webcrypto,performance,atob,TDPreparedCodec:codec,TDPreparation:{check:j=>{if(j&&!j.valid())throw Object.assign(Error('中止'),{name:'AbortError'});},pause:async()=>{}},document:{createElement:()=>({dataset:{},remove(){}}),head:{append(s){requested.push(s.src);queueMicrotask(()=>{if(s.src.startsWith('prepared/manifest.js'))context.TDPreparedManifest=manifest;else context.TDPreparedSamples.register(entry.file,change.text??packed.toString('base64'));s.onload();});}}}};context.window=context;vm.runInNewContext(source,context);return{api:context.TDPreparedSamples,requested};
}
(async()=>{
 let e=environment();const r=await e.api.load(q);assert.equal(r.value.key,key);assert.equal(e.requested.length,2);
 e=environment();assert.equal(await e.api.load({...q,seed:8}),null);assert.equal(e.requested.length,0);
 e=environment();assert.equal(await e.api.load({...q,profile:{biome:'desert'}}),null);assert.equal(e.requested.length,1);
 for(const change of [{entry:{key:'sample:'+'b'.repeat(64)}},{entry:{file:'../app.js'}},{entry:{sha256:'0'.repeat(64)}},{entry:{rawBytes:12}},{manifest:{recipeVersion:'obsolete'}},{noDecompression:true},{text:'AA=='},{raw:Uint8Array.from([1,2,3,4])},{value:{...value,seed:8}},{value:{...value,collision:{}}}]){
  e=environment(change);await assert.rejects(()=>e.api.load(q));
 }
 e=environment();await assert.rejects(()=>e.api.load(q,{valid:()=>false,progress(){}}),{name:'AbortError'});
 console.log(JSON.stringify({pass:true,validBundle:true,nonfixedNotDownloaded:true,editedProfileNotDownloaded:true,invalidBundlesRejected:10,cancellation:true}));
})().catch(e=>{console.error(e);process.exitCode=1;});

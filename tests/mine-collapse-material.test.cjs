const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),zlib=require('zlib'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..'),out=process.env.MINE_COLLAPSE_OUTPUT||path.join(require('os').tmpdir(),'mine-collapse-material');fs.mkdirSync(out,{recursive:true});const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const source=fs.readFileSync(root+'/props/mine-collapse.js','utf8'),data=fs.readFileSync(root+'/props/mine-collapse-pbr.js','utf8');
function context(mode='valid'){const c={console,Blob,DecompressionStream,atob:s=>Buffer.from(s,'base64').toString('binary'),window:null,TDProps:{add(t){c.def=t}}};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(root+'/three.min.js','utf8'),c);if(mode!=='missing')vm.runInContext(data,c);
 if(mode==='badHeader')c.TDMineCollapsePBR.version=999;if(mode==='badData')c.TDMineCollapsePBR.gzip='AAAA';if(mode==='noDecoder')delete c.DecompressionStream;
 if(mode==='overrun')c.TDMineCollapsePBR.gzip=zlib.gzipSync(Buffer.alloc(1572865)).toString('base64');
 vm.runInContext(source,c);return c;}
(async()=>{const reference=JSON.parse(fs.readFileSync(root+'/tests/mine-collapse-geometry-reference.json','utf8')),rows=[];let accepted;
 for(const mode of ['valid','missing','badHeader','badData','noDecoder','overrun']){const c=context(mode),t=c.TDMineCollapse.maps(),m=c.TDMineCollapse.material(),preview=m.clone(),fallback=Buffer.from(t.colour);const pending=t.status;await c.TDMineCollapse.prepare();
 assert.equal(t.status,mode==='valid'?'ready':'fallback');assert(preview.map===m.map&&preview.normalMap===m.normalMap,'preview buffer references');assert.equal(new Set([m.map,m.roughnessMap,m.aoMap,m.normalMap]).size,3);
 if(mode==='valid'){assert.equal(pending,'loading');assert(!Buffer.from(t.colour).equals(fallback));const raw=zlib.gunzipSync(Buffer.from(c.TDMineCollapsePBR.gzip,'base64'));for(const [i,k]of ['colour','normal','packed'].entries())assert(Buffer.from(t[k]).equals(raw.subarray(i*524288,(i+1)*524288)));accepted=c;}else{assert(Buffer.from(t.colour).equals(fallback),'no partially installed data');}
 rows.push({mode,pending,status:t.status,error:t.error,sharedTextures:3});}
 const after=accepted.def.build();for(const [k,h]of Object.entries(reference.attributes))assert.equal(sha(Buffer.from(after.attributes[k].array.buffer)),h,k);assert.equal(sha(Buffer.from(after.index.array.buffer)),reference.index);assert.equal(sha(JSON.stringify(after.userData)),reference.metadata);assert.notEqual(sha(Buffer.from(after.attributes.uv.array.buffer)),reference.uv);
 const report={pass:true,rows,geometryUnchanged:true,uvChanged:true,offlineInlinePayload:true,networkRequests:0};fs.writeFileSync(out+'/loader.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1});

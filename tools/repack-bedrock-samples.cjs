// 既存の完成済み形状を再生成せず、新しい空の塗装チャンネルと署名だけを梱包する。
const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto'),zlib=require('zlib'),cp=require('child_process'),assert=require('assert/strict'),{withPage}=require('../tests/cdp'),codec=require('../terrain/prepared-codec');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'prepared'),sourceRef=process.argv[2]||'e112282';
const hash=x=>crypto.createHash('sha256').update(x).digest('hex'),source=n=>cp.execFileSync('git',['show',sourceRef+':'+n],{cwd:root,maxBuffer:30e6});
const parse=b=>JSON.parse(b.toString().slice('window.TDPreparedManifest='.length).trim().replace(/;$/,''));
const original=parse(source('prepared/manifest.js'));
function sourceHashes(){const names=['app.js','index.html','props/grounding.js','props/shells.js','props/shared/rock-surface.js',...fs.readdirSync(path.join(root,'terrain')).filter(x=>x.endsWith('.js')).map(x=>'terrain/'+x),...fs.readdirSync(path.join(root,'props')).filter(x=>x.startsWith('cliff')&&x.endsWith('.js')).map(x=>'props/'+x)];return Object.fromEntries(names.sort().map(n=>[n,hash(fs.readFileSync(path.join(root,n),'utf8').replace(/\r\n?/g,'\n'))]));}
const inputSources=sourceHashes(),pendingFiles=new Map();
const server=http.createServer((q,r)=>{const rel=new URL(q.url,'http://x').pathname,p=path.resolve(root,'.'+rel);if(!p.startsWith(root+path.sep))return r.writeHead(403).end();fs.readFile(p,(e,b)=>{if(!e&&rel==='/app.js')b=Buffer.from(b.toString().replace('window.__app = {',`window.__bedrockBundleDescriptor=async(kind,seed)=>({key:await preparationKey(kind,seed),profile:preparedProfile(kind)});window.__app = {`));if(!e&&rel==='/terrain/cliff-layering.js')b=Buffer.from(b.toString()+`;TDCliffLayering.fitAsync=()=>{throw Error('梱包中の岩再生成は禁止');};`);r.writeHead(e?404:200,{'Content-Type':rel.endsWith('.js')?'text/javascript':rel.endsWith('.html')?'text/html':'application/octet-stream'}).end(e?'404':b);});});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const entries=[],evidence=[];try{for(const e of original.entries){
 assert(/^[a-z0-9-]+\.js$/.test(e.file));
 const descriptor=await withPage('http://127.0.0.1:'+server.address().port+'/index.html#size='+e.size,async p=>{for(let k=0;k<600;k++){if(await p.eval('!!window.__app'))break;await new Promise(r=>setTimeout(r,100));}await p.eval('(async()=>{await __app.bootReady;})()');const d=await p.eval(`__bedrockBundleDescriptor('${e.kind}',${e.seed})`);assert.deepEqual(p.errors,[]);return d;},{hardware:true,exactViewport:true,w:800,h:600,wait:1000,initScript:"sessionStorage.setItem('me_pending','flat');"});
 const script=source('prepared/'+e.file).toString(),text=JSON.parse(script.slice(script.indexOf(',')+1).trim().replace(/\);$/,'')),packed=Buffer.from(text,'base64');assert.equal(hash(packed),e.sha256);
 const old=codec.decode(zlib.gunzipSync(packed)),count=(e.size*2+1)**2,sourceChannels=old.snapshot.S.length/count;assert([9,10].includes(sourceChannels));const nextS=new Uint8Array(count*10);for(let k=0;k<count;k++)nextS.set(old.snapshot.S.subarray(k*sourceChannels,(k+1)*sourceChannels),k*10);
 if(sourceChannels===10)assert.deepEqual(nextS,old.snapshot.S,'existing paint unchanged');
 const before=hash(old.snapshot.S),after=hash(nextS),signature=old.collision.walk.signature;assert(signature.includes('/'+before+'/'));
 const next={...old,key:descriptor.key,profile:descriptor.profile,snapshot:{...old.snapshot,S:nextS},collision:{...old.collision,walk:{...old.collision.walk,signature:signature.replace('/'+before+'/','/'+after+'/')}}};
 // 唯一の差は空の末尾チャンネル、プロファイル、照合用キーと塗装署名。
 const raw=codec.encode(next),gzip=zlib.gzipSync(raw,{level:9,mtime:0}),decoded=codec.decode(zlib.gunzipSync(gzip));assert.deepEqual(decoded,next);
 assert.deepEqual({...decoded,key:old.key,profile:old.profile,snapshot:{...decoded.snapshot,S:old.snapshot.S},collision:{...decoded.collision,walk:{...decoded.collision.walk,signature}}},old);
 const sha256=hash(gzip),file=e.kind+'-'+e.size+'-'+e.seed+'-'+sha256.slice(0,12)+'.js',body='TDPreparedSamples.register('+JSON.stringify(file)+','+JSON.stringify(gzip.toString('base64'))+');\n';pendingFiles.set(file,body);
 entries.push({...e,key:descriptor.key,profile:descriptor.profile,file,sha256,rawBytes:raw.length,gzipBytes:gzip.length,scriptBytes:Buffer.byteLength(body),httpGzipBytes:zlib.gzipSync(body,{level:9}).length});
 evidence.push({kind:e.kind,sourceRef,sourceFile:e.file,sourceSha256:e.sha256,targetFile:file,targetSha256:sha256,sourceKey:e.key,targetKey:descriptor.key,sourceChannels,targetChannels:10,geometryAndCollisionUnchanged:true,addedChannelAllZero:nextS.every((v,i)=>i%10!==9||v===0),rockRegenerationCalls:0,props:e.props,fits:e.fits});console.log(JSON.stringify(evidence.at(-1)));
 }
 assert.deepEqual(sourceHashes(),inputSources,'Sources changed during repacking; keep source edits sequential');
 for(const[file,body]of pendingFiles)fs.writeFileSync(path.join(dir,file),body);
 fs.writeFileSync(path.join(dir,'manifest.js'),'window.TDPreparedManifest='+JSON.stringify({...original,sources:inputSources,entries})+';\n');
 // 参照されなくなった完成品の重複だけを除く。形状は新しい梱包内で同一。
 for(const e of original.entries)if(!entries.some(n=>n.file===e.file)&&fs.existsSync(path.join(dir,e.file)))fs.unlinkSync(path.join(dir,e.file));
 fs.mkdirSync(path.join(root,'docs/bedrock'),{recursive:true});fs.writeFileSync(path.join(root,'docs/bedrock/prepared-repack.json'),JSON.stringify(evidence,null,2));
}finally{server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

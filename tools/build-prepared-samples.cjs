// 固定2サンプルの完成品を開発側で生成する。ユーザーのマップやタブには触れない。
const fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto'),zlib=require('zlib'),assert=require('assert/strict'),{withPage}=require('../tests/cdp');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'prepared'),recipeVersion='fixed-samples/1';
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
function sourceHashes(){const names=['app.js','index.html','props/grounding.js','props/shells.js','props/shared/rock-surface.js',...fs.readdirSync(path.join(root,'terrain')).filter(x=>x.endsWith('.js')).map(x=>'terrain/'+x),...fs.readdirSync(path.join(root,'props')).filter(x=>x.startsWith('cliff')&&x.endsWith('.js')).map(x=>'props/'+x)];return Object.fromEntries(names.sort().map(n=>[n,digest(fs.readFileSync(path.join(root,n),'utf8').replace(/\r\n?/g,'\n'))]));}
function readManifest(){const s=fs.readFileSync(path.join(dir,'manifest.js'),'utf8');return JSON.parse(s.slice('window.TDPreparedManifest='.length).trim().replace(/;$/,''));}
if(process.argv.includes('--check')){
 const m=readManifest();assert.equal(m.recipeVersion,recipeVersion);assert.deepEqual(m.sources,sourceHashes(),'生成元が変わっています。固定サンプルを再生成してください');
 for(const e of m.entries){const script=fs.readFileSync(path.join(dir,e.file),'utf8'),text=JSON.parse(script.slice(script.indexOf(',')+1).trim().replace(/\);$/,'')),packed=Buffer.from(text,'base64');assert.equal(digest(packed),e.sha256);assert.equal(packed.length,e.gzipBytes);const raw=zlib.gunzipSync(packed);assert.equal(raw.length,e.rawBytes);const d=require('../terrain/prepared-codec').decode(raw);for(const k of ['key','kind','size','seed'])assert.equal(d[k],e[k]);assert.deepEqual(d.profile,e.profile);assert(d.collision.walk);}
 console.log(JSON.stringify({pass:true,bundles:m.entries.length,sourcesCurrent:true}));process.exit(0);
}
const server=http.createServer((q,r)=>{const rel=new URL(q.url,'http://x').pathname,file=path.resolve(root,'.'+rel);if(!file.startsWith(root+path.sep)){r.writeHead(403).end();return;}const f=rel==='/'?path.join(root,'index.html'):file;fs.readFile(f,(e,b)=>{r.writeHead(e?404:200,{'Content-Type':f.endsWith('.js')?'text/javascript':f.endsWith('.html')?'text/html':'application/octet-stream'});r.end(e?'404':b);});});
(async()=>{fs.mkdirSync(dir,{recursive:true});await new Promise(r=>server.listen(0,'127.0.0.1',r));const entries=[];
 try{for(const [kind,size,seed]of [['sample',64,7],['sample2',48,11]]){
  const data=await withPage('http://127.0.0.1:'+server.address().port+'/index.html#size='+size,async p=>{for(let i=0;i<100;i++){if(await p.eval('!!window.__app&&!__app.preparation&&!!__app.preparationStats'))break;await new Promise(r=>setTimeout(r,300));}const d=await p.eval(`__app.buildPreparedSample(${JSON.stringify(kind)},${seed})`);assert.deepEqual(p.errors,[]);return d;},{hardware:true,wait:1000,w:800,h:600,initScript:"sessionStorage.setItem('me_pending','flat');"});
  const raw=zlib.gunzipSync(Buffer.from(data.gzipBase64,'base64')),packed=zlib.gzipSync(raw,{level:9,mtime:0}),sha256=digest(packed),file=kind+'-'+size+'-'+seed+'-'+sha256.slice(0,12)+'.js',text='TDPreparedSamples.register('+JSON.stringify(file)+','+JSON.stringify(packed.toString('base64'))+');\n';fs.writeFileSync(path.join(dir,file),text);
  const {gzipBase64,...metadata}=data;entries.push({...metadata,file,sha256,gzipBytes:packed.length,scriptBytes:Buffer.byteLength(text),httpGzipBytes:zlib.gzipSync(text,{level:9}).length});console.log(JSON.stringify({...entries.at(-1),profile:undefined}));
 }
 fs.writeFileSync(path.join(dir,'manifest.js'),'window.TDPreparedManifest='+JSON.stringify({version:1,recipeVersion,sources:sourceHashes(),entries})+';\n');
 }finally{server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});

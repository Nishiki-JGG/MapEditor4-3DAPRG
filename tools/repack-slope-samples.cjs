// 今回のr=0接地修正用。完成済み上流データを維持し、検証済みの新しい識別キーだけ渡す。
// 先に build-prepared-samples.cjs で現在のkey/profileを確認する。通常の生成器にはしない。
const fs=require('fs'),path=require('path'),cp=require('child_process'),zlib=require('zlib'),crypto=require('crypto'),assert=require('assert/strict'),{isDeepStrictEqual}=require('util'),codec=require('../terrain/prepared-codec');
const root=path.resolve(__dirname,'..'),base='973fa00',dir=path.join(root,'prepared'),read=n=>cp.execFileSync('git',['show',base+':'+n],{cwd:root,maxBuffer:30e6}),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),manifest=s=>JSON.parse(s.toString().slice('window.TDPreparedManifest='.length).trim().replace(/;$/,''));
const norm=b=>b.toString().replace(/\r\n?/g,'\n');
// 接地対象以外の元メッシュ・衝突・生成部品が変わった場合は再利用しない。
for(const n of cp.execFileSync('git',['ls-tree','-r','--name-only',base,'props','terrain'],{cwd:root,encoding:'utf8'}).trim().split('\n'))if(n.endsWith('.js')&&n!=='props/shells.js')assert.equal(norm(fs.readFileSync(path.join(root,n))),norm(read(n)),n+' source changed');
function decode(script){const s=script.toString(),packed=Buffer.from(JSON.parse(s.slice(s.indexOf(',')+1).trim().replace(/\);$/,'')),'base64');return codec.decode(zlib.gunzipSync(packed));}
const previous=manifest(read('prepared/manifest.js')),current=manifest(fs.readFileSync(path.join(dir,'manifest.js'))),entries=[];
for(const e of current.entries){const old=previous.entries.find(v=>v.kind===e.kind&&v.size===e.size&&v.seed===e.seed);assert(old);const value=decode(read('prepared/'+old.file)),generated=decode(fs.readFileSync(path.join(dir,e.file)));
 assert(isDeepStrictEqual(value.profile,generated.profile));assert.equal(e.props,old.props);assert.equal(e.fits,old.fits);assert.equal(generated.key,e.key);assert.notEqual(value.key,e.key);assert(value.snapshot.P.every(p=>p[0]!==30),'完成サンプル内の接地対象は別途検証が必要');
 for(const k of Object.keys(value.snapshot))if(!['CF','P'].includes(k))assert(isDeepStrictEqual(value.snapshot[k],generated.snapshot[k]),'生成条件が変化: '+k);
 value.key=e.key;const raw=codec.encode(value),packed=zlib.gzipSync(raw,{level:9,mtime:0}),hash=sha(packed),file=e.kind+'-'+e.size+'-'+e.seed+'-'+hash.slice(0,12)+'.js',text='TDPreparedSamples.register('+JSON.stringify(file)+','+JSON.stringify(packed.toString('base64'))+');\n';
 fs.writeFileSync(path.join(dir,file),text);entries.push({...e,file,sha256:hash,rawBytes:raw.length,gzipBytes:packed.length,scriptBytes:Buffer.byteLength(text),httpGzipBytes:zlib.gzipSync(text,{level:9}).length});console.log(JSON.stringify({kind:e.kind,file,gzipBytes:packed.length,completedContentsFrom:base}));
}
fs.writeFileSync(path.join(dir,'manifest.js'),'window.TDPreparedManifest='+JSON.stringify({...current,entries})+';\n');

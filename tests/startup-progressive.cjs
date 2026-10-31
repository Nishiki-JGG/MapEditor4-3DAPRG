// 実 Chrome で通信を遅延・失敗させ、編集と再試行、既存サンプルの互換性を確認する。
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(process.argv[2]||path.join(__dirname,'..')),{withPage}=require(path.join(root,'tests/cdp'));
let failOnce=false;
const server=http.createServer((q,r)=>{
 const n=decodeURIComponent(new URL(q.url,'http://x').pathname),f=path.resolve(root,'.'+n);
 if(!f.startsWith(root+path.sep))return r.writeHead(403).end();
 if(failOnce&&n==='/props/shared/assets.js'){failOnce=false;return r.writeHead(503).end('test');}
 const send=()=>fs.readFile(f,(e,b)=>r.writeHead(e?404:200,{'Content-Type':/\.m?js$/.test(f)?'text/javascript':f.endsWith('.html')?'text/html':'application/octet-stream'}).end(e?'404':b));
 if(n==='/props/shared/assets.js')setTimeout(send,3000);else send();
});
async function until(p,expression){for(let i=0;i<600;i++){assert.deepEqual(p.errors,[]);if(await p.eval(expression))return;await new Promise(r=>setTimeout(r,100));}throw Error('待機期限: '+expression);}
async function check(retry){
 failOnce=retry;
 return withPage(`http://127.0.0.1:${server.address().port}/index.html#size=64`,async p=>{
  await until(p,'!!window.__app&&!__app.preparation&&!!__app.preparationStats');
  const first=await p.eval('({assets:TDStartupAssets.status,ms:performance.now(),props:__app.props.length})');assert.equal(first.assets.complete,false);assert.equal(first.props,0);
  const edit=await p.eval(`(()=>{const a=__app,k=(a.H.length-1)/2,before=a.H[k];a.setTool('raise');a.stroke(0,0,3);return{before,after:a.H[k],locked:[...document.querySelectorAll('.tools button')].some(b=>b.disabled)}})()`);
  assert.ok(edit.after>edit.before);assert.equal(edit.locked,false);
  assert.ok(await p.eval('__app.serializeArchive().then(b=>b.size>0)'));
  const placement=await p.eval(`(()=>{__app.setTool('place');const before=__app.props.length;__app.stroke(0,0,1);return {before,after:__app.props.length,disabled:[...document.querySelectorAll('[data-asset-type]')].every(b=>b.disabled)}})()`);
  assert.equal(placement.before,placement.after);assert.equal(placement.disabled,true);
  if(retry){await until(p,'TDStartupAssets.status.failed.length>0');assert.equal(await p.eval('document.querySelector("#assetProgress button").hidden'),false);await p.eval('document.querySelector("#assetProgress button").click()');}
  await until(p,'TDStartupAssets.complete');
  assert.equal(await p.eval('!!__app.heroBody'),true);
  assert.equal(await p.eval('[...document.querySelectorAll("[data-asset-type]")].some(b=>b.disabled)'),false);
  await p.eval('__app.state.variant.place=0;__app.stroke(0,0,1)');assert.ok(await p.eval('__app.props.length>0'));
  let sample;
  if(!retry){const ok=await p.eval("__app.prepareMap('sample',7)");if(!ok)console.error(await p.eval("document.getElementById('toast').textContent"));assert.equal(ok,true);sample=await p.eval('__app.preparationStats');assert.equal(sample.preparedSource,'bundle');assert.equal(sample.props,5761);assert.equal(sample.fits,552);}
  assert.equal(await p.eval('__app.renderer.getContext().getError()'),0);assert.deepEqual(p.errors,[]);
  return{retry,first,edit,placement,final:await p.eval('TDStartupAssets.status'),sample};
 },{hardware:true,wait:300,w:1000,h:700});
}
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));try{console.log(JSON.stringify([await check(false),await check(true)],null,2));}finally{server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

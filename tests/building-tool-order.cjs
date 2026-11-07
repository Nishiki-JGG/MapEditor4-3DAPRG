const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),{withPage}=require('./cdp');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/playwright/building-tool-order');fs.mkdirSync(out,{recursive:true});
const server=http.createServer((q,r)=>{const n=new URL(q.url,'http://x').pathname.slice(1)||'index.html',f=path.resolve(root,n);if(!f.startsWith(root+path.sep))return r.writeHead(403).end();fs.readFile(f,(e,b)=>r.writeHead(e?404:200,{'Content-Type':n.endsWith('.js')?'text/javascript':n.endsWith('.html')?'text/html':'application/octet-stream'}).end(e?'404':b));});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));try{
const url=process.env.TEST_URL||'http://127.0.0.1:'+server.address().port+'/index.html#size=32';
await withPage(url,async p=>{
await p.eval('(async()=>{while(!window.__app)await new Promise(r=>setTimeout(r,100));await __app.bootReady;})()');
const result=await p.eval(`(()=>{
 const A=__app,$=id=>document.getElementById(id),buttons=[...$('tools').children];
 const before=JSON.stringify({ruins:A.serialize().ruins,props:A.serialize().props});
 const last=buttons.at(-1),tool={id:last.dataset.tool,label:last.textContent};
 $('palette').value='all';$('palette').dispatchEvent(new Event('change'));
 const groups=[...$('types').children].map(d=>d.querySelector('summary').childNodes[1].textContent.trim());
 const flows=[];for(let i=0;i<2;i++){last.click();flows.push({tool:A.state.tool,hidden:$('ruinsOpts').hidden,title:$('ruinsOpts').querySelector('h2').textContent});buttons.find(b=>b.dataset.tool==='place').click();}
 const placeGroups=[...$('variants').querySelectorAll('details>summary')].map(s=>s.textContent);
 $('slots').children[0].click();const restored=A.state.tool;
 const after=JSON.stringify({ruins:A.serialize().ruins,props:A.serialize().props});
 last.click();last.scrollIntoView({block:'center'});A.update(0);A.render();
 return {tool,groups,placeGroups,flows,restored,unchanged:before===after,slotTitle:$('slots').children[0].title,oldLabel:document.body.textContent.includes('遺跡を組む')};
})()`);
assert.deepEqual(result.tool,{id:'ruins',label:'建造物を組む'});
assert.deepEqual(result.groups.slice(0,3),['木・倒木','草花・低木','岩・崖']);
assert.equal(result.groups.indexOf('洞窟装飾'),result.groups.indexOf('坑道小物')+1);
assert(result.placeGroups[0].startsWith('木・倒木'));assert(result.placeGroups.findIndex(s=>s.startsWith('洞窟装飾'))>2);
assert(result.flows.every(v=>v.tool==='ruins'&&!v.hidden&&v.title==='建造物を組む'));
assert.equal(result.restored,'ruins');assert(result.unchanged);assert(!result.oldLabel);assert.deepEqual(p.errors,[]);
await p.screenshot(path.join(out,process.env.TEST_URL?'published.png':'local.png'));
fs.writeFileSync(path.join(out,process.env.TEST_URL?'published.json':'local.json'),JSON.stringify({pass:true,...result,errors:p.errors},null,2));console.log(JSON.stringify({pass:true,...result}));
},{w:1200,h:900,wait:1500,initScript:"sessionStorage.setItem('me_pending','flat');localStorage.setItem('map-editor-telemetry','off');localStorage.setItem('tdj-map-editor/slots',JSON.stringify({1:{tool:'ruins'}}));"});
}finally{server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});

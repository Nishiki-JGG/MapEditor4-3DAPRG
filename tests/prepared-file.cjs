// README通りindex.htmlを直接開く経路。file accessを緩和するChromeフラグは使わない。
const path=require('path'),{pathToFileURL}=require('url'),assert=require('assert/strict'),{withPage}=require('./cdp');
withPage(pathToFileURL(path.resolve(__dirname,'../index.html')).href+'#size=64',async p=>{
 for(let i=0;i<160;i++){if(await p.eval('!!window.__app&&!__app.preparation&&!!__app.preparationStats'))break;await new Promise(r=>setTimeout(r,300));}
 const r=await p.eval(`({stats:__app.preparationStats,protocol:location.protocol,gl:__app.renderer.getContext().getError()})`);assert.equal(r.protocol,'file:');assert.equal(r.stats.preparedSource,'bundle');assert(r.stats.walkReused&&r.stats.fitStats===null);assert.equal(r.gl,0);assert.deepEqual(p.errors,[]);console.log(JSON.stringify({pass:true,...r}));
},{hardware:true,fileAccess:false,wait:1000,w:1280,h:720}).catch(e=>{console.error(e);process.exitCode=1;});

const assert=require('assert/strict'),fs=require('fs'),vm=require('vm'),crypto=require('crypto'),THREE=require('../three.min.js');
const c={THREE,TextEncoder,performance,btoa,atob,setTimeout,DOMException,Map,Float32Array,Uint8Array};c.window=c;vm.createContext(c);
for(const f of ['preparation.js','cliff-contact.js','cliff-fits.js'])vm.runInContext(fs.readFileSync(__dirname+'/../terrain/'+f,'utf8'),c);
(async()=>{
 let valid=true,visits=0;const job={valid:()=>valid,progress(){}};
 function* steps(){try{for(let i=0;i<100;i++){visits++;yield;}}finally{visits+=1000;}}
 valid=false;await assert.rejects(c.TDPreparation.run(steps(),job),{name:'AbortError'});assert.equal(visits,0);
 valid=true;const iter=steps();iter.next();valid=false;await assert.rejects(c.TDPreparation.run(iter,job),{name:'AbortError'});assert.equal(visits,1001);
 await c.TDPreparation.put('a',{one:1},false);assert.equal((await c.TDPreparation.get('a')).one,1);await c.TDPreparation.put('b',{},false);assert.equal(await c.TDPreparation.get('a'),null);await c.TDPreparation.put('c',{},false);assert.equal(await c.TDPreparation.get('a'),null);await c.TDPreparation.remove('b');assert.equal(await c.TDPreparation.get('b'),null);
 c.indexedDB={open(){throw new Error('blocked');}};assert.equal(await c.TDPreparation.get('missing'),null);assert.equal(await c.TDPreparation.put('blocked',{},true),false);assert.equal(await c.TDPreparation.stash('a',{}),false);assert.equal(await c.TDPreparation.pending('invalid'),null);
 const g=new THREE.BoxGeometry(1,2,1).toNonIndexed(),types=[{id:'cliff',geo:g}],hash=b=>crypto.createHash('sha256').update(b).digest('hex');const store=new c.TDCliffFits.Store(types,hash),p=[0,1,2,.5,1,1,1,0,'p1'];store.input='terrain1';store.set(p,g.clone(),'terrain1');const data=JSON.parse(JSON.stringify(store.save()));const staged=await store.prepareLoad(data,[p],'terrain1',{valid:()=>true});
 const loaded=new c.TDCliffFits.Store(types,hash);assert.throws(()=>loaded.installPrepared(staged,[p],'terrain2'));assert.equal(loaded.records.size,0);assert.throws(()=>loaded.installPrepared(staged,[[...p.slice(0,3),.7,...p.slice(4)]],'terrain1'));loaded.installPrepared(staged,[p],'terrain1');assert.equal(hash(loaded.get(p).geometry.attributes.position.array),hash(g.attributes.position.array));
 await assert.rejects(loaded.prepareLoad(data,[p],'terrain2',{valid:()=>true}));await assert.rejects(loaded.prepareLoad(data,[p],'terrain1',{valid:()=>false}),{name:'AbortError'});assert.equal(loaded.records.size,1);
 const legacy=await loaded.prepareLoad(undefined,[[0,2,2,0,1,0]],'legacy');loaded.installPrepared(legacy,[[0,2,2,0,1,0,null,null,'assigned']],'legacy');assert.equal(loaded.records.size,0);
 const h=new THREE.PlaneGeometry(4,4,10,10);h.rotateX(-Math.PI/2);const sync=new c.TDCliffContact.Surface([h]),asyncSurface=await c.TDCliffContact.Surface.prepare([h],{valid:()=>true});assert.equal(sync.stats.triangles,asyncSurface.stats.triangles);assert.deepEqual([...sync.adjacency].map(([k,v])=>[k,[...v]]),[...asyncSurface.adjacency].map(([k,v])=>[k,[...v]]));assert.equal(sync.height(.2,.3),asyncSurface.height(.2,.3));
 console.log(JSON.stringify({pass:true,cancellation:true,cacheEviction:true,stagedShapeExact:true,staleInputRejected:true,failedLoadPreservesStore:true,surfaceExact:true}));
})().catch(e=>{console.error(e);process.exitCode=1;});

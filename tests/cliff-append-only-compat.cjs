// Isolated proposal only. Existing assets, prepared bundles and readers are not edited.
const fs=require('fs'),path=require('path'),vm=require('vm'),zlib=require('zlib'),crypto=require('crypto'),assert=require('assert/strict'),THREE=require('../three.min.js'),codec=require('../terrain/prepared-codec');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/playwright/night-props/batch19-cliff-proposal');fs.mkdirSync(out,{recursive:true});
const read=f=>fs.readFileSync(path.join(root,f),'utf8'),sha=x=>crypto.createHash('sha256').update(x).digest('hex'),jsonSha=x=>sha(JSON.stringify(x));
const c={THREE,window:{},TextEncoder,btoa,atob,Int32Array,Uint16Array};vm.createContext(c);vm.runInContext(read('props/common.js'),c);c.TDProps=c.window.TDProps;c.TDGeo=c.window.TDGeo;
for(const id of ['cliff','cliff_split','cliff_shoulder','cliff_joint','cliff_slab','cliff_talus'])vm.runInContext(read('props/'+id+'.js'),c);
vm.runInContext(read('terrain/cliff-fits.js'),c);
const built=c.TDProps.build(),source=new Map(built.map(t=>[t.id,t])),catalog=JSON.parse(read('output/playwright/night-props/batch19-integrated/contract.json')).results.after.catalog;
const oldTypes=catalog.map(t=>source.get(t.id)||{...t.metadata,geo:new THREE.BufferGeometry()}),Store=c.window.TDCliffFits.Store;
assert.equal(oldTypes.length,129);
const original=source.get('cliff'),g=original.geo.clone(),p=g.attributes.position;
// Locate the isolated 20-triangle top piece without changing a shared generator.
const parents=Array.from({length:p.count/3},(_,i)=>i),keys=new Map(),find=i=>parents[i]===i?i:parents[i]=find(parents[i]);
for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e5)).join('/');if(keys.has(key))parents[find(i/3|0)]=find(keys.get(key));else keys.set(key,i/3|0);}
const groups=new Map();for(let t=0;t<parents.length;t++){const r=find(t);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(t);}
const piece=[...groups.values()].find(ts=>ts.length===20&&Math.min(...ts.flatMap(t=>[p.getY(t*3),p.getY(t*3+1),p.getY(t*3+2)]))>1.9);assert(piece);
for(const t of piece)for(let q=0;q<3;q++)p.setY(t*3+q,p.getY(t*3+q)-.08);
g.computeBoundingBox();original.geo.computeBoundingBox();assert.deepEqual(g.boundingBox.toArray?.()||[g.boundingBox.min.toArray(),g.boundingBox.max.toArray()],[original.geo.boundingBox.min.toArray(),original.geo.boundingBox.max.toArray()]);
const fresh={...original,id:'cliff_connected',name:'縦岩（接続補修案）',geo:g},newTypes=[...oldTypes,fresh];
assert.deepEqual(newTypes.slice(0,129).map(t=>t.id),oldTypes.map(t=>t.id));
const oldStore=new Store(oldTypes,sha),next=new Store(newTypes,sha);
c.PROP=oldTypes;c.cliffFits=oldStore;c.TDCliffFits=c.window.TDCliffFits;c.TDPreparation={each:async(xs,f)=>{for(const x of xs)await f(x);}};
const app=read('app.js'),start=app.indexOf('async function expandPreparedGeometry('),end=app.indexOf('\nfunction preparedProfile(',start);assert(start>=0&&end>start);vm.runInContext(app.slice(start,end),c);
for(let i=0;i<129;i++)if(source.has(oldTypes[i].id))assert.equal(oldStore.sourceHash(i),next.sourceHash(i));
assert.notEqual(next.sourceHash(129),oldStore.sourceHash(oldTypes.indexOf(original)));
const reports=[];let totalFits=0,cliffFits=0,affineFits=0;
;(async()=>{for(const file of fs.readdirSync(path.join(root,'prepared')).filter(f=>f!=='manifest.js')){
 const script=read('prepared/'+file),packed=Buffer.from(JSON.parse(script.slice(script.indexOf(',')+1).trim().replace(/\);$/,'')),'base64'),bundle=codec.decode(zlib.gunzipSync(packed)),snapshot=bundle.snapshot,data=snapshot.CF;
 const before={packed:sha(packed),snapshot:jsonSha(snapshot),geometry:jsonSha(data),placements:jsonSha(snapshot.P)};
 // Use the production read-time expansion on an in-memory copy, never on the bundle.
 const copy={snapshot:{CF:structuredClone(data)}};await c.expandPreparedGeometry(copy);const expanded=copy.snapshot.CF;
 const input=Object.values(expanded.instances)[0].input;oldStore.validate(expanded,snapshot.P,input);next.validate(expanded,snapshot.P,input);
 const newP=[129,0,0,0,1,0,1,null,'isolated-new-cliff'],record=next.prepare(newP,g.clone(),input).record,mixed={...expanded,instances:{...expanded.instances,[newP[8]]:record}};
 next.validate(mixed,[...snapshot.P,newP],input);
 const wrong=structuredClone(expanded),first=Object.keys(wrong.instances)[0];wrong.instances[first].sourceSha256='0'.repeat(64);assert.throws(()=>next.validate(wrong,snapshot.P,input));
 const affine=Object.entries(expanded.instances).find(([,r])=>r.affine);if(affine){const bad=structuredClone(expanded),r=bad.instances[affine[0]],geo=c.window.TDCliffFits.geometry(r.geometry);geo.attributes.position.setX(0,geo.attributes.position.getX(0)+.001);r.geometry=c.window.TDCliffFits.describe(geo);assert.throws(()=>next.validate(bad,snapshot.P,input));}
 assert.equal(jsonSha(snapshot),before.snapshot);assert.equal(jsonSha(data),before.geometry);assert.equal(jsonSha(snapshot.P),before.placements);
 const fits=Object.values(data.instances),target=fits.filter(r=>r.type==='cliff').length,affines=fits.filter(r=>r.affine).length;totalFits+=fits.length;cliffFits+=target;affineFits+=affines;
 reports.push({file,bundleHash:before.packed,fits:fits.length,targetCliffFits:target,affineFits:affines,oldDataUnmodified:true,oldAndNewCanCoexist:true,invalidShaRejected:true,invalidAffineRejected:!!affine});
}
assert.equal(totalFits,778);assert.equal(cliffFits,228);
const result={pass:true,proposalOnly:true,productionModified:false,oldIds:129,newIndex:129,newId:fresh.id,newTriangles:p.count/3,movedTriangles:piece.length,boundsExact:true,oldSourceHashesExact:true,totalFits,cliffFits,affineFits,reports,nativeForNewIdImplemented:false,oldReaderUnderstandsNewId:false};
fs.writeFileSync(path.join(out,'compatibility.json'),JSON.stringify(result,null,2));fs.writeFileSync(path.join(out,'new-mesh-prototype.json'),JSON.stringify(c.window.TDCliffFits.describe(g)));
// The isolated flat-view harness keeps the old test ID solely to reuse its six cameras.
const preview=Object.fromEntries(['id','name','r','min','sc','slope','vis','anyGround','shape','tags','height','material'].filter(k=>original[k]!==undefined).map(k=>[k,original[k]]));preview.name='縦割れの基本岩（隔離試作）';
fs.writeFileSync(path.join(out,'cliff.js'),'TDProps.add({...'+JSON.stringify(preview)+',build(){return new THREE.BufferGeometryLoader().parse('+JSON.stringify(g.toJSON())+');}});\n');
console.log(JSON.stringify(result));
})().catch(e=>{console.error(e);process.exitCode=1;});

// Run the actual query functions against complete and field-only fitted footprints.
const fs=require('fs'),vm=require('vm'),path=require('path'),assert=require('assert/strict');
const root=process.argv[2]||path.resolve(__dirname,'..'),c={window:{},Map,Float32Array,Float64Array,ArrayBuffer,TextEncoder};vm.createContext(c);
vm.runInContext(fs.readFileSync(path.join(root,'terrain/completed-state.js'),'utf8'),c);
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
vm.runInContext('const SHAPE_CELL=.05,SHAPE_MIN_H=.1;'+app.slice(app.indexOf('function shapeField('),app.indexOf('let colliders = null')),c);
const compact=c.window.TDCompletedState.compactFittedFootprint;
const f={x0:-.1,z0:-.1,nx:5,nz:5,top:new Float32Array(25).fill(-1e9),R:1,sink:0,fields:new Map()};f.top[12]=.2;f.top[13]=.4;
assert.equal(compact(f),f,'An unfinished field must keep its height input');c.shapeField(f,1);const small=compact(f);
assert.notEqual(small,f);assert.equal(small.top,undefined);assert.equal(small.fieldOnly,true);assert.equal(small.fields,f.fields);assert(f.top instanceof Float32Array,'Do not mutate history/source');
const query=(q,x,z)=>c.shapeDist([0,0,1,0,1,q,1,0,1],x,z);
let points=0;for(let z=-.4;z<=.4;z+=.017)for(let x=-.4;x<=.4;x+=.019){assert.equal(query(small,x,z),query(f,x,z));points++;}
assert.equal(compact(small),small);assert.throws(()=>c.shapeField(small,2),/未準備/);
assert.equal(compact({...f,sink:.05}).top,f.top);
assert.equal(compact({...f,fields:new Map([[20,f.fields.get(20)],[40,f.fields.get(20)]])}).top,f.top);
assert.equal(compact({...f,fields:new Map([[20,{dist:new Float32Array(2),edge:[]}]])}).top,f.top);
// Changing an instance pose must invalidate the old completed fit before queries.
const THREE=require(path.join(root,'three.min.js'));Object.assign(c,{THREE,btoa,atob,structuredClone});vm.runInContext(fs.readFileSync(path.join(root,'terrain/cliff-fits.js'),'utf8'),c);
const geo=new THREE.BoxGeometry(1,2,1),store=new c.window.TDCliffFits.Store([{id:'rock',geo}],()=> 'hash'),p=[0,1,2,0,1,0,1,0,'rock-1'];store.input='terrain';store.set(p,geo.clone(),'terrain');assert(store.valid(p));p[4]=2;assert(!store.valid(p));store.synchronize('terrain',[p]);assert.equal(store.records.size,0);assert.equal(store.cache.size,0);
console.log(JSON.stringify({pass:true,queryPoints:points,offGridExact:true,sourceNotMutated:true,unfinishedAndPrototypeRetained:true,poseInvalidation:true}));

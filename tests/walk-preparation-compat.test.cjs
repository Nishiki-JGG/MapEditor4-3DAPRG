const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8'),start=app.indexOf('function installWalkPreparation(w){'),end=app.indexOf('// Download cache versions',start),source=app.slice(start,end);
const parts=['a','b','c','d','e'].map(c=>c.repeat(64)),signature=parts.join('/'),legacy=parts.slice(0,4).concat('f'.repeat(64)).join('/');
function context(){const target=()=>({array:new Float32Array(1),needsUpdate:false});const c={Uint8Array,Float32Array,N:1,A:new Uint8Array(1),F:new Float32Array(1),H:new Float32Array(1),state:{water:0},markers:[{kind:'enemy',enemyRank:'common'}],walkDirty:false,mapPreparation:{},walkPreparationSignature:()=>signature,wkGeo:{attributes:{position:{array:new Float32Array(3)},walk:target(),forced:target(),secret:target()},computeBoundingSphere(){}},idx:()=>0,vx:()=>0};vm.createContext(c);vm.runInContext(source,c);return c;}
function record(extra={}){return{signature,auto:Uint8Array.of(1),walk:Uint8Array.of(1),forced:Uint8Array.of(0),secret:Uint8Array.of(0),floor:Float32Array.of(3),...extra};}
let checks=0;
for(const version of [undefined,2]){const c=context();c.installWalkPreparation(record({signatureVersion:version}));assert.equal(c.F[0],3);assert.equal(c.walkDirty,false);checks++;}
{const c=context();c.installWalkPreparation(record({signature:legacy}));assert(c.walkDirty);assert.equal(c.F[0],0,'Never install stale floor');assert.equal(c.A[0],0,'Never install stale flags');assert.equal(c.mapPreparation.walkCompatibilityRepair,'legacy-enemy-rank');checks++;}
for(const change of [{signatureVersion:2,signature:legacy},{signatureVersion:3},{signature:'0'.repeat(64)+'/'+legacy.split('/').slice(1).join('/')},{signature:legacy,auto:Uint8Array.of(2)},{signature:legacy,floor:Float32Array.of(NaN)},{signature:legacy,walk:new Uint8Array(2)}]){const c=context();assert.throws(()=>c.installWalkPreparation(record(change)),/通行準備とマップが一致しません/);assert.equal(c.F[0],0);checks++;}
{const c=context();c.markers=[];assert.throws(()=>c.installWalkPreparation(record({signature:legacy})));checks++;}
console.log(JSON.stringify({pass:true,checks}));

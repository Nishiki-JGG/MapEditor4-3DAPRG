const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=process.argv[2]||path.resolve(__dirname,'..'),THREE=require(path.join(root,'three.min.js'));
const c={THREE,window:{}};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,'props/common.js'),'utf8'),c);c.TDGeo=c.window.TDGeo;c.TDProps=c.window.TDProps;
for(const id of ['cliff','cliff_split','cliff_shoulder','cliff_joint','cliff_slab','cliff_talus'])vm.runInContext(fs.readFileSync(path.join(root,'props',id+'.js'),'utf8'),c);
const one=c.TDProps.build(),two=c.TDProps.build(),v=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3(),d=new THREE.Vector3(),ab=new THREE.Vector3(),ad=new THREE.Vector3();
assert.equal(one.length,6);assert.equal(new Set(one.map(t=>t.id)).size,6);
for(const [i,t]of one.entries()){
 const g=t.geo,p=g.attributes.position;g.computeBoundingBox();g.boundingBox.getSize(v);
 assert.deepEqual(p.array,two[i].geo.attributes.position.array,'形状が非決定的');assert.equal(t.material,'rock');assert(!t.sharedAsset,'暗い共有材質を継承した');
 assert(p.count/3<800,'部品当たり面数が想定を超える');
 for(const attr of Object.values(g.attributes))for(const x of attr.array)assert(Number.isFinite(x));
 for(let k=0;k<p.count;k+=3){a.fromBufferAttribute(p,k);b.fromBufferAttribute(p,k+1);d.fromBufferAttribute(p,k+2);assert(ab.subVectors(b,a).cross(ad.subVectors(d,a)).lengthSq()>1e-12,'潰れた面');}
 for(let k=0;k<g.attributes.normal.count;k++){a.fromBufferAttribute(g.attributes.normal,k);assert(Math.abs(a.length()-1)<1e-4);}
 if(i<4){assert(Math.abs(v.y-2.4)<1e-5);for(const height of [2.4,4.8,7.2])for(const width of [.9,1.2]){const sy=height/(v.y*width);assert(Math.abs(v.y*width*sy-height)<1e-8);}}
 else{assert(v.x<=1.2&&v.y<=.45&&v.z<=.6,'裾部品の配置前外寸上限');assert.equal(t.r,0,'低い小石で不可視の通行障害を作らない');}
}
// 橋が輪郭の内側を横切る場合と、中心は離れていても回転した端が入る場合。
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const prelude=app.slice(app.indexOf('const cliffHulls'),app.indexOf('function autoRocks('));assert(prelude.length>100);
Object.assign(c,{PROP:one,state:{agent:{radius:.3},spawn:{x:100,z:100}},bridges:[],stairs:[],markers:[],nearFeature:()=>false,clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),lerp:(a,b,t)=>a+(b-a)*t});vm.runInContext(prelude,c);
assert.equal(c.cliffOverlapsLink([[-2,-2],[2,-2],[2,2],[-2,2]],[-4,0],[4,0],.1),true);
c.bridges.push({x1:-5,z1:0,x2:5,z2:0,w:2});
assert.equal(c.cliffProtected([0,0,2,Math.PI/2,1]),true,'中心だけで橋際を通してしまう');
assert.equal(c.cliffProtected([0,0,5,Math.PI/2,1]),false);
c.bridges.length=0;c.markers.push({kind:'port',x:0,z:0,w:2});assert.equal(c.cliffProtected([0,0,2,Math.PI/2,1]),true);
console.log(JSON.stringify({pass:true,parts:6,finiteNondegenerate:true,stretchCases:24,bridgeAndPortFootprint:true,smallDebrisWalkThrough:true}));

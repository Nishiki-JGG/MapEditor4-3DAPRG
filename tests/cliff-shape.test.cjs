const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=process.argv[2]||path.resolve(__dirname,'..'),THREE=require(path.join(root,'three.min.js'));
const c={THREE,window:{}};vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(root,'props/common.js'),'utf8'),c);
c.TDGeo=c.window.TDGeo;c.TDProps=c.window.TDProps;vm.runInContext(fs.readFileSync(path.join(root,'props/cliff.js'),'utf8'),c);
const first=c.TDProps.build()[0],second=c.TDProps.build()[0],g=first.geo,p=g.attributes.position;
assert.equal(first.id,'cliff');assert.equal(first.shape,true);assert.equal(first.height,2.36);
assert(p.count/3<=600,'per-instance triangle budget');assert(p.count/3>130,'missing fractured shoulders');
assert.deepEqual(p.array,second.geo.attributes.position.array,'non-deterministic shape');
for(const a of Object.values(g.attributes))for(const v of a.array)assert(Number.isFinite(v));
g.computeBoundingBox();const min=[-1.152980089,-.150263384,-.601505458],max=[1.335498214,2.254099369,.721978605];
for(let k=0;k<3;k++){assert(Math.abs(g.boundingBox.min.getComponent(k)-min[k])<1e-5);assert(Math.abs(g.boundingBox.max.getComponent(k)-max[k])<1e-5);}
const a=new THREE.Vector3(),b=new THREE.Vector3(),d=new THREE.Vector3(),ab=new THREE.Vector3(),ad=new THREE.Vector3();
for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);d.fromBufferAttribute(p,i+2);assert(ab.subVectors(b,a).cross(ad.subVectors(d,a)).lengthSq()>1e-12,'degenerate face');}
for(let i=0;i<g.attributes.normal.count;i++){a.fromBufferAttribute(g.attributes.normal,i);assert(Math.abs(a.length()-1)<1e-4,'bad normal');}
console.log(JSON.stringify({pass:true,triangles:p.count/3,boundsPreserved:true,deterministic:true,finite:true,nonDegenerate:true,unitNormals:true}));

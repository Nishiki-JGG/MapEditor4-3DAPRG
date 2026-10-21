// node tests/cliff-relief.test.cjs (no browser or additional dependency)
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=process.argv[2]||path.resolve(__dirname,'..');
const THREE=require(path.join(root,'three.min.js'));
const ctx={THREE,window:{},TDGeo:{hash2:(x,y)=>{const n=Math.sin(x*127.1+y*311.7)*43758.5453;return n-Math.floor(n);}}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'terrain/cliff-relief.js'),'utf8'),ctx);
const {build,exportMesh}=ctx.window.TDCliffRelief;
function source(size,segments,height){
 const g=new THREE.PlaneGeometry(size,size,segments,segments).rotateX(-Math.PI/2),p=g.attributes.position;
 for(let i=0;i<p.count;i++)p.setY(i,height(p.getX(i),p.getZ(i)));
 for(const [key,n]of Object.entries({splatA:4,splatB:4,splatC:1,cliffT:3,cliffM:4,cliffW:2}))g.setAttribute(key,new THREE.Float32BufferAttribute(new Float32Array(p.count*n).fill(key==='cliffT'?1:0),n));
 g.computeVertexNormals();return g;
}
const flat=source(8,16,()=>0),none=build(flat,()=>0,4);assert.equal(none.index.count,0);
const h=(x,z)=>x*2.2+.1*z,s=source(8,16,h),before=Buffer.from(s.attributes.position.array.buffer).toString('hex');
const g=build(s,h,4),again=build(s,h,4);assert(g.userData.maxOffset>.15&&g.userData.maxOffset<.61);
assert.equal(before,Buffer.from(s.attributes.position.array.buffer).toString('hex'),'editable heightfield mutated');
assert.deepEqual(g.attributes.position.array,again.attributes.position.array,'non-deterministic geometry');
for(const attr of Object.values(g.attributes))for(const v of attr.array)assert(Number.isFinite(v),'invalid attribute');
for(const i of g.index.array)assert(i<g.attributes.position.count);
// Outer edges must lie exactly on the source surface; no floating rim or displaced connector.
let rimCount=0;
for(let i=0;i<g.attributes.position.count;i++){
 const p=g.attributes.position,x=p.getX(i),y=p.getY(i),z=p.getZ(i);
 if(Math.abs(Math.abs(x)-4)<1e-5||Math.abs(Math.abs(z)-4)<1e-5){assert(Math.abs(y-h(x,z))<2e-5);rimCount++;}
}
assert(rimCount>32);
const out=exportMesh(g,4,0),p=g.attributes.position.array,n=g.attributes.normal.array;
assert.equal(out.positions.length,p.length);assert.equal(out.triangles.length,g.index.count);
for(let i=0;i<p.length;i+=3){assert(Math.abs(out.positions[i]-p[i]-4)<1e-5);assert(Math.abs(out.positions[i+2]-(4-p[i+2]))<1e-5);assert(Math.abs(out.normals[i+2]+n[i+2])<1e-5);}
for(let i=0;i<g.index.count;i+=3){assert.equal(out.triangles[i],g.index.array[i]);assert.equal(out.triangles[i+1],g.index.array[i+2]);}
const large=source(128,256,h),start=performance.now(),lg=build(large,h,64);
assert(lg.index.count/3<=Math.max(64000,large.index.count/3));
console.log(JSON.stringify({pass:true,flatTriangles:0,rimVertices:rimCount,deterministic:true,sourceUnchanged:true,small:g.userData,largestMap:{...lg.userData,milliseconds:Math.round(performance.now()-start)},unityExportCoordinatesAndWinding:true},null,2));

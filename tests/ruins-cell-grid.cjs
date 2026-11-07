const assert=require('node:assert/strict'),R=require('../ruins.js');
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`),grid=p=>{const s=R.sockets(p);for(const a of s)for(const sign of [-1,1])for(const v of [a.x-sign*a.dz*a.thickness/2,a.z+sign*a.dx*a.thickness/2])near(v/R.GRID,Math.round(v/R.GRID));};
let cases=0;
for(const kind of ['wall','wall_broken','wall_ruined','opening','opening_broken','window_wall','wall_niche','balustrade','edge','arch','arch_broken','buttress_wall'])for(const rot of [0,Math.PI/2,Math.PI,Math.PI*1.5])for(const x of [-2.26,-.26,-.24,0,.24,.26,2.26])for(const join of [true,false]){
 const raw={...R.defaults(kind,x,x+.17),rot},before=JSON.stringify(raw),q=R.snap(R.empty(),raw,{grid:true,join});grid(q.item);assert.equal(JSON.stringify(raw),before);assert.deepEqual(R.snap(R.empty(),raw,{grid:false,join:false}).item,raw);cases++;
}
for(let length=.5;length<=32;length+=.5)for(let r=0;r<4;r++){const p=R.snap(R.empty(),{...R.defaults('wall',-.11,.17),length,rot:r*Math.PI/2},{grid:true}).item;grid(p);for(const i of [0,1,4,5]){const v=R.footprint(p)[i];near(v/R.GRID,Math.round(v/R.GRID));}cases++;}
// Grid-on must never inherit an old center-line phase. Grid-off may still join it.
const legacy={version:1,nextId:2,items:[{...R.defaults('wall'),id:'ruins_1'}]},before=JSON.stringify(legacy),raw=R.defaults('wall',2.1,.03);
const q=R.snap(legacy,raw,{grid:true,join:true});grid(q.item);assert.equal(q.snapped,false);
const free=R.snap(legacy,raw,{grid:false,join:true});assert.equal(free.snapped,true);near(free.item.z,0);
assert.equal(JSON.stringify(R.validate(JSON.parse(before))),before);assert.equal(JSON.stringify(legacy),before);
// Repeated snapping and rotation do not accumulate drift or mutate saved items.
for(let i=0;i<16;i++){const p=R.snap(R.empty(),{...q.item,rot:i*Math.PI/2},{grid:true}).item;grid(p);const again=R.snap(R.empty(),p,{grid:true}).item;near(again.x,p.x);near(again.z,p.z);}
console.log(`PASS ${cases} cell-boundary cases, legacy preservation, grid-off, old-phase rejection and repeated rotation`);

// All structural wall families extend on the same cells, with either snap option.
for(const kind of ['wall','wall_broken','wall_ruined','opening','opening_broken','window_wall','wall_niche','balustrade','edge','arch','arch_broken','buttress_wall'])for(let r=0;r<4;r++){
 const a={...R.snap(R.empty(),{...R.defaults(kind),rot:r*Math.PI/2},{grid:true}).item,id:'ruins_1'},model={version:1,nextId:2,items:[a]},end=R.sockets(a)[1],raw={...a,id:undefined,x:a.x+end.dx*a.length+.03,z:a.z+end.dz*a.length-.02};
 const q=R.snap(model,raw,{grid:true,join:true});assert(q.snapped,kind+' grid extension');grid(q.item);
}
console.log('PASS 48 cell-aligned structural wall extensions');

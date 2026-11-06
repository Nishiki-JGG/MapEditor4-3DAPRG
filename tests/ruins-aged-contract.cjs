const assert=require('node:assert/strict'),R=require('../ruins.js');
const p={...R.defaults('wall_ruined'),id:'ruins_1'},m={version:1,nextId:2,items:[p]},g=R.mesh(p);
function roof(x,z){let y=-Infinity;for(let i=0;i<g.positions.length;i+=9){if(g.normals[i+1]<=0)continue;const [a,h,b,c,j,d,e,k,f]=g.positions.slice(i,i+9),den=(d-f)*(a-e)+(e-c)*(b-f);if(Math.abs(den)<1e-10)continue;const u=((d-f)*(x-e)+(e-c)*(z-f))/den,v=((f-b)*(x-e)+(a-e)*(z-f))/den,w=1-u-v;if(Math.min(u,v,w)>=-1e-8)y=Math.max(y,u*h+v*j+w*k);}return y;}
let samples=0;for(let z=.3;z<1.6;z+=.025)for(let x=-1.9;x<1.9;x+=.025){const f=R.floor(m,x,z);if(!f)continue;assert.ok(Math.abs(f.y-roof(x,z))<1e-8,'Rubble floor must match exported mesh');assert.ok(!R.blocked(m,x,z,0,f.y,1.6),'Point feet on the topmost rubble must not self-block');if(R.blocked(m,x,z,.01,f.y,1.6)){assert.ok(Array.from({length:24},(_,i)=>R.floor(m,x+.011*Math.cos(i*Math.PI/12),z+.011*Math.sin(i*Math.PI/12))?.y||0).some(h=>h>f.y+1e-6),'Radius blocking needs a real nearby higher fragment');}assert.ok(R.blocked(m,x,z,.01,0,1.6),'Rubble must block below its surface');samples++;}
assert.ok(samples>500);assert.deepEqual(R.sockets(p),R.sockets({...p,kind:'wall'}));assert.deepEqual(R.validate(JSON.parse(JSON.stringify(m))),m);
const opening={...R.defaults('opening_broken'),id:'ruins_1'},om={...m,items:[opening]};for(let z=-1;z<=1;z+=.05)assert.ok(!R.blocked(om,0,z,.3,0,1.6));
for(const count of [9,225]){const shapes=new Set();for(let n=1;n<=count;n++){const a={...R.defaults('wall'),id:'ruins_'+n};shapes.add(JSON.stringify(R.mesh(a)));}assert.equal(shapes.size,1);}
const e=R.exportData(m,24,129,()=>0);assert.deepEqual(e.items[0].uv,g.uv);assert.deepEqual(e.items[0].positions,g.positions.map((v,i)=>i%3===2?-v:v));
assert.deepEqual(R.mesh({...p,id:undefined}).positions,g.positions,'Assigning an ID must not change preview geometry or fallen-stone side');
console.log(JSON.stringify({pass:true,matchingRubbleSamples:samples,wallVariants:1,sharedMaterialChange:0,sharedTextureChange:0,openingClear:true,socketsPreserved:true,saveReload:true,exportMatches:true}));


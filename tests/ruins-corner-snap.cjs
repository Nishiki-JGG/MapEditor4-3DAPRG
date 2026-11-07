const assert=require('node:assert/strict'),R=require('../ruins.js');
const env={height:()=>0,half:32},near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
let cases=0;
for(const length of [1.5,2,4])for(let r=0;r<4;r++)for(const turn of [1,3])for(const end of [0,1])for(const incoming of [0,1]){
 const base=R.snap(R.empty(),{...R.defaults('wall'),length,rot:r*Math.PI/2},{grid:true}).item;
 let m=R.transaction(R.empty(),{type:'put',item:base},env);const before=JSON.stringify(m),b=R.sockets(m.items[0])[end];
 const raw={...R.defaults('wall'),length,rot:(r+turn)*Math.PI/2},a=R.sockets(raw)[incoming];
 const x=b.x-b.dx*.25-a.dx*.25,z=b.z-b.dz*.25-a.dz*.25;
 raw.x=x-a.x+.06;raw.z=z-a.z-.04;
 const result=R.snap(m,raw,{grid:true,join:true});assert.equal(result.snapped,true);assert.match(result.key,/^corner:/);
 near(result.item.x,x-a.x);near(result.item.z,z-a.z);
 m=R.transaction(m,{type:'put',item:result.item},env);assert.equal(JSON.stringify({ ...m,nextId:2,items:[m.items[0]]}),before);
 const wall=m.items[1],far=R.sockets(wall)[1-incoming],extend={...R.defaults('wall'),length,rot:wall.rot};
 const e=R.sockets(extend)[incoming];extend.x=far.x-e.x+.04;extend.z=far.z-e.z+.03;
 const joined=R.snap(m,extend,{grid:true,join:true});assert.equal(joined.snapped,true);assert.ok(!joined.key.startsWith('corner:'));
 R.transaction(m,{type:'put',item:joined.item},env);
 const off=R.snap({ ...m,items:[m.items[0]] },raw,{grid:true,join:false});assert.equal(off.snapped,false);
 for(const i of [0,1,4,5]){const v=R.footprint(off.item)[i];near(v/.5,Math.round(v/.5));}
 assert.equal(R.snap({ ...m,items:[m.items[0]] },{...raw,height:3},{grid:true,join:true}).snapped,false);
 cases++;
}
console.log(`PASS 直交接合 ${cases} ケース（4方向・両端・3寸法）、延長・接合OFF・高さ不一致・既存配置保持`);

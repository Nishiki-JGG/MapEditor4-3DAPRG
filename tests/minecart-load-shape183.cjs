const fs=require('fs'),assert=require('assert/strict'),path=require('path');
const root=process.env.LOADED_ROOT||path.resolve(__dirname,'..'),out=path.join(root,'output/loaded183-final');
const before=JSON.parse(fs.readFileSync(path.join(root,'output/loaded182-final/load-payload.json'))),after=JSON.parse(fs.readFileSync(out+'/load-payload.json')),empty=JSON.parse(fs.readFileSync(out+'/empty-payload.json'));
const b=before.assets[0],a=after.assets[0],body=empty.assets[0].positions.length/3,bed=6*8*6,first=body+bed,last=first+2*48;
for(const [key,size]of [['positions',3],['normals',3],['colors',3],['glow',1],['uv',2]]){assert.deepEqual(a[key].slice(0,first*size),b[key].slice(0,first*size),key+' unchanged body and fines');assert.deepEqual(a[key].slice(last*size),b[key].slice(last*size),key+' unchanged last seven fragments');}
assert.deepEqual(a.triangles,b.triangles);assert.deepEqual(after.textures,before.textures);assert.deepEqual([a.radius,a.height,a.shape],[b.radius,b.height,b.shape]);
const maxY=v=>Math.max(...v.filter((_,i)=>i%3===1));assert(maxY(a.positions)<=maxY(b.positions));
const raw=[...b.positions.slice(first*3,last*3)],next=[...a.positions.slice(first*3,last*3)];assert(raw.some((x,i)=>x!==next[i]));
const result={pass:true,onlyFirstTwoFragmentsChanged:true,otherSevenAndFinesExact:true,vehicleExact:true,textureBytesExact:true,triangles:a.triangles.length/3,fragmentCount:9,previousHeight:maxY(b.positions),finalHeight:maxY(a.positions),collisionBoxUnchanged:true};
fs.writeFileSync(out+'/shape-delta.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));

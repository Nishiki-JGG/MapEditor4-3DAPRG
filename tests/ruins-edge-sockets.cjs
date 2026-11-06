const assert=require('assert/strict'),R=require('../ruins.js');
const wall={...R.defaults('wall'),length:2,finish:'worn'},a=R.mesh(wall),b=R.mesh({...wall,x:2});
function cross(g,x){return [...new Set(Array.from({length:g.positions.length/3},(_,i)=>g.positions.slice(i*3,i*3+3)).filter(v=>Math.abs(v[0]-x)<1e-7).map(v=>v.slice(1).map(x=>x.toFixed(7)).join(':')))].sort();}
function filled(g,x,y,z){for(let i=0;i<g.positions.length;i+=9){const p=[0,3,6].map(k=>g.positions.slice(i+k,i+k+3));if(p.some(q=>Math.abs(q[0]-x)>1e-7))continue;const [a,b,c]=p,d=(b[2]-c[2])*(a[1]-c[1])+(c[1]-b[1])*(a[2]-c[2]);if(Math.abs(d)<1e-12)continue;const u=((b[2]-c[2])*(y-c[1])+(c[1]-b[1])*(z-c[2]))/d,v=((c[2]-a[2])*(y-c[1])+(a[1]-c[1])*(z-c[2]))/d;if(Math.min(u,v,1-u-v)>=-1e-7)return true;}return false;}
let sectionSamples=0;for(let y=.003;y<2.201;y+=.02)for(let z=-.251;z<.252;z+=.01){assert.equal(filled(a,1,y,z),filled(b,1,y,z),'Actual socket section differs');sectionSamples++;}
console.log('PASS actual weathered wall socket section, '+sectionSamples+' samples');
function roof(g,x,z){let h=-Infinity;for(let i=0;i<g.positions.length;i+=9){const [a,y,b,c,Y,d,e,H,f]=g.positions.slice(i,i+9),den=(d-f)*(a-e)+(e-c)*(b-f);if(Math.abs(den)<1e-10)continue;const u=((d-f)*(x-e)+(e-c)*(z-f))/den,v=((f-b)*(x-e)+(a-e)*(z-f))/den,w=1-u-v;if(Math.min(u,v,w)>=-1e-7)h=Math.max(h,u*y+v*Y+w*H);}return h;}
for(const kind of ['corner_in','corner_out','tee','end']){const p={...R.defaults(kind),finish:'worn'},g=R.mesh(p),x=kind==='end'?0:.5;for(let z=-.249;z<.25;z+=.005)assert.ok(Math.abs(roof(a,1,z)-roof(g,x,z))<1e-6,kind+' socket surface mismatch at '+z);}
console.log('PASS actual wall/corner/T/end cross-section heights');

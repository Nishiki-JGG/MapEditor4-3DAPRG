// Prototype saved collision field: exact solid mask + saved boundary + saved KD tree.
// No mesh fitting, rasterization, distance-grid construction or tree build on load.
(function(root){'use strict';
function check(v){if(!v)throw Error('保存した岩の通行境界が不正です');}
const assert=Object.assign(check,{equal:(a,b)=>check(a===b)});
const packed=new WeakMap();
function pack(field,f){
 if(field.kind==='saved-boundary-field-v1'){const {edge,...stored}=field;return stored;}
 if(packed.has(field))return packed.get(field);
 check(field.dist instanceof Float32Array&&field.dist.length===f.nx*f.nz&&field.dist.every(v=>Number.isFinite(v)&&v>=0));
 const bits=new Uint8Array(Math.ceil(field.dist.length/8));for(let i=0;i<field.dist.length;i++)if(field.dist[i]===0)bits[i>>3]|=1<<(i&7);
 const edge=field.edge,coords=new Uint16Array(edge.length),at=[],values=[];
 for(let i=0;i<edge.length;i++){const origin=i%2?f.z0:f.x0,n=Math.round((edge[i]-origin)/.05);assert(n>=0&&n<=65535);coords[i]=n;const expected=origin+n*.05;if(!Object.is(expected,edge[i])){at.push(i);values.push(edge[i]);}}
 const ids=Array.from({length:edge.length/2},(_,i)=>i),tree=new Uint32Array(ids.length);let offset=0;
 function build(a,axis){if(!a.length)return;const k=a.length>>1;a.sort((i,j)=>edge[i*2+axis]-edge[j*2+axis]||i-j);const pos=offset++;tree[pos]=a[k];build(a.slice(0,k),1-axis);build(a.slice(k+1),1-axis);}
 build(ids,0);
 const result={kind:'saved-boundary-field-v1',length:field.dist.length,solid:bits,coords,correctionAt:Uint32Array.from(at),correctionValues:Float64Array.from(values),tree};packed.set(field,result);return result;
}
function open(p,f){
 check(p?.kind==='saved-boundary-field-v1'&&Number.isInteger(p.length)&&p.length>0&&p.length<=2e6&&p.length===f.nx*f.nz&&Number.isFinite(f.x0)&&Number.isFinite(f.z0));
 check(p.solid instanceof Uint8Array&&p.solid.length===Math.ceil(p.length/8)&&p.coords instanceof Uint16Array&&p.tree instanceof Uint32Array&&p.coords.length===p.tree.length*2&&p.tree.length<=p.length*4);
 check(p.correctionAt instanceof Uint32Array&&p.correctionValues instanceof Float64Array&&p.correctionAt.length===p.correctionValues.length);
 const edge=Float64Array.from(p.coords,(n,i)=>(i%2?f.z0:f.x0)+n*.05);
 let last=-1;for(let i=0;i<p.correctionAt.length;i++){const k=p.correctionAt[i],v=p.correctionValues[i];check(k>last&&k<edge.length&&Number.isFinite(v)&&Math.abs(v-edge[k])<1e-8);edge[k]=v;last=k;}
 const seen=new Uint8Array(p.tree.length);
 function visit(start,count,axis,loX,hiX,loZ,hiZ){if(!count)return;const id=p.tree[start];check(id<p.tree.length&&!seen[id]);seen[id]=1;const x=edge[id*2],z=edge[id*2+1];check(x>=loX&&x<=hiX&&z>=loZ&&z<=hiZ);const l=count>>1;
  visit(start+1,l,1-axis,loX,axis?hiX:x,loZ,axis?z:hiZ);visit(start+1+l,count-l-1,1-axis,axis?loX:x,hiX,axis?z:loZ,hiZ);
 }visit(0,p.tree.length,0,-Infinity,Infinity,-Infinity,Infinity);
 const result={...p,edge};validated.add(result);return result;
}
const validated=new WeakSet();
function valid(p,n){return validated.has(p)&&p.length===n;}
function distanceAt(p,f,k){if(p.solid[k>>3]&(1<<(k&7)))return 0;
 const x=f.x0+(k%f.nx)*.05,z=f.z0+Math.floor(k/f.nx)*.05;let best=1e18;
 function visit(start,count,axis){if(!count)return;const id=p.tree[start],ex=p.edge[id*2],ez=p.edge[id*2+1],dx=ex-x,dz=ez-z;best=Math.min(best,dx*dx+dz*dz);const left=count>>1,right=count-left-1,d=axis?dz:dx;
  if(d>0){visit(start+1,left,1-axis);if(d*d<=best)visit(start+1+left,right,1-axis);}else{visit(start+1+left,right,1-axis);if(d*d<=best)visit(start+1,left,1-axis);}}
 visit(0,p.tree.length,0);return Math.fround(Math.sqrt(best));
}
function distance(p,f,lx,lz){const i=Math.round((lx-f.x0)/.05),j=Math.round((lz-f.z0)/.05);if(i>=0&&j>=0&&i<f.nx&&j<f.nz)return distanceAt(p,f,j*f.nx+i);let d=1e9;for(let k=0;k<p.edge.length;k+=2)d=Math.min(d,Math.hypot(p.edge[k]-lx,p.edge[k+1]-lz));return d;}
const api={pack,open,distanceAt,distance,valid};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TDSavedBoundary=api;
})(globalThis);

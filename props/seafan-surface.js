// A single object-local cutout. Existing stone surfaces delegate without changes.
(()=>{
 const key='seafan-net-v1',base=TDSmallPropSurface,cache=new WeakMap();let value;
 const SIZE=256;
 function get(){if(value)return value;const c=document.createElement('canvas');c.width=c.height=SIZE;const x=c.getContext('2d'),{hash2}=TDGeo;
  x.fillStyle='white';x.fillRect(0,0,SIZE/8,SIZE);const map=([a,b])=>[SIZE/8+(a+.81)/1.60*(SIZE*7/8-2)+1,(.96-b)/.84*(SIZE-2)+1],r=.018,dy=Math.sqrt(3)*r,nodes=new Map(),edges=new Map();
  const node=(a,b)=>{const k=Math.round(a*1e6)+':'+Math.round(b*1e6);if(!nodes.has(k)){const i=Math.round(a*1e4),j=Math.round(b*1e4);nodes.set(k,[a+(hash2(i+91,j+17)-.5)*r*.70,b+(hash2(i+31,j+73)-.5)*r*.70]);}return{k,p:nodes.get(k)};};
  for(let i=-34;i<=34;i++)for(let j=-2;j<=32;j++){const a=i*r*1.5,b=.12+j*dy+(Math.abs(i)%2)*dy*.5,q=[];for(let k=0;k<6;k++)q.push(node(a+r*Math.cos(k*Math.PI/3),b+r*Math.sin(k*Math.PI/3)));for(let k=0;k<6;k++){const a=q[k],b=q[(k+1)%6],id=[a.k,b.k].sort().join('|');if(!edges.has(id))edges.set(id,[a.p,b.p]);}}
  const used=new Set();for(const[a,b]of edges.values())if(hash2(Math.round(a[0]*1e4)+31,Math.round(b[1]*1e4)+79)<.1&&!used.has(a)&&!used.has(b)){const u=(a[0]+b[0])/2,v=(a[1]+b[1])/2;a[0]=b[0]=u;a[1]=b[1]=v;used.add(a);used.add(b);}
  x.save();x.beginPath();x.rect(SIZE/8,0,SIZE*7/8,SIZE);x.clip();x.strokeStyle='white';x.lineCap=x.lineJoin='round';for(const[a,b]of edges.values()){const A=map(a),B=map(b);x.lineWidth=1.05+.30*hash2(Math.round(a[0]*1e4)+7,Math.round(b[1]*1e4)+11);x.beginPath();x.moveTo(...A);x.lineTo(...B);x.stroke();}x.restore();
  const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.flipY=false;texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.anisotropy=2;
  value={texture,descriptor:{id:key,width:SIZE,height:SIZE,png:c.toDataURL('image/png').split(',')[1],colorSpace:'sRGB',filter:'trilinear',mipmaps:true,wrap:'clamp'}};return value;
 }
 function material(source){if(!cache.has(source)){const m=source.clone();m.map=get().texture;m.alphaTest=.42;m.onBeforeCompile=source.onBeforeCompile;m.customProgramCacheKey=()=>source.customProgramCacheKey()+'/'+key;cache.set(source,m);}return cache.get(source);}
 window.TDSmallPropSurface={...base,material:(source,id)=>id===key?material(source):base.material(source,id),export:id=>id===key?{...get().descriptor}:base.export(id)};
})();

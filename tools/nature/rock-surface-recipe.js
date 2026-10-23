// 既存の岩の配置寸法・脇石と鉱物テクスチャを再利用し、大塊に節理・欠け・稜線を造る。
(()=>{
 const a=TDSharedData.assets.find(a=>a.id==='rock');
 const clamp=(x,l=0,h=1)=>Math.max(l,Math.min(h,x)),smooth=x=>x*x*(3-2*x);
 const hash=(x,y,z=0)=>{const s=Math.sin(x*127.1+y*311.7+z*74.7+34.1)*43758.5453;return s-Math.floor(s);};
 function noise(x,y,z=0,period=0){const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),u=smooth(x-ix),v=smooth(y-iy),w=smooth(z-iz),at=(i,j,k)=>hash(period?(i%period+period)%period:i,period?(j%period+period)%period:j,k),mix=(a,b,t)=>a+(b-a)*t;return mix(mix(mix(at(ix,iy,iz),at(ix+1,iy,iz),u),mix(at(ix,iy+1,iz),at(ix+1,iy+1,iz),u),v),mix(mix(at(ix,iy,iz+1),at(ix+1,iy,iz+1),u),mix(at(ix,iy+1,iz+1),at(ix+1,iy+1,iz+1),u),v),w);}
 // 大塊だけを割れ面のある岩体にする。脇石・配置・接地・外接寸法は既存を使う。
 const old={positions:a.positions.slice(),normals:a.normals.slice(),uv:a.uv.slice(),triangles:a.triangles.slice()};
 const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],sub=(a,b)=>a.map((v,i)=>v-b[i]),unit=v=>{const l=Math.hypot(...v);return v.map(x=>x/l);};
 // 直方体からではなく、向き・深さの違う節理面の交差で輪郭を造る。
 const planes=[[[1,.10,.16],.94],[[-1,.12,-.08],.94],[[.12,1,-.08],.86],[[0,-1,0],.94],[[.12,-.06,1],.93],[[-.16,.06,-1],.96],
 [[.85,.65,.38],1.19],[[-.72,.79,.31],1.13],[[.24,.75,-.88],1.12],[[-.64,.42,-.78],1.20],[[.84,-.45,.42],1.25],[[-.72,-.48,.57],1.24],
 [[.57,.16,.88],1.21],[[-.88,.12,.58],1.16],[[.72,.14,-.82],1.18],[[-.73,-.17,-.77],1.23],[[.28,.94,.62],1.14]].map(([n,d])=>({n:unit(n),d:d/Math.hypot(...n)}));
 const vertices=[];
 for(let i=0;i<planes.length;i++)for(let j=i+1;j<planes.length;j++)for(let k=j+1;k<planes.length;k++){
  const A=planes[i],B=planes[j],C=planes[k],bc=cross(B.n,C.n),det=dot(A.n,bc);if(Math.abs(det)<1e-7)continue;
  const ca=cross(C.n,A.n),ab=cross(A.n,B.n),v=bc.map((x,t)=>(x*A.d+ca[t]*B.d+ab[t]*C.d)/det);
  if(planes.every(p=>dot(p.n,v)<=p.d+1e-6)&&!vertices.some(p=>Math.hypot(...sub(p,v))<1e-5))vertices.push(v);
 }
 const faces=planes.map(p=>{let ids=vertices.map((v,i)=>Math.abs(dot(p.n,v)-p.d)<1e-5?i:-1).filter(i=>i>=0);if(ids.length<3)return null;const c=[0,1,2].map(k=>ids.reduce((s,i)=>s+vertices[i][k],0)/ids.length),u=unit(sub(vertices[ids[0]],c)),v=cross(p.n,u);ids.sort((i,j)=>Math.atan2(dot(sub(vertices[i],c),v),dot(sub(vertices[i],c),u))-Math.atan2(dot(sub(vertices[j],c),v),dot(sub(vertices[j],c),u)));return{ids,n:p.n};}).filter(Boolean);
 // 各面を共有辺で細分し、斜めの節理を実際に掘り込む。端点を共有するので開口しない。
 const raw=[],emit=(p,q,r)=>raw.push(p,q,r),mix=(p,q,t)=>p.map((x,k)=>x+(q[k]-x)*t);
 for(const face of faces){const v=face.ids.map(i=>vertices[i]),c=[0,1,2].map(k=>v.reduce((s,p)=>s+p[k],0)/v.length);for(let i=0;i<v.length;i++){const p=v[i],q=v[(i+1)%v.length],pq=mix(p,q,.5),pc=mix(p,c,.5),qc=mix(q,c,.5);emit(p,pq,pc);emit(pq,q,qc);emit(pc,qc,c);emit(pq,qc,pc);}}
 const detailed=[];for(let i=0;i<raw.length;i+=3){const p=raw[i],q=raw[i+1],r=raw[i+2],pq=mix(p,q,.5),qr=mix(q,r,.5),rp=mix(r,p,.5);detailed.push(p,pq,rp,pq,q,qr,rp,qr,r,pq,qr,rp);}
 const warped=detailed.map(v=>{let[x,y,z]=v;const band=Math.max(0,1-Math.abs(y-.22*x+.11*z-.06)/.12);const side=Math.max(0,(Math.abs(z)-.35)/.6);z-=Math.sign(z)*band*.17*side;const chip=Math.max(0,1-Math.abs(x+.12)/.28)*Math.max(0,(y-.35)/.6);y-=chip*.13;const topSplit=Math.max(0,1-Math.abs(x+.34*z-.18)/.095)*Math.max(0,(y-.48)/.45);y-=topSplit*.14;const relief=Math.sin(x*5.1+y*3.7+z*2.8)*Math.sin(z*4.3-y*2.1)*.024;x+=relief*.65;z+=relief;y+=relief*.35*Math.max(0,y+.9);return[x,y,z];});
 const source=Array.from({length:240},(_,i)=>old.positions.slice(i*3,i*3+3)),lo=[0,1,2].map(k=>Math.min(...source.map(v=>v[k]))),hi=[0,1,2].map(k=>Math.max(...source.map(v=>v[k]))),wl=[0,1,2].map(k=>Math.min(...warped.map(v=>v[k]))),wh=[0,1,2].map(k=>Math.max(...warped.map(v=>v[k])));
 a.positions=[];a.normals=[];a.uv=[];a.triangles=[];a.colors=[];
 for(let t=0;t<warped.length;t+=3){const ps=warped.slice(t,t+3).map(v=>v.map((x,k)=>lo[k]+(x-wl[k])/(wh[k]-wl[k])*(hi[k]-lo[k]))),n=unit(cross(sub(ps[1],ps[0]),sub(ps[2],ps[0]))),base=a.positions.length/3,axis=n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs)));
  for(const p of ps){a.positions.push(...p);a.normals.push(...n);a.uv.push((axis===0?p[2]:p[0])*.8+.5,(axis===1?p[2]:p[1])*.8+.5);}a.triangles.push(base,base+1,base+2);
 }
 const mainCount=a.positions.length/3;
 a.positions.push(...old.positions.slice(720));a.normals.push(...old.normals.slice(720));a.uv.push(...old.uv.slice(480));a.triangles.push(...old.triangles.slice(240).map(i=>i-240+mainCount));
 a.groundOffsets=[{firstVertex:0,count:mainCount,deltaY:0},{firstVertex:mainCount,count:60,deltaY:0},{firstVertex:mainCount+60,count:60,deltaY:0}];
 a.geometryRevision='angular-jointed-rock/1';

 // 位置が同じ頂点を照合し、緩い面同士だけ法線を平均する。大きな割れ面の稜線は保つ。
 const groups=new Map(),keys=[];for(let i=0;i<a.positions.length;i+=3){const k=a.positions.slice(i,i+3).map(x=>x.toFixed(5)).join('/');keys.push(k);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(i);}
 const original=a.normals.slice();for(let i=0;i<a.normals.length;i+=3){const n=original.slice(i,i+3),sum=[0,0,0];for(const j of groups.get(keys[i/3]))if(n.reduce((s,x,k)=>s+x*original[j+k],0)>(i<mainCount*3?.985:.62))for(let k=0;k<3;k++)sum[k]+=original[j+k];const L=Math.hypot(...sum)||1;for(let k=0;k<3;k++)a.normals[i+k]=sum[k]/L;}
 const linear=x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4;
 for(let i=0;i<a.positions.length;i+=3){const[x,y,z]=a.positions.slice(i,i+3),up=a.normals[i+1],broad=noise(x*2.6+7,y*2.6,z*2.6-3),speck=noise(x*8,y*8,z*8),base=.63+(broad-.5)*.12+(speck-.5)*.025,foot=.82+.18*smooth(clamp(y/.32));let rgb=[base*1.025,base*1.012,base*.955];const lichen=smooth(clamp((broad-.62)/.24))*smooth(clamp((up-.35)/.55))*.30;rgb=rgb.map((v,k)=>(v*(1-lichen)+[.52,.56,.37][k]*lichen)*foot);for(let k=0;k<3;k++)a.colors[i+k]=linear(rgb[k]);}
 // 周期ノイズの鉱物粒、薄い層理、途切れる細い割れ目。UVを変えず、滑らかな三角形間の色も保つ。
 const size=512,c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d'),im=ctx.createImageData(size,size);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const u=x/size,v=y/size,n1=noise(u*4,v*4,0,4),n2=noise(u*16,v*16,2,16),n3=noise(u*64,v*64,4,64),fine=hash(x,y),warp=noise(u*8,v*8,1,8)-.5;
  const vein=Math.abs(Math.sin((u*3+v*2+warp*.20)*Math.PI));const split=Math.exp(-((vein/.028)**2))*smooth(clamp((n2-.30)/.32));
  const grain=(n3-.5)*.105+(fine-.5)*.07,layer=Math.sin((u+v*7+warp*.55)*Math.PI*2)*.016;
  const value=clamp(.84+(n1-.5)*.15+(n2-.5)*.09+grain+layer-split*.12,.58,.98),p=(y*size+x)*4;
  im.data[p]=Math.round(value*255);im.data[p+1]=Math.round(value*.99*255);im.data[p+2]=Math.round(value*.965*255);im.data[p+3]=255;
 }ctx.putImageData(im,0,0);
 const id='placed-rock-mineral-v3';TDSharedData.textures.push({id,width:size,height:size,png:c.toDataURL('image/png').split(',')[1],colorSpace:'sRGB',wrap:'repeat',filter:'trilinear',mipmaps:true,anisotropy:4,appearanceVersion:3});
 a.material={...a.material,texture:id};a.version=6;a.appearance='灰褐色の鉱物粒、薄い層理、細い割れ目、上向き面の控えめな地衣。大塊は割れ面・斜めの節理・欠けを持つ。脇石・配置寸法・接地は維持。';
})();

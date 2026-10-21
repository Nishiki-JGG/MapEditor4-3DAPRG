// Deterministic forest-floor recipes. Shared arrays, never per-frame CPU deformation.
(()=>{const T=THREE,V=p=>new T.Vector3(...p);
function leaf(m,base,angle,length,width,hex,ivy=false){
 const first=m.P.length/3,side=[-Math.sin(angle),Math.cos(angle)],dir=[Math.cos(angle),Math.sin(angle)],fold=.012+length*.045;
 const shape=ivy?[[0,0],[-.35,.20],[-.56,.18],[-.47,.44],[-.56,.65],[-.22,.64],[.04,1],[.29,.65],[.48,.69],[.46,.35],[.39,.16]]:[[0,0],[-.65,.28],[-.82,.56],[.05,1],[.72,.48]];
 const center=[base[0]+dir[0]*length*.48,base[1]+fold,base[2]+dir[1]*length*.48],twist=(m.R()-.5)*.035;
 const outline=shape.map(([x,t],i)=>{const j=i?(.9+m.R()*.18):1;return[base[0]+dir[0]*length*t+side[0]*width*x*j,base[1]+Math.sin(t*Math.PI)*fold+twist*x,base[2]+dir[1]*length*t+side[1]*width*x*j]});
 const uv=(x,t)=>m.uv(ivy?'ivy':'leaf',.5+x*.48,t),cols=[hex,hex,hex+0x020201];
 for(let k=0;k<outline.length;k++)m.tri(center,outline[k],outline[(k+1)%outline.length],[uv(0,.48),uv(...shape[k]),uv(...shape[(k+1)%shape.length])],cols[k%3],[0,1,0]);
 // Petioles stay attached; low ivy runners are fixed while leaf ends flex.
 for(let i=first;i<m.P.length/3;i++){const d=V(m.P.slice(i*3,i*3+3)).distanceTo(V(base));m.W[i]=ivy?Math.min(1,d/length):-1;}
}
function build(id){const spec=TDNewPlants.specs.find(s=>s.id===id),m=new TDNewPlants.MeshRecipe(id==='ivy'?81829:67119),R=m.R;
 if(id==='bramble')for(let k=0;k<4;k++){
  const a=k*2.399+(R()-.5)*.7,L=.72+R()*.35,b=[(R()-.5)*.2,0,(R()-.5)*.2],h=.42+R()*.20;
  const p=[b,[b[0]+Math.cos(a-.10)*L*.30,h*.84,b[2]+Math.sin(a-.10)*L*.30],[b[0]+Math.cos(a+.13)*L*.68,h,b[2]+Math.sin(a+.13)*L*.68],[b[0]+Math.cos(a+.31)*L,.11+R()*.08,b[2]+Math.sin(a+.31)*L]];
  m.tube(p,[.018,.016,.010,.003],3,0x89916e,'stem',true);
  for(let j=0;j<3;j++){const q=V(p[j]).lerp(V(p[j+1]),j===2?.92:.72).toArray(),an=a+(j%2?-1.05:1.02),len=.29+R()*.08,w=.13+R()*.025;
   // Three connected leaflets, broad tips rather than a rectangular fan.
   for(const [offset,f]of [[-.96,.80],[.08,1.15],[.98,.76]])leaf(m,q,an+offset,len*f,w*f,j===0?0xa6b88c:0xb4c39a);
   if(j===1)m.berry([q[0],q[1]+.04,q[2]],.043,0x654454);
  }
 }else if(id==='ivy')for(let k=0;k<3;k++){
  const a=[.16,2.18,4.49][k]+(R()-.5)*.35,L=.74+R()*.15,b=[(R()-.5)*.15,0,(R()-.5)*.15];
  const p=[b,[b[0]+Math.cos(a+.17)*L*.3,.014,b[2]+Math.sin(a+.17)*L*.3],[b[0]+Math.cos(a-.12)*L*.65,.02,b[2]+Math.sin(a-.12)*L*.65],[b[0]+Math.cos(a+.09)*L,.014,b[2]+Math.sin(a+.09)*L]];
  const first=m.P.length/3;m.tube(p,[.009,.007,.005,.002],3,0x8d9a79,'stem',true);for(let i=first;i<m.P.length/3;i++)m.W[i]=0;
  for(let j=0;j<4;j++){const t=.13+j*.24,s=Math.min(2,Math.floor(t*3)),q=V(p[s]).lerp(V(p[s+1]),t*3-s).toArray();leaf(m,q,a+(j%2?-.86:.98)+(R()-.5)*.35,.25+R()*.12,.19+R()*.04,[0x91aa7d,0xa7b78d,0x9cb385][(j+k)%3],true);}
 }
 return{spec,geo:m.geometry()};
}
function fernTexture(){const cv=document.createElement('canvas');cv.width=512;cv.height=128;const c=cv.getContext('2d'),R=TDGeo.rng(8293);c.lineCap='round';
 c.strokeStyle='#6e8952';c.lineWidth=3;c.beginPath();c.moveTo(5,64);c.quadraticCurveTo(260,61,505,64);c.stroke();
 // Connected lobed pinnae survive mip reduction better than isolated sub-pixel dots.
 for(let i=0;i<19;i++)for(const sd of [-1,1]){const t=(i+.8)/20,x=10+t*484,L=51*Math.pow(Math.sin(Math.PI*(t*.92+.04)),.8),a=sd*(1.02+(R()-.5)*.12),dx=Math.cos(a),dy=Math.sin(a),w=6.0+R()*1.8;c.save();c.translate(x,64);c.rotate(a);c.beginPath();c.moveTo(0,0);for(let j=0;j<=8;j++){const u=j/8;c.lineTo(L*u,-Math.sin(Math.PI*u)*w*(j%2?.74:1))}for(let j=8;j>=0;j--){const u=j/8;c.lineTo(L*u,Math.sin(Math.PI*u)*w*(j%2?.80:1))}c.closePath();c.fillStyle=['#738e59','#829b64','#8b9e6c'][i%3];c.fill();c.strokeStyle='rgba(178,192,137,.30)';c.lineWidth=.8;c.beginPath();c.moveTo(0,0);c.lineTo(L*.88,0);c.stroke();c.restore();}
 const image=c.getImageData(0,0,512,128);for(let i=0;i<image.data.length;i+=4)if(image.data[i+3]===0){image.data[i]=121;image.data[i+1]=146;image.data[i+2]=95}c.putImageData(image,0,0);return cv.toDataURL('image/png').split(',')[1];}
window.TDForestFloor={build,fernTexture};})();

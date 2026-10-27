// Deterministic metre-scale recipes; the existing woodland atlas supplies every material.
(()=>{
const T=THREE,M=TDNewPlants.MeshRecipe,V=p=>new T.Vector3(...p);
const specs=[
 {id:'rowan',name:'実付きの小高木',role:'頭上に余裕のある小さな広葉樹、羽状の葉と赤い実',tree:true,r:.22,vis:1.65,min:2.2,sc:[1,1.2],tags:['forest','grassland','ruins'],wind:.18,touch:.025},
 {id:'juniper',name:'地を這う針葉低木',role:'低く横に伸びる枝と密な針葉、林縁の低木',r:0,vis:1.1,min:1.5,sc:[.85,1.2],tags:['forest','mountain','canyon'],wind:.10,touch:.09},
 {id:'clover',name:'三つ葉の地被',role:'丸い三つ葉と小さな白花、低い草地の群落',r:0,vis:.55,min:.65,sc:[.9,1.3],tags:['grassland','forest','ruins'],wind:.045,touch:.03,combined:.05},
 {id:'shelfshroom',name:'重なりキノコ群',role:'横に張り出す扇形の傘、岩や倒木際の群生',r:0,vis:.65,min:.8,sc:[.9,1.3],tags:['forest','cave','graveyard'],anyGround:true},
 {id:'mossrock',name:'苔付きの小岩群',role:'低い小岩と丸い苔のクッション、岩際の地被',r:0,vis:.75,min:1,sc:[.85,1.25],tags:['forest','cave','ruins'],anyGround:true},
 {id:'mushroom',name:'きのこ',role:'大小と傾きが異なる肉厚の傘、従来IDを維持',r:0,vis:.3,min:.5,sc:[.8,1.5],tags:['forest','jungle','cave','demon','graveyard'],anyGround:true,existing:true},
];
function weights(m,start,w){for(let i=start;i<m.W.length;i++)m.W[i]=w;}
function leaflet(m,base,angle,len,width,hex=0x97ad72,heart=false,compact=false,cell='leaf'){
 const ring=compact?[[0,0],[.55,-1],[1,0],[.55,1]]:heart?[[0,0],[.25,-.8],[.65,-1],[.95,-.65],[.90,0],[.95,.65],[.65,1],[.25,.8]]:[[0,0],[.25,-.8],[.70,-1],[1,0],[.70,1],[.25,.8]],point=(x,z)=>[base[0]+Math.cos(angle)*x*len-Math.sin(angle)*z*width,base[1]+.014*Math.sin(x*Math.PI)+Math.abs(z)*.004,base[2]+Math.sin(angle)*x*len+Math.cos(angle)*z*width],center=point(.5,0);
 for(let j=0;j<ring.length;j++){const a=ring[j],b=ring[(j+1)%ring.length];m.tri(center,point(...a),point(...b),[m.uv(cell,.5,.5),m.uv(cell,(a[1]+1)/2,a[0]),m.uv(cell,(b[1]+1)/2,b[0])],hex,[0,1,0]);}
}
function mound(m,p,r,hex,n=8,fan=false,angle=0,thick=.018,cell='white',sealRear=false){
 const span=fan?Math.PI*1.16:Math.PI*2,ring=(f,y)=>Array.from({length:n+(fan?1:0)},(_,j)=>{const a=angle+(j/n-.5)*span,rr=r*f*(1+.07*Math.sin(j*2.7+p[0]*9));return[p[0]+Math.cos(a)*rr,p[1]+y+(j%2)*.004,p[2]+Math.sin(a)*rr];}),mid=ring(.58,r*.28),rim=ring(1,0),under=ring(.96,-thick),top=[p[0],p[1]+r*.42,p[2]],bottom=[p[0],p[1]-thick*.8,p[2]],count=fan?n:n;
 for(let j=0;j<count;j++){const k=fan?j+1:(j+1)%n,uv=cell==='white'?[m.uv('white'),m.uv('white'),m.uv('white')]:[m.uv(cell,.15,.15),m.uv(cell,.40,.2),m.uv(cell,.2,.42)];m.tri(top,mid[j],mid[k],uv,hex,[0,1,0]);m.tri(mid[j],rim[j],rim[k],uv,hex,[0,1,0]);m.tri(mid[j],rim[k],mid[k],uv,hex,[0,1,0]);m.tri(bottom,under[k],under[j],uv,0xc5bba0,[0,-1,0]);m.tri(rim[j],under[j],rim[k],uv,hex,[rim[j][0]-p[0],.1,rim[j][2]-p[2]]);m.tri(rim[k],under[j],under[k],uv,hex,[rim[j][0]-p[0],.1,rim[j][2]-p[2]]);}
 if(fan)for(const j of[0,n]){const uv=[m.uv('white'),m.uv('white'),m.uv('white')];if(sealRear){const theta=angle+(j/n-.5)*span,hint=j===0?[Math.sin(theta),0,-Math.cos(theta)]:[-Math.sin(theta),0,Math.cos(theta)];m.tri(top,mid[j],bottom,uv,hex,hint);m.tri(mid[j],rim[j],bottom,uv,hex,hint);m.tri(rim[j],under[j],bottom,uv,hex,hint);}else{m.tri(top,rim[j],bottom,uv,hex,[0,0,j?1:-1]);m.tri(rim[j],under[j],bottom,uv,hex,[0,0,j?1:-1]);}}
}
function stone(m,p,rx,h,rz){const n=6,ring=Array.from({length:n},(_,j)=>{const a=j/n*Math.PI*2,scale=.8+m.R()*.3;return[p[0]+Math.cos(a)*rx*scale,h*(.35+m.R()*.18),p[2]+Math.sin(a)*rz*scale];});for(let j=0;j<n;j++){const k=(j+1)%n;m.tri([p[0]+rx*.08,h,p[2]-.02],ring[j],ring[k],[m.uv('dry',.2,.3),m.uv('dry',.2,.3),m.uv('dry',.2,.3)],0xb4b8ab,[0,1,0]);m.tri([p[0],0,p[2]],ring[k],ring[j],[m.uv('dry',.2,.3),m.uv('dry',.2,.3),m.uv('dry',.2,.3)],0x969c8b,[0,-1,0]);}}
function smooth(g){const p=g.attributes.position,n=g.attributes.normal,sums=new Map(),keys=[];for(let i=0;i<p.count;i++){const key=[p.getX(i).toFixed(5),p.getY(i).toFixed(5),p.getZ(i).toFixed(5),n.getY(i)<-.1?'under':'upper'].join('/');keys.push(key);const v=sums.get(key)||new T.Vector3();v.add(new T.Vector3().fromBufferAttribute(n,i));sums.set(key,v);}for(let i=0;i<n.count;i++){const v=sums.get(keys[i]).clone().normalize();n.setXYZ(i,v.x,v.y,v.z);}return g;}
function build(id){const index=specs.findIndex(s=>s.id===id),m=new M(72911+index),R=m.R;m.tree=!!specs[index].tree;
 if(id==='rowan'){
  m.trackClearance=false;m.tube([[0,0,0],[.02,1.3,0],[.06,2.5,.02],[.03,3.75,.04]],[.13,.09,.055,.018],5,0x7d7257,'bark');
  for(let k=0;k<5;k++){const a=k*2.399+(R()-.5)*.4,y=2.30+k*.24,end=[Math.cos(a)*(.85+R()*.35),y+.38+R()*.25,Math.sin(a)*(.85+R()*.25)],from=[.04,y,.02];m.trackClearance=true;m.tube([from,V(from).lerp(V(end),.48).add(new T.Vector3(0,.05,0)).toArray(),end],[.035,.024,.008],3,0x867753,'bark');for(const fraction of [.56,1]){const p=V(from).lerp(V(end),fraction).toArray();p[1]+=(fraction<1?.025:0);const direction=a+(fraction<1?-.60:.32),tip=[p[0]+Math.cos(direction)*.58,p[1]+.12,p[2]+Math.sin(direction)*.58],begin=m.W.length;m.tube([p,tip],[.009,.003],3,0x86986c,'stem');for(let i=begin;i<m.W.length;i++){const v=V(m.P.slice(i*3,i*3+3)),axis=V(tip).sub(V(p)),t=Math.min(1,Math.max(0,v.sub(V(p)).dot(axis)/axis.lengthSq()));m.W[i]=Math.min(1,fraction+t*.2);}for(let j=0;j<3;j++){const t=.18+j*.26,q=V(p).lerp(V(tip),t).toArray();for(const side of[-1,1]){const first=m.W.length;leaflet(m,q,direction+side*(.8+j*.1),.43-j*.045,.22,0xd7dfc1,false,true,'cluster');weights(m,first,Math.min(1,fraction+t*.2));}}const first=m.W.length;leaflet(m,tip,direction,.38,.20,0xe0e5cd,false,true,'cluster');weights(m,first,Math.min(1,fraction+.2));}
   if(k%2===0)for(let j=0;j<3;j++)m.berry([end[0]+.06*Math.cos(j*2.1),end[1]-.07-j*.025,end[2]+.06*Math.sin(j*2.1)],.045,0xb95c3d);
  }
 }else if(id==='juniper'){
  for(let k=0;k<5;k++){const a=k*2.399+(R()-.5)*.5,L=.65+R()*.35,end=[Math.cos(a)*L,.13+R()*.09,Math.sin(a)*L];m.tube([[0,0,0],[end[0]*.5,.19+R()*.10,end[2]*.5],end],[.027,.019,.006],3,0x7f8061,'bark');for(let j=1;j<=2;j++){const t=j/2;m.patch([end[0]*t,.19+(1-t)*.13,end[2]*t],a+(R()-.5)*.5,.45+R()*.12,.5+R()*.18,'needle',0x8fa58a,.07);}}
 }else if(id==='clover'){
  for(let k=0;k<6;k++){const a=k*2.399,rr=k===0?0:.17+R()*.18,x=Math.cos(a)*rr,z=Math.sin(a)*rr,h=.09+R()*.07,p=[x+.02,h,z+.01];m.tube([[x,0,z],p],[.008,.004],3,0x8f9e68,'stem');for(let j=0;j<3;j++)leaflet(m,p,a+j*Math.PI*2/3,.11+R()*.018,.065,0x9bab78,true);if(k===1||k===4){m.tube([p,[p[0]+.035,h+.07,p[2]]],[.004,.002],3,0xa0ac7b,'stem');const cap=new T.IcosahedronGeometry(.029,0).attributes.position,base=[p[0]+.035,h+.075,p[2]];for(let j=0;j<cap.count;j+=3){const q=k=>[cap.getX(k)+base[0],cap.getY(k)+base[1],cap.getZ(k)+base[2]];m.tri(q(j),q(j+1),q(j+2),[m.uv('white'),m.uv('white'),m.uv('white')],0xd6d6b6);}}}
 }else if(id==='shelfshroom'){
  for(let k=0;k<4;k++){const a=k*.7-.8,p=[-.15+k*.11,.08+k*.065,(k%2)*.11-.055];m.tube([[p[0]-.06,0,p[2]],p],[.035,.025],4,0xa89d7e,'white');mound(m,p,.22+R()*.08,k%2?0xab9472:0xbba27e,7,true,a,.022,'white',true);}
 }else if(id==='mossrock'){
  stone(m,[-.18,0,.02],.27,.23,.22);stone(m,[.19,0,-.08],.20,.14,.18);
  for(let k=0;k<4;k++){const a=k*2.1,x=Math.cos(a)*(.14+R()*.17),z=Math.sin(a)*(.14+R()*.17);mound(m,[x,.012,z],.16+R()*.06,k%2?0x9daf7b:0xa9b77e,7,false,0,.012,'leaf');}
  for(let k=0;k<6;k++){const a=k*2.4;leaflet(m,[Math.cos(a)*.35,.045,Math.sin(a)*.30],a,.065,.018,0x9cae77,false,true);}
 }else if(id==='mushroom'){
  const poses=[[-.14,-.10,.18,.115],[.12,.04,.10,.085],[-.01,.16,.13,.075],[.20,-.13,.16,.10]];
  for(let k=0;k<poses.length;k++){const[x,z,h,r]=poses[k],p=[x+.015,h,z-.01];m.tube([[x,0,z],p],[.023,.018],4,0xd8c9ac,'white');mound(m,p,r,k%2?0x9c7958:0xaf674d,8,false,0,.012);if(k%2===0)for(let j=0;j<3;j++){const a=j*2.3+k,rr=r*.48,pos=[p[0]+Math.cos(a)*rr,h+r*.32+.004,p[2]+Math.sin(a)*rr];m.berry(pos,r*.09,0xd7c3a4);}}
 }
 const geometry=m.geometry();for(let i=0;i<geometry.attributes.position.count;i++)if(geometry.attributes.position.getY(i)<0)geometry.attributes.position.setY(i,0);geometry.computeVertexNormals();return{geo:smooth(geometry),crownMin:Number.isFinite(m.crownMin)?m.crownMin:null,clearanceMin:Number.isFinite(m.clearanceMin)?m.clearanceMin:null};
}
window.TDUnderstory={specs,build};
})();

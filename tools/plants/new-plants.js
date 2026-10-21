// Authoring recipes: metre units, deterministic mesh and one code-authored shared atlas.
(() => {
const T=THREE, V=(p)=>new T.Vector3(...p), colour=h=>{const c=new T.Color(h);return[c.r,c.g,c.b];};
const cells={cluster:[0,0,256,256],willow:[256,0,256,256],needle:[0,256,256,128],bark:[256,256,128,128],white:[384,256,128,128],leaf:[0,384,128,128],ivy:[128,384,128,128],stem:[256,384,128,128],dry:[384,384,128,128]};
const specs=[
 {id:'birch',name:'白樺の木',tags:['forest','grassland','mountain'],role:'細い白い幹と透ける縦長の樹冠',tree:true,r:.30,vis:2.1,min:2.6,sc:[1,1.25]},
 {id:'willow',name:'しだれ柳',tags:['forest','grassland','jungle'],role:'湿った岸辺に垂れる樹冠。枝下を確保',tree:true,r:.33,vis:3.4,min:4.5,sc:[1,1.2]},
 {id:'scotspine',name:'傘形の松',tags:['forest','mountain','canyon','beach'],role:'曲がった幹と平たい傘状の樹冠',tree:true,r:.3,vis:2.6,min:3.5,sc:[1,1.2]},
 {id:'hazel',slope:.7,name:'株立ちの低木',tags:['forest','ruins','cave'],role:'複数の細い幹が開く、林縁の低木',r:0,vis:1.1,min:1.8,sc:[.85,1.2]},
 {id:'bramble',slope:.65,name:'つる性の茂み',tags:['forest','grassland','ruins'],role:'地面を這う弓なりの枝と小さい実',r:0,vis:1.1,min:1.7,sc:[.8,1.2]},
 {id:'ivy',slope:.35,name:'地這いツタ',tags:['forest','ruins','cave','graveyard'],role:'岩裾・洞窟入口の低い広葉の覆い',r:0,vis:.9,min:1.1,sc:[.8,1.3]},
 {id:'sedge',slope:.5,name:'扇状のスゲ',tags:['grassland','forest','beach'],role:'岸辺に開く長い弧状の葉と種穂',r:0,vis:.9,min:1.2,sc:[.85,1.2]},
 {id:'foxglove',slope:.7,name:'鈴花の花穂',tags:['forest','grassland','ruins'],role:'低い花と異なる、立ち上がる筒状の花穂',r:0,vis:.7,min:.9,sc:[.85,1.2]},
 {id:'horsetail',slope:.55,name:'節のあるトクサ',tags:['forest','jungle','cave'],role:'湿った入口・岸辺の節茎と水平の輪生葉',r:0,vis:.7,min:1,sc:[.8,1.25]},
 {id:'dock',slope:.5,name:'広葉のロゼット',tags:['grassland','forest','ruins'],role:'地面に広がる波打つ大きな葉と細い種穂',r:0,vis:.8,min:1.1,sc:[.8,1.3]},
];
class MeshRecipe {
 constructor(seed){this.P=[];this.N=[];this.C=[];this.U=[];this.W=[];this.L=[];this.R=TDGeo.rng(seed);this.crownMin=Infinity;this.clearanceMin=Infinity;this.trackClearance=false;}
 uv(name,u=.5,v=.5){const r=cells[name];u=Math.min(1,Math.max(0,u));v=Math.min(1,Math.max(0,v));return[(r[0]+4+u*(r[2]-8))/512,(r[1]+4+(1-v)*(r[3]-8))/512];}
 tri(a,b,c,uv,hex,hint){let n=V(b).sub(V(a)).cross(V(c).sub(V(a)));if(n.length()<1e-9)return;if(hint&&n.dot(V(hint))<0){[b,c]=[c,b];[uv[1],uv[2]]=[uv[2],uv[1]];n.negate();}n.normalize();if(this.trackClearance)this.clearanceMin=Math.min(this.clearanceMin,a[1],b[1],c[1]);const col=colour(hex);for(const [p,t]of [[a,uv[0]],[b,uv[1]],[c,uv[2]]]){this.L.push(-1);this.W.push(this.tree?(this.trackClearance?1:0):-1);this.P.push(...p);this.N.push(n.x,n.y,n.z);const ao=.75+.25*Math.min(1,Math.max(0,p[1])/.7);this.C.push(...col.map(x=>x*ao));this.U.push(...t);}}
 tube(points,radii,sides,hex,cell='bark',open=false){
  const firstVertex=this.P.length/3;const rings=[];for(let j=0;j<points.length;j++){const axis=V(points[Math.min(points.length-1,j+1)]).sub(V(points[Math.max(0,j-1)])).normalize();const u=new T.Vector3().crossVectors(axis,Math.abs(axis.z)<.9?new T.Vector3(0,0,1):new T.Vector3(0,1,0)).normalize(),v=new T.Vector3().crossVectors(axis,u);rings.push(Array.from({length:sides},(_,k)=>V(points[j]).addScaledVector(u,Math.cos(k/sides*Math.PI*2)*radii[j]).addScaledVector(v,Math.sin(k/sides*Math.PI*2)*radii[j]).toArray()));}
  for(let j=0;j<points.length-1;j++)for(let k=0;k<sides;k++){const next=(k+1)%sides,mid=V(rings[j][k]).sub(V(points[j])).toArray(),uv=(u,v)=>this.uv(cell,u,v);this.tri(rings[j][k],rings[j+1][k],rings[j][next],[uv(k/sides,0),uv(k/sides,1),uv((k+1)/sides,0)],hex,mid);this.tri(rings[j][next],rings[j+1][k],rings[j+1][next],[uv((k+1)/sides,0),uv(k/sides,1),uv((k+1)/sides,1)],hex,mid);}
  if(!open)for(const j of [0,points.length-1])for(let k=0;k<sides;k++){const n=j===0?V(points[0]).sub(V(points[1])):V(points[j]).sub(V(points[j-1]));this.tri(points[j],rings[j][k],rings[j][(k+1)%sides],[this.uv('white'),this.uv('white'),this.uv('white')],hex,n.toArray());}
  if(this.tree&&this.trackClearance){const from=V(points[0]),axis=V(points[points.length-1]).sub(from),den=axis.lengthSq();for(let i=firstVertex;i<this.P.length/3;i++){const t=V(this.P.slice(i*3,i*3+3)).sub(from).dot(axis)/den;this.W[i]=t<.001?0:t>.999?1:Math.max(0,Math.min(1,t));}}
 }
 patch(center,angle,w,l,cell,hex=0xffffff,drop=0){
  const rows=[];for(let j=0;j<3;j++){const t=j/2,extent=.76+.24*Math.sin(t*Math.PI);rows.push(Array.from({length:3},(_,k)=>{const x=(k/2-.5)*w*extent,z=(t-.5)*l;return[center[0]+Math.cos(angle)*x-Math.sin(angle)*z,center[1]+.12*Math.sin(t*Math.PI)-drop*t,center[2]+Math.sin(angle)*x+Math.cos(angle)*z];}));}
  for(let j=0;j<2;j++)for(let k=0;k<2;k++){const uv=(x,y)=>this.uv(cell,x/2,y/2);this.tri(rows[j][k],rows[j+1][k],rows[j][k+1],[uv(k,j),uv(k,j+1),uv(k+1,j)],hex,[0,1,0]);this.tri(rows[j][k+1],rows[j+1][k],rows[j+1][k+1],[uv(k+1,j),uv(k,j+1),uv(k+1,j+1)],hex,[0,1,0]);}
  for(const row of rows)for(const p of row)this.crownMin=Math.min(this.crownMin,p[1]);
 }
 blade(base,angle,len,width,height,hex=0xa4ba80,cell='leaf',wavy=false){
  const firstVertex=this.P.length/3,bend=(this.R()-.5)*len*.7,twist=(this.R()-.5)*.7,lean=.85+this.R()*.3;
  const rows=[];for(const t of [0,.34,.72,1]){const w=t===1?0:width*Math.sin(.08+t*Math.PI*.92)*(wavy?1+.15*Math.sin(t*19):1);rows.push([-1,0,1].map(s=>{const d=len*t,lateral=bend*Math.sin(t*Math.PI*.85)+s*w,x=Math.cos(angle)*d-Math.sin(angle)*lateral,z=Math.sin(angle)*d+Math.cos(angle)*lateral;return[base[0]+x,base[1]+height*Math.sin(t*Math.PI*.7)*lean+(s===0?w*.2:s*w*twist*t),base[2]+z];}));}
  for(let j=0;j<3;j++)for(let k=0;k<2;k++){const uv=(x,y)=>this.uv(cell,x/2,[0,.34,.72,1][y]);this.tri(rows[j][k],rows[j+1][k],rows[j][k+1],[uv(k,j),uv(k,j+1),uv(k+1,j)],hex,[0,1,0]);if(j<2)this.tri(rows[j][k+1],rows[j+1][k],rows[j+1][k+1],[uv(k+1,j),uv(k,j+1),uv(k+1,j+1)],hex,[0,1,0]);}
  for(let i=firstVertex;i<this.P.length/3;i++){const t=((this.P[i*3]-base[0])*Math.cos(angle)+(this.P[i*3+2]-base[2])*Math.sin(angle))/len;this.L[i]=Math.min(1,Math.max(0,t));}
 }
 ivyLeaf(p,angle,size){const firstVertex=this.P.length/3;const outline=[[0,-.6],[-.38,-.2],[-.62,-.36],[-.48,.06],[-.55,.4],[-.14,.32],[0,.65],[.15,.32],[.52,.4],[.48,.05],[.62,-.36],[.37,-.2]],sx=.8+this.R()*.3,tilt=(this.R()-.5)*.08;
  const center=[p[0]-Math.sin(angle)*size*.6,p[1]+.025,p[2]+Math.cos(angle)*size*.6];const points=outline.map(([x,z],k)=>{const jitter=k===0?1:.9+this.R()*.18;return[center[0]+(Math.cos(angle)*x*sx-Math.sin(angle)*z)*size*jitter,p[1]+tilt*x,center[2]+(Math.sin(angle)*x*sx+Math.cos(angle)*z)*size*jitter];});for(let k=0;k<points.length;k++)this.tri(center,points[k],points[(k+1)%points.length],[this.uv('ivy'),this.uv('ivy',outline[k][0]+.5,outline[k][1]+.5),this.uv('ivy',outline[(k+1)%points.length][0]+.5,outline[(k+1)%points.length][1]+.5)],0x9cb58a,[0,1,0]);for(let i=firstVertex;i<this.P.length/3;i++)this.W[i]=Math.min(1,V(this.P.slice(i*3,i*3+3)).distanceTo(V(p))/(size*1.25));}
 berry(p,r,hex){const g=new T.OctahedronGeometry(r,0),a=g.attributes.position;for(let i=0;i<a.count;i+=3)this.tri([a.getX(i)+p[0],a.getY(i)+p[1],a.getZ(i)+p[2]],[a.getX(i+1)+p[0],a.getY(i+1)+p[1],a.getZ(i+1)+p[2]],[a.getX(i+2)+p[0],a.getY(i+2)+p[1],a.getZ(i+2)+p[2]],[this.uv('white'),this.uv('white'),this.uv('white')],hex);}
 geometry(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(this.P,3));g.setAttribute('normal',new T.Float32BufferAttribute(this.N,3));g.setAttribute('color',new T.Float32BufferAttribute(this.C,3));g.setAttribute('uv',new T.Float32BufferAttribute(this.U,2));g.setAttribute('motionMask',new T.Float32BufferAttribute(this.W,1));g.setAttribute('bladeProgress',new T.Float32BufferAttribute(this.L,1));return g;}
}
function build(id){const index=specs.findIndex(s=>s.id===id),m=new MeshRecipe(8137+index),R=m.R;m.tree=!!specs[index].tree;
 if(id==='birch'){
  for(let stem=0;stem<2;stem++){m.trackClearance=false;const x=stem*.28-.14,h=stem?5.9:6.8;const pts=Array.from({length:7},(_,k)=>[x+k*.025,k*h/6,stem*.1+k*.018]);m.tube(pts,pts.map((_,k)=>(.15-stem*.04)*(1-k/7.2)),5,0xd5d3bd,'white');
   for(let j=0;j<7;j++){const y=.4+j*.45,a=j*2.4+stem,x0=x+Math.cos(a)*(.15-stem*.04)+y*.025;const dx=Math.cos(a)*.09,dz=Math.sin(a)*.09;const p=[x0,y,stem*.1+Math.sin(a)*(.15-stem*.04)];m.tri([p[0]-dz,p[1]-.015,p[2]+dx],[p[0]+dz,p[1]-.015,p[2]-dx],[p[0],p[1]+.035,p[2]],[m.uv('white'),m.uv('white'),m.uv('white')],0x4b5047);}
   m.trackClearance=true;for(let j=0;j<5;j++){const a=j*2.399+stem,by=2.6+j*.65,r=.8+R()*.5;const tip=[x+Math.cos(a)*r,by+1.1,Math.sin(a)*r];m.tube([[x,by,stem*.1],tip],[.055,.014],4,0xc4c3ab,'white');m.patch([tip[0],tip[1]+.15,tip[2]],a,.95,1.3,'cluster');m.patch([tip[0]*.7,tip[1]+.55,tip[2]*.7],a+.8,.85,1.1,'cluster');}
  }
 }else if(id==='willow'){
  m.tube([[0,0,0],[.03,1.2,0],[.06,2.5,.03],[.12,3.8,.05],[.25,5.9,.08]],[.27,.23,.2,.14,.025],6,0xc0b195);
  m.trackClearance=true;for(let k=0;k<9;k++){const a=k*2.399,r=1.4+R()*.8,tip=[Math.cos(a)*r,5.2+R()*.6,Math.sin(a)*r];m.tube([[.1,3.1+k%2*.4,.05],tip],[.11,.025],4,0xb5a48b);m.patch(tip,a-Math.PI/2,1.4,2.3,'willow',0xe1e8bf,2.7);m.patch([tip[0]*.6,tip[1]+.3,tip[2]*.6],a,1.6,1.6,'cluster',0xd4dfb7,.7);}
 }else if(id==='scotspine'){
  m.tube([[0,0,0],[.02,1.2,0],[.12,2.4,.04],[.5,3.6,.08],[.92,4.8,.12]],[.25,.22,.18,.12,.04],6,0xb7a18c);
  m.trackClearance=true;for(let k=0;k<8;k++){const a=k*2.399,r=1.45+R()*.8,tip=[.45+Math.cos(a)*r,4.65+R()*.5,Math.sin(a)*r];m.tube([[.2,2.7+k%3*.45,0],tip],[.1,.025],4,0xa7917e);for(let j=0;j<2;j++)m.patch([tip[0]+Math.cos(a+j)*.35,tip[1]+j*.18,tip[2]+Math.sin(a+j)*.35],a+j*.7,1.5,1.15,'needle',0xc6d2bd);}
  for(let k=0;k<10;k++){const a=k*2.399,r=.4+R()*.9;m.patch([.55+Math.cos(a)*r,5.0+R()*.3,Math.sin(a)*r],a,1.9,1.45,'needle',0xc6d2bd);}
 }else if(id==='hazel'){
  for(let k=0;k<6;k++){const a=[0,.55,1.3,2.8,4.1,4.7][k],r=.65+R()*.4,h=1.4+R()*.5,tip=[Math.cos(a)*r,h,Math.sin(a)*r];m.tube([[Math.cos(a)*.14,0,Math.sin(a)*.14],[tip[0]*.5,h*.7,tip[2]*.5],tip],[.045,.025,.01],4,0xb3a189);m.patch(tip,a,.8,.85,'cluster',0xcddcae,.2);if(k%2===0)m.patch([tip[0]*.7,h*.65,tip[2]*.7],a+.7,.65,.7,'cluster',0xbccfa0,.15);}
 }else if(id==='bramble'){
  for(let k=0;k<5;k++){const a=k*2.399+(R()-.5)*.6,L=.78+R()*.45,b=[(R()-.5)*.22,0,(R()-.5)*.22],pts=[b,[b[0]+Math.cos(a)*L*.48,.45+R()*.28,b[2]+Math.sin(a)*L*.48],[b[0]+Math.cos(a+.2)*L,.12+R()*.1,b[2]+Math.sin(a+.2)*L]];m.tube(pts,[.022,.018,.008],3,0x8c9873,'stem');for(let j=1;j<=3;j++){const t=j/4,segment=t<.5?0:1,u=segment===0?t*2:(t-.5)*2,p=V(pts[segment]).lerp(V(pts[segment+1]),u).toArray();m.blade(p,a+(j%2?.85:-1.15),.23+R()*.16,.085+R()*.03,.09,0xa7b88a);if(j===2){m.berry([p[0],p[1]+.05,p[2]],.045,0x7c3652);m.berry([p[0]+.07,p[1]+.04,p[2]+.02],.036,0x44384c);}}}
 }else if(id==='ivy'){
  for(let k=0;k<3;k++){const a=k*2.3+(R()-.5)*.8,L=.65+R()*.24,b=[(R()-.5)*.18,0,(R()-.5)*.18],pts=[b,[b[0]+Math.cos(a+.2)*L*.5,.025,b[2]+Math.sin(a+.2)*L*.5],[b[0]+Math.cos(a-.15)*L,.025,b[2]+Math.sin(a-.15)*L]];m.tube(pts,[.012,.009,.005],3,0x82946c,'stem');for(let j=0;j<4;j++){const t=.14+j*.24,segment=t<.5?0:1,u=segment===0?t*2:(t-.5)*2,p=V(pts[segment]).lerp(V(pts[segment+1]),u).toArray();m.ivyLeaf(p,a-Math.PI/2+(j%2?.8:-1.0)+(R()-.5)*.45,.23+R()*.14);}}
 }else if(id==='sedge'){
  for(let c=0;c<3;c++){const a=[.2,2.6,4.5][c]+(R()-.5)*.5,b=[Math.cos(a)*(.10+R()*.08),0,Math.sin(a)*(.10+R()*.08)];for(let j=0;j<5;j++)m.blade(b,a+(j-2)*.48+(R()-.5)*.4,.38+R()*.55,.025+R()*.022,.38+R()*.48,0xafbb86,'leaf');}
  for(let j=0;j<3;j++){const a=j*2.7,p=[Math.cos(a)*.3,.85+R()*.15,Math.sin(a)*.3];m.tube([[0,0,0],p],[.008,.004],3,0x8a9d68,'stem');m.berry([p[0],p[1]-.03,p[2]],.045,0x8b724b);}
 }else if(id==='foxglove'){
  m.tube([[0,0,0],[.02,.6,0],[.08,1.2,.03],[.14,1.65,.07]],[.02,.016,.009,.003],4,0x7c9c64,'stem');for(let j=0;j<5;j++)m.blade([0,.01,0],j*2.399,.37+R()*.1,.085,.16,0xa0b988);
  for(let j=0;j<7;j++){const y=.65+j*.125,a=j*.9,tip=[.08+Math.cos(a)*.22,y,Math.sin(a)*.22];m.tube([[.06,y+.08,.03],[tip[0]*.7,y+.06,tip[2]*.7],tip],[.023,.05,.065],5,j%3?0xba7c9e:0xd2a5bd,'white',true);}
 }else if(id==='horsetail'){
  for(let s=0;s<5;s++){const a=s*2.399,r=.12+R()*.23,x=Math.cos(a)*r,z=Math.sin(a)*r,h=.62+R()*.35;const pts=[[x,0,z],[x+.015,h*.34,z],[x+.025,h*.67,z+.01],[x+.04,h,z+.02]];m.tube(pts,[.022,.019,.015,.006],4,0x8cae74,'stem');for(const t of [.34,.67])for(let j=0;j<5;j++){const an=j/5*Math.PI*2+s*.6,p0=[x,h*t,z],tip=[x+Math.cos(an)*.24,h*t+.04,z+Math.sin(an)*.24],side=[-Math.sin(an)*.025,0,Math.cos(an)*.025];const mid=[x+Math.cos(an)*.14,h*t+.035,z+Math.sin(an)*.14],left=[mid[0]+side[0]*.6,mid[1],mid[2]+side[2]*.6],right=[mid[0]-side[0]*.6,mid[1],mid[2]-side[2]*.6];m.tri(p0,left,tip,[m.uv('leaf',.5,0),m.uv('leaf',0,.6),m.uv('leaf',.5,1)],0x99b77f,[0,1,0]);m.tri(p0,tip,right,[m.uv('leaf',.5,0),m.uv('leaf',.5,1),m.uv('leaf',1,.6)],0x99b77f,[0,1,0]);}}
 }else if(id==='dock'){
  for(let j=0;j<9;j++)m.blade([(R()-.5)*.08,0,(R()-.5)*.08],j*2.399,.48+R()*.18,.10+R()*.035,.20+R()*.12,0xa8bb85,'leaf',true);
  for(let k=0;k<2;k++){const x=k*.13-.06,z=k*.08;const h=.8+k*.16;m.tube([[x,0,z],[x+.06,h,z+.04]],[.012,.004],3,0x929463,'stem');for(let j=0;j<5;j++)m.berry([x+.06,h-.12-j*.045,z+.04],.026+(4-j)*.003,0x8b7857);}
 }
 return{spec:specs[index],geo:m.geometry(),crownMin:Number.isFinite(m.crownMin)?m.crownMin:null,clearanceMin:Number.isFinite(m.clearanceMin)?m.clearanceMin:null};
}
function paint(){const cv=document.createElement('canvas');cv.width=cv.height=512;const c=cv.getContext('2d'),old=document.createElement('canvas');old.width=old.height=1024;old.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(TDGeo.ATLAS.paint()),1024,1024),0,0);c.drawImage(old,0,0,512,512,0,0,256,256);c.drawImage(old,512,0,512,512,0,256,256,128);c.drawImage(old,0,768,256,256,256,256,128,128);c.fillStyle='#fff';c.fillRect(384,256,128,128);
 const R=TDGeo.rng(9741);c.save();c.beginPath();c.rect(256,0,256,256);c.clip();c.strokeStyle='#7b8c5c';c.lineWidth=2.2;c.beginPath();c.moveTo(384,4);c.bezierCurveTo(382,65,388,140,384,229);c.stroke();for(let twig=0;twig<7;twig++){const endX=310+R()*150,endY=70+R()*130;c.strokeStyle='#7b8c5c';c.lineWidth=1.2;c.beginPath();c.moveTo(384,35);c.quadraticCurveTo(endX,80,endX,endY);c.stroke();}
 for(let leaf=0;leaf<620;leaf++){const theta=R()*Math.PI*2,r=Math.sqrt(R()),x=384+Math.cos(theta)*r*94,y=118+Math.sin(theta)*r*103,len=8+R()*12,w=2.7+R()*2.0;c.save();c.translate(x,y);c.rotate((R()-.5)*2.1);c.fillStyle=['#879b61','#91a769','#a4b67b','#798e57'][Math.floor(R()*4)];c.beginPath();c.moveTo(0,0);c.quadraticCurveTo(-w,len*.45,0,len);c.quadraticCurveTo(w,len*.45,0,0);c.fill();c.restore();}c.restore();
 for(let k=0;k<4;k++){const x=k*128;c.fillStyle=['#c3c9b1','#bac7ae','#c0c7ae','#c5c0a4'][k];c.fillRect(x,384,128,128);for(let n=0;n<700;n++){c.fillStyle=R()>.5?'rgba(237,240,210,.15)':'rgba(35,56,24,.13)';c.fillRect(x+R()*128,384+R()*128,1+R()*2,1+R()*5);}c.strokeStyle='rgba(98,125,76,.35)';c.lineWidth=2;c.beginPath();c.moveTo(x+64,512);c.lineTo(x+64,384);c.stroke();for(let j=0;j<10;j++){const y=390+j*12;c.lineWidth=.7;c.beginPath();c.moveTo(x+64,y);c.lineTo(x+10,y-18);c.moveTo(x+64,y);c.lineTo(x+118,y-18);c.stroke();}}
 // RGB bleed in transparent pixels prevents dark filtering fringes; alpha stays unchanged.
 const img=c.getImageData(0,0,512,512);for(let i=0;i<img.data.length;i+=4)if(img.data[i+3]<8){img.data[i]=118;img.data[i+1]=139;img.data[i+2]=88;}c.putImageData(img,0,0);return cv.toDataURL('image/png').split(',')[1];}
window.TDNewPlants={specs,build,paint};
})();

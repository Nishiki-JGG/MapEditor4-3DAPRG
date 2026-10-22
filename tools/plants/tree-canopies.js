// Metres, deterministic branching and overhead foliage. No per-frame mesh editing.
(()=>{
const T=THREE,M=TDNewPlants.MeshRecipe,V=p=>new T.Vector3(...p),rgb=h=>new T.Color(h).toArray();
const specs=[
 {id:'maple',name:'紅葉のモミジ',kind:'layered',h:4.8,r:2.5,rx:2.7,rz:2.2,n:7,clumps:3,low:0x873c27,high:0xd97631},
 {id:'cherry',name:'桜',kind:'blossom',h:5.3,r:2.8,n:7,clumps:3,low:0xc78ca9,high:0xf8d5df,cell:'blossom'},
 {id:'zelkova',name:'ケヤキ',kind:'fan',h:7.2,r:3.25,rx:3.5,rz:2.25,n:8,clumps:3,low:0x5c793d,high:0xa2bb76},
 {id:'nara',name:'ナラ',kind:'heavy',h:6.5,r:3.0,n:8,clumps:3,low:0x4e6e3c,high:0x9ab46d},
 {id:'sugi',name:'スギ',kind:'spire',h:8.2,r:1.65,n:14,clumps:3,low:0x365e4d,high:0x82a484,cell:'needle'},
 {id:'hinoki',name:'ヒノキ',kind:'sprays',h:7.3,r:2.05,n:12,clumps:3,low:0x3e6550,high:0x95b18a,cell:'needle'},
 {id:'islandash',name:'シマトネリコ',kind:'multistem',h:5.4,r:2.2,rx:2.25,rz:1.9,n:6,clumps:3,low:0x627f52,high:0xb8c7a0,cell:'fine'},
 {id:'olive',name:'オリーブ',kind:'olive',h:4.6,r:2.35,rx:2.65,rz:2.0,n:7,clumps:3,low:0x76816b,high:0xc1c9ac,cell:'fine'},
 {id:'eucalyptus',name:'ユーカリ',kind:'eucalypt',h:8.4,r:2.3,rx:2.0,rz:2.8,n:7,clumps:3,low:0x638b86,high:0xb9d5cd,cell:'fine'},
 {id:'dragontree',name:'龍血樹',kind:'dragon',h:5.8,r:3.0,n:6,low:0x4e7759,high:0x9fba83},
 {id:'elftree',name:'エルフの森の木',kind:'elf',h:10.5,r:4.6,rx:4.5,rz:3.9,n:10,clumps:3,low:0x4a7b6c,high:0xb5ddba},
 {id:'worldtree',name:'世界樹',kind:'world',h:24,r:10.5,rx:11.5,rz:9.0,n:14,clumps:4,low:0x3b6f58,high:0xb4d1a0},
 {id:'oak',name:'広葉樹',kind:'heavy',h:5.53,r:2.1,n:6,clumps:3,low:0x607744,high:0xb3c888,legacy:true},
 {id:'pine',name:'針葉樹',kind:'pine',h:6.408,r:1.5,n:10,clumps:3,low:0x466c56,high:0x9ab78d,cell:'needle',legacy:true},
 {id:'palm',name:'ヤシ',kind:'palm',h:4.77,r:2.3,n:11,low:0x668c4b,high:0xb8cf88,legacy:true},
 {id:'banana',name:'バナナの木',kind:'banana',h:2.97,r:1.9,n:7,low:0x668c4d,high:0xb5d492,legacy:true},
 {id:'deadtree',name:'枯れ木',kind:'dead',h:3.44,r:1.1,n:5,low:0x8f8978,high:0xb9b39f,legacy:true},
 {id:'twisttree',name:'異形の木',kind:'twist',h:4.06,r:1.3,n:6,low:0x62566d,high:0x9b89a3,legacy:true},
 {id:'birch',name:'白樺の木',kind:'birch',h:6.973,r:2.1,n:7,clumps:2,low:0x66864f,high:0xbdce94,legacy:true},
 {id:'willow',name:'しだれ柳',kind:'willow',h:6.082,r:3.4,n:7,clumps:3,low:0x657c47,high:0xb2c283,cell:'fine',legacy:true},
 {id:'scotspine',name:'傘形の松',kind:'umbrella',h:5.408,r:2.6,n:7,clumps:3,low:0x4b725b,high:0x9bb68d,cell:'needle',legacy:true},
 {id:'rowan',name:'実付きの小高木',kind:'rowan',h:3.843,r:1.65,n:5,clumps:3,low:0x73874f,high:0xb8c68b,cell:'fine',legacy:true},
 {id:'hazel',name:'株立ちの低木',kind:'shrub',h:1.9,r:1.1,n:4,clumps:2,low:0x5e7948,high:0xacc18c,legacy:true,shrub:true},
 {id:'juniper',name:'地を這う針葉低木',kind:'creeping',h:.34,r:1.1,n:5,clumps:2,low:0x53735c,high:0x98ad8b,cell:'needle',legacy:true,shrub:true}
];
const cells={broad:[0,0,256,256],fine:[256,0,256,256],needle:[512,0,256,128],dragon:[512,384,256,128],bark:[768,0,128,256],white:[896,0,128,256],palm:[0,256,512,128],banana:[512,256,512,128],leaf:[0,384,256,128],blossom:[256,384,256,128]};
function build(id,legacy){const spec=specs.find(s=>s.id===id),index=specs.indexOf(spec),m=new M(47191+index*173),R=m.R,H=spec.legacy?legacy[id].bounds[1][1]:spec.h,r=spec.r,parts=[],branches=[],clumps=[];m.tree=true;const G=[];let glow=0;
 const original=m.tri.bind(m);m.tri=(...a)=>{const first=m.P.length/3;original(...a);for(let i=first;i<m.P.length/3;i++)G[i]=glow;};
 m.uv=(cell,u=.5,v=.5)=>{const box=cells[cell]||cells.broad;if(spec.kind==='dragon'&&cell==='bark')u=.24+u*.38;return[(box[0]+3+Math.min(1,Math.max(0,u))*(box[2]-6))/1024,(box[1]+3+Math.min(1,Math.max(0,v))*(box[3]-6))/512];};
 const dragonSurface=(x,z)=>H*(.99-.115*Math.min(1,Math.hypot(x,z)/(r+.1))**2);
 const white=()=>m.uv('white'),mark=(role,first)=>parts.push({role,first,count:m.P.length/3-first});
 function tube(points,radii,sides,hex,from=0,to=0,role='branch',cell='bark'){
  const first=m.P.length/3,dist=[0];for(let j=1;j<points.length;j++)dist.push(dist[j-1]+V(points[j]).distanceTo(V(points[j-1])));m.tube(points,radii,sides,hex,cell,role==='branch'&&!['dead','twist'].includes(spec.kind));const start=m.uv(cell,0,0)[1],span=m.uv(cell,0,1)[1]-start,total=dist[dist.length-1];
  for(let i=first;i<m.P.length/3;i++){const local=i-first,segments=points.length-1;let t;if(local<segments*sides*6){const seg=Math.floor(local/(sides*6)),end=(m.U[i*2+1]-start)/span;t=(dist[seg]+end*(dist[seg+1]-dist[seg]))/total;m.U[i*2+1]=m.uv(cell,0,t)[1];}else t=local<segments*sides*6+sides*3?0:1;m.W[i]=from+(to-from)*Math.max(0,Math.min(1,t));}if(spec.kind==='dragon'){const capStart=first+(points.length-1)*sides*6;for(let i=first;i<Math.min(capStart,m.P.length/3);i++){const p=V(m.P.slice(i*3,i*3+3));let best=null,d=Infinity;for(let j=1;j<points.length;j++){const a=V(points[j-1]),v=V(points[j]).sub(a),t=Math.max(0,Math.min(1,p.clone().sub(a).dot(v)/v.lengthSq())),q=a.addScaledVector(v,t),n=p.clone().sub(q),dist=n.lengthSq();if(dist<d){d=dist;best=n}}if(best&&best.lengthSq()>1e-10)m.N.splice(i*3,3,...best.normalize().toArray());}}
  mark(role,first);if(role==='branch')branches.push({points,from,to});
 }
 function cluster(p,rx,rz,rise,w,cell=spec.cell||'broad',twist=0){const first=m.P.length/3,n=7,ring=Array.from({length:n},(_,j)=>{const a=j/n*Math.PI*2,rr=.86+R()*.20,x=Math.cos(a)*rx*rr,z=Math.sin(a)*rz*rr;return[p[0]+Math.cos(twist)*x-Math.sin(twist)*z,p[1]+(R()-.5)*rise*.13,p[2]+Math.sin(twist)*x+Math.cos(twist)*z];}),top=[p[0]+rx*.07,p[1]+rise,p[2]-rz*.04],uv=(j)=>m.uv(cell,.5+Math.cos(j/n*Math.PI*2)*.46,.5+Math.sin(j/n*Math.PI*2)*.46);
  if(spec.kind==='dragon'){for(const p of ring)p[1]=dragonSurface(p[0],p[2]);top[1]=dragonSurface(top[0],top[2]);}
  for(let j=0;j<n;j++)m.tri(top,ring[j],ring[(j+1)%n],[m.uv(cell,.5,.48),uv(j),uv((j+1)%n)],0xffffff,[0,1,0]);
  const low=rgb(spec.low),high=rgb(spec.high),periphery=Math.min(1,Math.hypot(p[0],p[2])/(r*.9)),ao=spec.kind==='dragon'?.91+.04*periphery:.78+.16*periphery,shade=spec.kind==='dragon'?.985+R()*.025:.96+R()*.07;
  for(let i=first;i<m.P.length/3;i++){const x=m.P[i*3],y=m.P[i*3+1],z=m.P[i*3+2],t=Math.min(1,Math.max(0,(y/(H||1)-.30)/.7)),colour=low.map((v,k)=>(v+(high[k]-v)*t)*ao*shade);m.C.splice(i*3,3,...colour);const normal=(spec.kind==='dragon'?new T.Vector3(x*.035,.98,z*.035):new T.Vector3((x-p[0])/Math.max(.05,rx)*.48,.85+(y-p[1])/Math.max(.05,rise)*.35,(z-p[2])/Math.max(.05,rz)*.48)).normalize();m.N.splice(i*3,3,...normal.toArray());m.W[i]=w;}
  mark('foliage',first);clumps.push({first,count:m.P.length/3-first,weight:w,center:p});
 }
 function frond(base,a,L,width,rise,drop,w,cell,steps=3){const first=m.P.length/3,rows=[];for(let j=0;j<=steps;j++){const t=j/steps,extent=j===steps?0:width*(.13+.87*Math.sin(Math.PI*t));rows.push([-1,0,1].map(side=>[base[0]+Math.cos(a)*L*t-Math.sin(a)*side*extent,base[1]+rise*Math.sin(t*Math.PI)-drop*t+(side===0?extent*.12:0),base[2]+Math.sin(a)*L*t+Math.cos(a)*side*extent]));}for(let j=0;j<steps;j++)for(let k=0;k<2;k++){const uv=(x,y)=>m.uv(cell,y/steps,x/2);m.tri(rows[j][k],rows[j+1][k],rows[j][k+1],[uv(k,j),uv(k,j+1),uv(k+1,j)],0xffffff,[0,1,0]);if(j<steps-1)m.tri(rows[j][k+1],rows[j+1][k],rows[j+1][k+1],[uv(k+1,j),uv(k,j+1),uv(k+1,j+1)],0xffffff,[0,1,0]);}
  const low=rgb(spec.low),high=rgb(spec.high);for(let i=first;i<m.P.length/3;i++){const q=V(m.P.slice(i*3,i*3+3)).sub(V(base)),t=Math.max(0,Math.min(1,(q.x*Math.cos(a)+q.z*Math.sin(a))/L)),colour=low.map((v,k)=>v+(high[k]-v)*(.3+.6*(1-t)));m.C.splice(i*3,3,...colour);m.W[i]=['palm','banana'].includes(spec.kind)?w*t*t*(3-2*t):w;const normal=new T.Vector3(-Math.sin(a)*q.z*.08,.94,Math.cos(a)*q.x*.08).normalize();m.N.splice(i*3,3,...normal.toArray());}mark('foliage',first);clumps.push({first,count:m.P.length/3-first,weight:w,frond:true});
 }
 function fruit(p,size,hex,w=1,emission=0){const first=m.P.length/3;glow=emission;m.berry(p,size,hex);glow=0;for(let i=first;i<m.P.length/3;i++)m.W[i]=w;mark('detail',first);}
 const isWorld=spec.kind==='world',isElf=spec.kind==='elf',small=spec.shrub,clear=small?.025:(isWorld?3.6:2.4),trunkRadius=isWorld?1.4:isElf?.35:spec.kind==='dragon'?.28:spec.kind==='heavy'?.30:spec.kind==='olive'?.25:.18,bark=spec.kind==='dragon'?0xc8c3b7:spec.kind==='birch'?0xd4d3c6:spec.kind==='eucalypt'?0xb2b6a6:spec.kind==='twist'?0x685d72:0x9f8c70;
 if(spec.kind==='creeping'){
  for(let j=0;j<5;j++){const a=j*2.399+.2,L=r*(.7+R()*.3),tip=[Math.cos(a)*L,.14+R()*.08,Math.sin(a)*L];tube([[0,.015,0],[tip[0]*.48,.18,tip[2]*.48],tip],[.024,.018,.005],3,bark,0,.85);cluster([tip[0]*.7,.19,tip[2]*.7],.55,.40,.055,.75,'needle',a);cluster(tip,.48,.36,.05,.85,'needle',a+.5);}
 }else{
  const lean=spec.kind==='eucalypt'?.60:spec.kind==='umbrella'?.65:spec.kind==='palm'?.75:spec.kind==='twist'?.45:spec.kind==='dead'?.20:isElf?.45:.10,stems=['birch','olive','multistem','shrub'].includes(spec.kind)?(spec.kind==='multistem'?3:2):1,trunkTop=spec.kind==='dragon'?H*.43:small?H*.67:['dead','twist'].includes(spec.kind)?H*.83:['banana','palm'].includes(spec.kind)?H*.78:spec.kind==='spire'||spec.kind==='pine'||spec.kind==='sprays'?H*.96:H*.73;
  for(let j=0;j<stems;j++){const x=(j-(stems-1)*.5)*(small?.15:.22),p=[[x,0,0],[x+lean*(spec.kind==='palm'?.02:.18),H*.24,.02],[x+lean*(spec.kind==='palm'?.20:spec.kind==='twist'?-.55:.55),H*(spec.kind==='dragon'?.32:.46),spec.kind==='twist'?.17:-.02],[x+lean,trunkTop,.05]];tube(p,[trunkRadius,trunkRadius*.82,trunkRadius*.55,spec.kind==='dragon'?.16:.025],isWorld?10:6,bark,0,0,'trunk',spec.kind==='birch'?'white':'bark');if(spec.kind==='birch')for(let k=0;k<5;k++){const y=.4+k*.72,first=m.P.length/3;m.tri([x-.05,y,.095],[x+.05,y+.02,.095],[x,y+.05,.096],[white(),white(),white()],0x66695e,[0,0,1]);mark('trunk',first);}}
  const roots=small?0:isWorld?7:3;for(let j=0;j<roots;j++){
   const a=j*2.399+.4,L=isWorld?3.8+R()*1.4:trunkRadius*2.5;
   if(isWorld||isElf){
    // A low triangular buttress joins the trunk; outside the existing body radius its ridge stays below 0.12 m.
    const first=m.P.length/3,centres=[[Math.cos(a)*trunkRadius*.86,0,Math.sin(a)*trunkRadius*.86],[Math.cos(a+.10)*(isWorld?1.60:L*.45),0,Math.sin(a+.10)*(isWorld?1.60:L*.45)],[Math.cos(a)*L,0,Math.sin(a)*L]],widths=isWorld?[.48,.24,.018]:[.12,.065,.01],heights=isWorld?[1.1+.35*(.5+.5*Math.sin(j*2.41)),.12,.025]:[.35,.08,.02],rings=centres.map((p,k)=>[[p[0]-Math.sin(a)*widths[k],.005,p[2]+Math.cos(a)*widths[k]],[p[0]+(k===0?Math.cos(a)*trunkRadius*.23:0),heights[k],p[2]+(k===0?Math.sin(a)*trunkRadius*.23:0)],[p[0]+Math.sin(a)*widths[k],.005,p[2]-Math.cos(a)*widths[k]]]);
    for(let k=0;k<2;k++)for(let side=0;side<3;side++){const next=(side+1)%3,hint=side===2?[0,-1,0]:[Math.sin(a)*(side===0?-1:1),1,Math.cos(a)*(side===0?1:-1)],uv=(x,y)=>m.uv('bark',x/3,y/2);m.tri(rings[k][side],rings[k+1][side],rings[k][next],[uv(side,k),uv(side,k+1),uv(next,k)],bark,hint);m.tri(rings[k][next],rings[k+1][side],rings[k+1][next],[uv(next,k),uv(side,k+1),uv(next,k+1)],bark,hint);}
    m.tri(...rings[0],[m.uv('bark',0,0),m.uv('bark',.5,1),m.uv('bark',1,0)],bark,[-Math.cos(a),0,-Math.sin(a)]);m.tri(...rings[2],[m.uv('bark',0,0),m.uv('bark',.5,1),m.uv('bark',1,0)],bark,[Math.cos(a),0,Math.sin(a)]);
    for(let i=first;i<m.P.length/3;i++){m.W[i]=0;if(m.N[i*3+1]>-.7){const up=new T.Vector3(m.P[i*3],0,m.P[i*3+2]).normalize().multiplyScalar(.32);up.y=.85;const normal=V(m.N.slice(i*3,i*3+3)).lerp(up,.35).normalize();m.N.splice(i*3,3,...normal.toArray());}const shade=.86+.14*Math.min(1,m.P[i*3+1]/(isWorld?1.1:.35));for(let k=0;k<3;k++)m.C[i*3+k]*=shade;}mark('root',first);
   }else tube([[Math.cos(a)*trunkRadius*.45,.16,Math.sin(a)*trunkRadius*.45],[Math.cos(a)*L*.48,.10,Math.sin(a)*L*.48],[Math.cos(a)*L,.012,Math.sin(a)*L]],[trunkRadius*.38,trunkRadius*.19,.014],4,bark,0,0,'root');
  }
  if(['palm','banana'].includes(spec.kind)){
   const base=[lean,trunkTop,.05];for(let j=0;j<spec.n;j++){const a=j*2.399+R()*.45,L=r*(.75+R()*.25),rise=spec.kind==='banana'?.43:.48,drop=spec.kind==='banana'?.03:.30;frond(base,a,L,spec.kind==='banana'?.40:.38,rise,drop,.8+R()*.2,spec.kind==='banana'?'banana':'palm');}
   for(let j=0;j<(spec.kind==='banana'?6:3);j++)fruit([lean+.13,trunkTop-.15-j*.035,.10],spec.kind==='banana'?.055:.10,spec.kind==='banana'?0xb6ac53:0x8f7050,0);
  }else if(['dead','twist'].includes(spec.kind)){
   for(let j=0;j<spec.n;j++){
    const a=j*2.399+.3+(R()-.5)*.5,y=2.37+(H-2.37)*(j/spec.n*.28),L=r*(.45+R()*.5),tip=[Math.cos(a)*L,H*(.84+R()*.13),Math.sin(a)*L],mid=[Math.cos(a+.38)*L*.48,y+(tip[1]-y)*.50,Math.sin(a+.38)*L*.48];
    tube([[lean*.55,y,.03],mid,tip],[.085,.037,.009],4,bark,0,.8);
    if(j%2===0){const angle=a-.7,fork=[mid[0]+Math.cos(angle)*L*.40,Math.min(H*.99,Math.max(y+.12,tip[1]+.10)),mid[2]+Math.sin(angle)*L*.40];tube([mid,fork],[.034,.007],3,bark,.4,.85);if(spec.kind==='twist')fruit(fork,.065,0xb571e4,.85,2.2);}
    if(spec.kind==='twist')fruit(tip,.085,0xb571e4,.8,2.2);
   }
  }else if(spec.kind==='dragon'){
   // Repeated forks support paired inner/outer heads in one shallow umbrella.
   const hub=[lean,H*.43,.05],tips=[];
   for(let j=0;j<3;j++){
    const a=j*Math.PI*2/3+.28,primary=[Math.cos(a)*r*.25,H*.64,Math.sin(a)*r*.25];
    tube([hub,[primary[0]*.48,H*.535,primary[2]*.48],primary],[.17,.135,.10],5,bark,0,.23);
    for(let side=0;side<2;side++){
     const b=a+(side?-.43:.46),secondary=[Math.cos(b)*r*.45,H*.77,Math.sin(b)*r*.45];tube([primary,secondary],[.10,.063],4,bark,.23,.43);
     for(let fork=0;fork<2;fork++){
      const c=b+(fork?-.24:.25),parent=[Math.cos(c)*r*.56,H*.805,Math.sin(c)*r*.56];tube([secondary,parent],[.063,.038],3,bark,.43,.61);
      for(let end=0;end<2;end++){
       const d=c+(end?-.14:.17),radius=r*(end?.76:.62),tip=[Math.cos(d)*radius,dragonSurface(Math.cos(d)*radius,Math.sin(d)*radius),Math.sin(d)*radius],weight=end?.86:.79;
       tube([parent,tip],[.038,.016],3,bark,.61,weight);tips.push({p:tip,w:weight,a:d});
      }
     }
    }
   }
   for(let j=0;j<3;j++){const a=j*2.094+.9,p=[Math.cos(a)*.42,dragonSurface(Math.cos(a)*.42,Math.sin(a)*.42),Math.sin(a)*.42];tube([hub,[p[0]*.8,H*.84,p[2]*.8],p],[.085,.05,.016],3,bark,0,.78);tips.push({p,w:.78,a});}
   for(const t of tips){const size=1.10+R()*.15;cluster(t.p,size,size*(.93+R()*.07),.13+R()*.05,t.w,'dragon',t.a+R());}
  }else{
   if(spec.kind==='fan')for(const a of [.15,2.45,4.35])tube([[.01,2.45,0],[Math.cos(a)*r*.29,H*.51,Math.sin(a)*r*.18],[Math.cos(a)*r*.56,H*.72,Math.sin(a)*r*.40]],[.12,.075,.022],5,bark,0,.68);
   for(let j=0;j<spec.n;j++){
    const a=j*2.399+(R()-.5)*.35,conifer=['pine','spire','sprays'].includes(spec.kind),progress=j/Math.max(1,spec.n-1),y=small?.12:clear+(H-clear)*(.05+(conifer?progress*.66:j%3*.09)),radial=conifer?r*(.72-progress*.60):r*(.52+R()*.40),tipY=conifer?Math.max(y+.15,H*(.48+progress*.46)):spec.kind==='layered'?H*(.67+(j%3)*.10):spec.kind==='umbrella'?H*(.83+R()*.08):spec.kind==='rowan'?H*(.73+R()*.18):spec.kind==='eucalypt'?H*(.54+progress*.40):H*(.73+R()*.16),tip=[lean*.6+Math.cos(a)*radial,tipY,Math.sin(a)*radial],w=.72+R()*.28,start=[lean*.4,y,.015],mid=V(start).lerp(V(tip),.56).add(new T.Vector3(0,.15,0)).toArray();
    tube([start,mid,tip],[isWorld?.24:small?.026:.07,isWorld?.15:small?.018:.043,isWorld?.06:.012],small?3:4,bark,0,w);
    const count=spec.clumps||2;for(let k=0;k<count;k++){const angle=a+(k-1)*.93,f=.26+(count===1?.35:k/(count-1)*.74),d0=V(start).distanceTo(V(mid)),d1=V(mid).distanceTo(V(tip)),travel=f*(d0+d1),p=(travel<d0?V(start).lerp(V(mid),travel/d0):V(mid).lerp(V(tip),(travel-d0)/d1)).toArray(),size=(small?.60:spec.kind==='rowan'?.74:conifer?r*(1.0-progress*.73):r*(['heavy','blossom'].includes(spec.kind)?.43:spec.kind==='fan'?.36:['olive','multistem'].includes(spec.kind)?.43:spec.kind==='eucalypt'?.36:isWorld?.29:.38))*(.87+R()*.25),narrow=['olive','eucalypt','multistem','rowan'].includes(spec.kind);p[0]+=Math.cos(angle)*size*.24;p[2]+=Math.sin(angle)*size*.24;p[1]+=k===count-1?.13:0;const attachment=w*f;cluster(p,size,narrow?size*.78:size*.89,small?.10:conifer?(spec.kind==='spire'?.85:.48):size*.30,attachment,spec.cell||'broad',angle);}
    if(spec.kind==='willow'){const p=tip.slice();p[1]+=.04;frond(p,a,.65+R()*.45,.24,.04,Math.min(.65,p[1]-2.32),w,'fine');}
    if(spec.kind==='rowan'&&j%2===0)for(let k=0;k<3;k++)fruit([tip[0]+k*.055,tip[1]-.05-k*.012,tip[2]],.045,0xb45c40,w);
    if(isElf&&j%2===0)fruit([tip[0],tip[1]-.08,tip[2]],.07,0x9dd6c7,w,.45);
   }
   if(!small&&!['eucalypt','rowan'].includes(spec.kind))cluster([lean*.6,H-.30,.03],coniferKind(spec)?r*.28:r*.48,coniferKind(spec)?r*.25:r*.41,.30,.88,spec.cell||'broad',.3);
  }
 }
 // Fit legacy extents without changing placement origins or dimensions.
 const P=m.P,N=m.N,C=m.C,U=m.U,W=m.W,lo=[0,0,0],hi=[0,0,0];for(let k=0;k<3;k++){lo[k]=Math.min(...P.filter((_,i)=>i%3===k));hi[k]=Math.max(...P.filter((_,i)=>i%3===k));}
 const target=spec.legacy?legacy[id].bounds:[[-(spec.rx||r),0,-(spec.rz||r)],[(spec.rx||r),H,(spec.rz||r)]],scale=hi.map((v,k)=>(target[1][k]-target[0][k])/(v-lo[k]));for(let i=0;i<P.length;i+=3){const local=[P[i]>=0?target[1][0]/hi[0]:target[0][0]/lo[0],scale[1],P[i+2]>=0?target[1][2]/hi[2]:target[0][2]/lo[2]];P[i]*=local[0];P[i+1]=target[0][1]+(P[i+1]-lo[1])*local[1];P[i+2]*=local[2];const n=new T.Vector3(N[i]/local[0],N[i+1]/local[1],N[i+2]/local[2]).normalize();N.splice(i,3,...n.toArray());}
 // Weld identical corners and quantize authoring noise; retain independent motion anchors.
 const map=new Map(),p=[],n=[],c=[],u=[],w=[],e=[],triangles=[],remap=[],round=x=>Math.abs(x)<.0000005?0:Math.round(x*1e6)/1e6;
 for(let i=0;i<P.length/3;i++){const values=[...P.slice(i*3,i*3+3),...N.slice(i*3,i*3+3),...C.slice(i*3,i*3+3),...U.slice(i*2,i*2+2),W[i],G[i]||0].map(round),key=values.join(',');let vertex=map.get(key);if(vertex===undefined){vertex=p.length/3;map.set(key,vertex);p.push(...values.slice(0,3));n.push(...values.slice(3,6));c.push(...values.slice(6,9));u.push(...values.slice(9,11));w.push(values[11],values[11]);e.push(values[12]);}triangles.push(vertex);remap.push(vertex);}
 const partData=parts.map(part=>({...part,indices:[...new Set(remap.slice(part.first,part.first+part.count))]})),clusterData=clumps.map(part=>({...part,indices:[...new Set(remap.slice(part.first,part.first+part.count))]}));
 return{positions:p,normals:n,colors:c,uv:u,triangles,motionWeights:w,glow:e.some(v=>v>0)?e:null,parts:partData,clumps:clusterData,branches,scale,bounds:target};
}
function coniferKind(s){return ['pine','spire','sprays'].includes(s.kind);}
async function paint(data){const cv=document.createElement('canvas');cv.width=1024;cv.height=512;const ctx=cv.getContext('2d'),wood=data.textures.find(t=>t.id==='woodland-plants-atlas-v1'),image=new Image();image.src='data:image/png;base64,'+wood.png;await image.decode();const src=document.createElement('canvas');src.width=src.height=1024;src.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(TDGeo.ATLAS.paint()),1024,1024),0,0);
 ctx.drawImage(image,0,0,256,256,0,0,256,256);ctx.drawImage(image,256,0,256,256,256,0,256,256);ctx.drawImage(image,0,256,256,128,512,0,256,128);ctx.drawImage(image,256,256,128,128,768,0,128,256);ctx.fillStyle='#fff';ctx.fillRect(896,0,128,256);ctx.drawImage(src,0,512,1024,128,0,256,512,128);ctx.drawImage(src,512,640,512,128,512,256,512,128);ctx.drawImage(image,0,384,128,128,0,384,256,128);

 const blade=ctx.createLinearGradient(512,384,768,384);blade.addColorStop(0,'#8b8b8b');blade.addColorStop(.48,'#c5c5c5');blade.addColorStop(1,'#ababab');ctx.fillStyle=blade;ctx.fillRect(512,384,256,128);ctx.strokeStyle='#dddddd';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(512,448);ctx.lineTo(768,448);ctx.stroke();ctx.strokeStyle='rgba(90,90,90,.20)';ctx.lineWidth=.6;for(let j=0;j<28;j++){const x=516+j*9;ctx.beginPath();ctx.moveTo(x,448);ctx.lineTo(x+14,388);ctx.moveTo(x,448);ctx.lineTo(x+14,508);ctx.stroke();}
 const R=TDGeo.rng(76231);for(let i=0;i<220;i++){const a=R()*Math.PI*2,r=Math.sqrt(R()),x=384+Math.cos(a)*r*112,y=449+Math.sin(a)*r*54,size=2.8+R()*2.4;for(let j=0;j<5;j++){ctx.fillStyle=['#d4d4d4','#ececec','#bababa'][Math.floor(R()*3)];ctx.beginPath();ctx.ellipse(x+Math.cos(j*1.256)*size*.52,y+Math.sin(j*1.256)*size*.52,size*.61,size*.42,j*1.256,0,Math.PI*2);ctx.fill();}}
 const pixels=ctx.getImageData(0,0,1024,512);for(let i=0;i<pixels.data.length;i+=4){const a=pixels.data[i+3],l=.2126*pixels.data[i]+.7152*pixels.data[i+1]+.0722*pixels.data[i+2],y=i/4/1024|0,x=i/4%1024;const value=a<8?190:x>=896&&y<256?255:Math.min(232,Math.max(140,178+(l-120)*.52));pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;}ctx.putImageData(pixels,0,0);ctx.clearRect(512,384,256,128);ctx.drawImage(dragonTile(),512,384);return cv.toDataURL('image/png').split(',')[1];}
function dragonTile(){
 const cv=document.createElement('canvas');cv.width=256;cv.height=128;const c=cv.getContext('2d'),R=TDGeo.rng(93217);
 // Seven small terminal rosettes form one dense patch, avoiding giant wheel-shaped heads.
 for(let head=0;head<7;head++){
  const angle=head*2.399,ring=head===6?0:.48,cx=128+Math.cos(angle)*ring*119,cy=64+Math.sin(angle)*ring*57;
  c.fillStyle=head%2?'#b6b6b6':'#bdbdbd';c.beginPath();c.ellipse(cx,cy,30,14.5,0,0,Math.PI*2);c.fill();
  for(let k=0;k<46;k++){
   const a=k*2.399+head*.8+(R()-.5)*.18,L=.25+R()*.23,w=1.5+R()*1.7,tx=cx+Math.cos(a)*L*119,ty=cy+Math.sin(a)*L*57,sx=-Math.sin(a)*w,sy=Math.cos(a)*w*.48;
   c.beginPath();c.moveTo(cx,cy);c.quadraticCurveTo(cx+(tx-cx)*.55+sx,cy+(ty-cy)*.55+sy,tx,ty);c.quadraticCurveTo(cx+(tx-cx)*.45-sx,cy+(ty-cy)*.45-sy,cx,cy);c.fillStyle=['#c2c2c2','#b9b9b9','#cbcbcb','#b1b1b1'][k%4];c.fill();
  }
 }
 return cv;
}
window.TDTreeCanopies={specs,build,paint,cells,dragonTile};
})();

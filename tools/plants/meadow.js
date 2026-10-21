// Colour-selectable patches: cut geometry and the existing atlas, no new image.
(()=>{
const T=THREE,M=TDNewPlants.MeshRecipe;
const specs=[
 {id:'meadowwhite',name:'花畑・白',colour:0xe5dfc7,petals:6,seed:82301},
 {id:'meadowyellow',name:'花畑・黄',colour:0xd8b94c,petals:8,seed:82539},
 {id:'meadowpink',name:'花畑・桃',colour:0xcf8fa3,petals:5,seed:82791},
 {id:'meadowred',name:'花畑・赤',colour:0xb75459,petals:6,seed:82977},
 {id:'meadowviolet',name:'花畑・青紫',colour:0x9588c6,petals:5,seed:83131}
];
function build(id){const spec=specs.find(s=>s.id===id),m=new M(spec.seed),R=m.R,heads=[];
 const white=()=>m.uv('white'),tri=(a,b,c,hex,uv=[white(),white(),white()])=>m.tri(a,b,c,uv,hex,[0,1,0]);
 for(let k=0;k<10;k++){
  // Unequal phyllotaxis and an open edge merge adjacent patches without a tile.
  const a=k*2.399+(R()-.5)*.65,r=k===0?0:Math.sqrt(k/10)*(.45+R()*.14),x=Math.cos(a)*r,z=Math.sin(a)*r,h=.29+R()*.17;
  const tip=[x+(R()-.5)*.085,h,z+(R()-.5)*.085],first=m.P.length/3,flex=.75+R()*.25;
  m.tube([[x,0,z],[(x+tip[0])/2,h*.55,(z+tip[2])/2],tip],[.009,.006,.003],3,0x829163,'stem');
  const radius=.075+R()*.027,angle=R()*Math.PI*2,petals=spec.petals+(k===3?1:0),c=new T.Color(spec.colour).multiplyScalar(.92+R()*.13),hex=c.getHex();
  const headStart=m.P.length/3;
  for(let j=0;j<petals;j++){
   const b=angle+j*Math.PI*2/petals+(R()-.5)*.11,L=radius*(.9+R()*.17),width=L*(petals>6?.32:.42),p=(d,s,y)=>[tip[0]+Math.cos(b)*d-Math.sin(b)*s,tip[1]+y,tip[2]+Math.sin(b)*d+Math.cos(b)*s];
   const base=p(.012,0,.006),left=p(L*.66,-width,.014),lt=p(L,-width*.48,.004),rt=p(L,width*.48,.004),right=p(L*.66,width,.014);
   tri(base,left,lt,hex);tri(base,lt,rt,hex);tri(base,rt,right,hex);
  }
  for(let j=0;j<6;j++){const a=j*Math.PI/3,b=(j+1)*Math.PI/3;tri([tip[0],h+.020,tip[2]],[tip[0]+Math.cos(a)*.025,h+.013,tip[2]+Math.sin(a)*.025],[tip[0]+Math.cos(b)*.025,h+.013,tip[2]+Math.sin(b)*.025],spec.id==='meadowyellow'?0x9e7744:0xc3a25c);}
  for(let i=headStart;i<m.W.length;i++)m.W[i]=flex;
  // Two tilted, pointed leaves expose leaf area from overhead, never crossed cards.
  for(let j=0;j<2;j++){const t=.28+j*.20,b=a+j*2.3,p=[x+(tip[0]-x)*t,h*t,z+(tip[2]-z)*t],end=[p[0]+Math.cos(b)*.13,p[1]+.025,p[2]+Math.sin(b)*.13],mid=[p[0]+Math.cos(b)*.065,p[1]+.032,p[2]+Math.sin(b)*.065],side=[-Math.sin(b)*.035,0,Math.cos(b)*.035];
   tri(p,[mid[0]+side[0],mid[1],mid[2]+side[2]],end,0x8d9c70,[m.uv('leaf',.5,0),m.uv('leaf',0,.5),m.uv('leaf',.5,1)]);
   tri(p,end,[mid[0]-side[0],mid[1],mid[2]-side[2]],0x8d9c70,[m.uv('leaf',.5,0),m.uv('leaf',.5,1),m.uv('leaf',1,.5)]);
  }
  for(let i=first;i<m.W.length;i++)if(m.W[i]<0){const t=Math.max(0,Math.min(1,(m.P[i*3+1]-.012)/(h-.012)));m.W[i]=flex*t*t*(3-2*t);}
  heads.push({center:tip,radius,weight:flex});
 }
 const g=m.geometry();for(let i=0;i<g.attributes.position.count;i++)if(g.attributes.position.getY(i)<0)g.attributes.position.setY(i,0);g.computeVertexNormals();return{geo:g,heads};
}
window.TDMeadow={specs,build};
})();

// 既存ID bush の共有レシピ。縦十字カードを使わず、葉面と枝で裾を分ける。
(()=>{
function build(){const m=new TDNewPlants.MeshRecipe(86191),R=m.R;
 for(let k=0;k<7;k++){const a=k*2.399+(R()-.5)*.6,L=.39+R()*.12,h=k===0?.68:.25+R()*.16,b=[(R()-.5)*.12,-.035,(R()-.5)*.12],p=[b,[b[0]+Math.cos(a)*L*.48,h*.69,b[2]+Math.sin(a)*L*.48],[b[0]+Math.cos(a+.16)*L,h,b[2]+Math.sin(a+.16)*L]];
  m.tube(p,[.014,.010,.0035],3,0x77735b,'stem',true);
  for(let j=0;j<10;j++){const t=.17+j*.09,s=t<.5?0:1,f=s?t*2-1:t*2,q=new THREE.Vector3(...p[s]).lerp(new THREE.Vector3(...p[s+1]),f).toArray(),side=j%2?-.9:.9,low=j<3;
   q[1]+=(R()-.5)*.035;TDForestFloor.leaf(m,q,a+side+(R()-.5)*1.5,.105+R()*.045,.046+R()*.015,low?0x61754b:[0x839565,0x7c925c,0x8b9c71][(k+j)%3]);
  }
  if(k%2===0)TDForestFloor.leaf(m,[p[0][0],.065,p[0][2]],a+.4,.14,.052,0x5c7146);
 }
 for(let k=0;k<5;k++)TDForestFloor.leaf(m,[(R()-.5)*.18,.10+R()*.08,(R()-.5)*.18],k*2.4,.12,.05,0x697d4f);
 return m.geometry();}
window.TDBush={build};})();

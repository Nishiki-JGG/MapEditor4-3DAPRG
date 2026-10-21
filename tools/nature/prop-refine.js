// Five existing IDs, unchanged metre-scale bounds and placement origins.
(()=>{
const T=THREE,M=TDNewPlants.MeshRecipe,V=p=>new T.Vector3(...p);
const bounds={log:[[-1.6450849771499634,0,-.3100666403770447],[1.6349999904632568,.896957278251648,.3718116581439972]],stump:[[-.7491245269775391,0,-.7416989803314209],[.7620534300804138,.7056929469108582,.7559112906455994]],rootfan:[[-.9601083397865295,0,-.7402042150497437],[.6250757575035095,.2115219086408615,.841434121131897]],driftwood:[[-1.2628328800201416,-.05167504400014877,-.3065824508666992],[1.257798433303833,.6874537467956543,.48770493268966675]],woodfence:[[-1.035896897315979,-.02845439501106739,-.09787943214178085],[1.0432188510894775,1.100000023841858,.10999999940395355]]};
const specs=[{id:'log',name:'倒木',texture:'forest-atlas-v1'},{id:'stump',name:'切り株',texture:'forest-atlas-v1'},{id:'rootfan',name:'露出根',texture:'forest-atlas-v1'},{id:'driftwood',name:'流木',texture:'weathered-wood-v1'},{id:'woodfence',name:'木の柵',texture:'weathered-wood-v1'}];
function build(id){const spec=specs.find(s=>s.id===id),m=new M(92131+specs.indexOf(spec)),R=m.R,native=spec.texture==='weathered-wood-v1';
 m.uv=(cell,u=.5,v=.5)=>cell==='white'?(native?[.94,.5]:[.75,.875]):native?[(3+u*216)/256,.015+v*.97]:[.01+u*.48,.51+v*.23];
 const uv=()=>m.uv('white'),flat=(a,b,c,hex,hint=[0,1,0])=>m.tri(a,b,c,[uv(),uv(),uv()],hex,hint);
 const tube=(points,radii,sides=5,hex=0xc2b59d,open=false)=>m.tube(points,radii,sides,hex,'bark',open);
 function moss(center,rx,ry,rz){const g=new T.IcosahedronGeometry(1,0).attributes.position;for(let i=0;i<g.count;i+=3){const q=k=>[center[0]+g.getX(k)*rx*(1+.04*Math.sin(g.getX(k)*13+g.getZ(k)*7)),center[1]+g.getY(k)*ry,center[2]+g.getZ(k)*rz];m.tri(q(i),q(i+1),q(i+2),[uv(),uv(),uv()],i%9?0x617b48:0x71884f);}}
 function cut(center,axis,r,seed){const direction=V(axis).normalize(),u=new T.Vector3().crossVectors(direction,Math.abs(direction.z)<.9?new T.Vector3(0,0,1):new T.Vector3(1,0,0)).normalize(),v=new T.Vector3().crossVectors(direction,u),n=10,at=(f,j)=>{const a=j/n*Math.PI*2,rr=r*f*(1+.05*Math.sin(j*2.3+seed));return V(center).addScaledVector(u,Math.cos(a)*rr+(f<.8?.018:0)).addScaledVector(v,Math.sin(a)*rr+(f<.8?-.012:0)).toArray();};
  for(let j=0;j<n;j++){const k=(j+1)%n;for(const [outer,inner,color]of[[1,.88,0x89765a],[.88,.48,0xc6aa80]]){flat(at(outer,j),at(outer,k),at(inner,j),color,axis);flat(at(outer,k),at(inner,k),at(inner,j),color,axis);}flat(V(center).addScaledVector(u,.018).addScaledVector(v,-.012).toArray(),at(.48,j),at(.48,k),0xbba07a,axis);}
  for(const a of[.7+seed,3.8+seed]){const p=f=>V(center).addScaledVector(direction,.002).addScaledVector(u,Math.cos(a)*r*f).addScaledVector(v,Math.sin(a)*r*f).toArray(),left=V(p(.88)).addScaledVector(u,.009).toArray();flat(p(.95),left,p(.45),0x77664f,axis);}
 }
 if(id==='log'){
  tube([[-1.6,.34,0],[-.8,.36,.025],[.1,.35,-.025],[.8,.30,-.015],[1.6,.31,.01]],[.32,.33,.31,.29,.29],10,0xc0b29a,true);
  cut([-1.6,.34,0],[-1,0,0],.32,.3);cut([1.6,.31,.01],[1,0,0],.29,1.4);
  tube([[.40,.47,.02],[.54,.65,.06],[.72,.84,.09]],[.083,.060,.033],3,0xb6a88c);
  moss([-.56,.66,-.005],.34,.035,.16);moss([.05,.64,-.025],.24,.027,.12);
 }else if(id==='stump'){
  tube([[0,.03,0],[.025,.29,.005],[-.008,.63,.014]],[.43,.39,.35],10,0xc1b19a,true);
  for(let j=0;j<10;j++)flat([0,.03,0],[Math.cos(j*Math.PI/5)*.43,.03,Math.sin(j*Math.PI/5)*.43],[Math.cos((j+1)*Math.PI/5)*.43,.03,Math.sin((j+1)*Math.PI/5)*.43],0x958068,[0,-1,0]);
  cut([-.008,.63,.014],[.03,1,.04],.35,1.7);
  for(const [a,L]of[[.22,.68],[1.78,.58],[3.39,.72],[4.96,.61]])tube([[Math.cos(a)*.25,.24,Math.sin(a)*.25],[Math.cos(a+.12)*L*.7,.085,Math.sin(a+.12)*L*.7],[Math.cos(a+.18)*L,.028,Math.sin(a+.18)*L]],[.11,.07,.012],3,0xb4a38c,true);
  moss([.22,.64,.08],.12,.028,.09);
  for(const[x,z,h]of[[-.39,.24,.085],[-.33,.28,.06]]){tube([[x,.025,z],[x,h,z]],[.009,.007],3,0xc5b89e);for(let j=0;j<6;j++)flat([x,h+.012,z],[x+Math.cos(j*Math.PI/3)*.035,h,z+Math.sin(j*Math.PI/3)*.035],[x+Math.cos((j+1)*Math.PI/3)*.035,h,z+Math.sin((j+1)*Math.PI/3)*.035],0xa68c67);}
 }else if(id==='rootfan'){
  const rows=[[[.0,.16,.0],[.27,.13,.17],[.58,.07,.08],[.94,.018,.31]],[[-.03,.14,.03],[-.29,.11,.22],[-.36,.055,.51],[-.67,.018,.77]],[[-.04,.15,-.02],[-.36,.11,-.09],[-.61,.06,-.39],[-.93,.018,-.46]]];
  for(let i=0;i<rows.length;i++)tube(rows[i],[.09,.070,.039,.010],4,i%2?0xb4a087:0xc0ac91,true);
  tube([[.27,.12,.17],[.36,.018,-.70]],[.039,.008],7,0xb4a087,true);tube([[-.29,.10,.22],[.035,.018,.86]],[.032,.007],7,0xb4a087,true);
 }else if(id==='driftwood'){
  tube([[-1.2,.16,-.03],[-.48,.19,.055],[.36,.17,-.02],[1.2,.13,.015]],[.20,.20,.17,.125],8,0xbcd6ff);
  for(const[p,q,r]of[[[.46,.20,.04],[.70,.44,.22],[.83,.65,.25]],[[-.62,.20,.03],[-.70,.36,-.19],[-.89,.47,-.24]],[[-.19,.22,.02],[-.05,.33,.20],[.12,.40,.28]]])tube([p,q,r],[.069,.043,.016],4,0xb6d0ed);
  for(const[x,z,L]of[[-.8,-.045,.54],[-.10,.035,.73],[.53,-.035,.42]]){const a=[x,.323,z],b=[x+L,.30,z+.012],c=[x+L*.42,.35,z+.024];flat(a,b,c,0xa89d88);flat(a,c,[x,.33,z+.008],0xe0d2bb);}
 }else if(id==='woodfence'){
  for(let k=0;k<3;k++){const x=-.9+k*.9; tube([[x,.015,0],[x+(k-1)*.012,.55,.005],[x+(k-1)*.028,1.065,.005]],[.075,.069,.058],5,0xc5b79f);}
  function beam(y){const shape=[[-.025,-.04],[-.018,-.05],[.018,-.05],[.025,-.04],[.025,.04],[.018,.05],[-.018,.05],[-.025,.04]],at=(x,i)=>[x,y+shape[i][1]+x*.014,.07+shape[i][0]],n=shape.length;for(let i=0;i<n;i++){const j=(i+1)%n,normal=[0,shape[i][1],shape[i][0]],a=at(-1.025,i),b=at(1.025,i),c=at(1.025,j),d=at(-1.025,j);m.tri(a,b,d,[m.uv('bark',i/n,0),m.uv('bark',i/n,1),m.uv('bark',j/n,0)],0xd0c0a6,normal);m.tri(d,b,c,[m.uv('bark',j/n,0),m.uv('bark',i/n,1),m.uv('bark',j/n,1)],0xd0c0a6,normal);}for(const side of[-1,1])for(let i=1;i<n-1;i++)flat(at(side*1.025,0),at(side*1.025,i),at(side*1.025,i+1),0xb7a68d,[side,0,0]);}
  beam(.35);beam(.75);for(let k=0;k<6;k++){const x=-.9+k%3*.9,y=k<3?.35:.75,z=.102;flat([x-.008,y-.008,z],[x+.008,y-.008,z],[x+.008,y+.008,z],0x6e6c63,[0,0,1]);flat([x-.008,y-.008,z],[x+.008,y+.008,z],[x-.008,y+.008,z],0x6e6c63,[0,0,1]);}
 }
 const g=m.geometry();g.computeBoundingBox();const box=g.boundingBox,lo=bounds[id][0],hi=bounds[id][1],s=box.getSize(new T.Vector3()),p=g.attributes.position;
 for(let i=0;i<p.count;i++)for(let axis=0;axis<3;axis++)p.array[i*3+axis]=lo[axis]+(p.array[i*3+axis]-box.min.getComponent(axis))*(hi[axis]-lo[axis])/s.getComponent(axis);
 g.computeVertexNormals();const normals=g.attributes.normal,groups=new Map(),keys=[];for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>v.toFixed(5)).join('/');keys.push(key);const list=groups.get(key)||[];list.push(new T.Vector3().fromBufferAttribute(normals,i));groups.set(key,list);}for(let i=0;i<p.count;i++){const original=new T.Vector3().fromBufferAttribute(normals,i),sum=new T.Vector3();for(const n of groups.get(keys[i]))if(n.dot(original)>.69)sum.add(n);sum.normalize();normals.setXYZ(i,sum.x,sum.y,sum.z);}g.computeBoundingBox();return g;
}
window.TDPropRefine={specs,bounds,build};
})();

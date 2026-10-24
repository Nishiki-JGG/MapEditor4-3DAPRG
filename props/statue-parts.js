// 着衣像の連続した衣・人体・台座。参照の姿勢を基にし、人物名は特定しない。
window.TDStatueParts=(()=>{
 const {col,mixc,mat4}=TDGeo,{mesh,tube}=TDSmallParts;
 const stone=(y,ny,R,pr)=>mixc(col(0x9f9b8d),col(0xc0b9a7),.20+pr*.28);
 const addTo=(p,g,m)=>p.push({g,m:m||new THREE.Matrix4(),cfn:stone,j:.012});
 function cloth(levels,N=24){const v=[],ix=[];levels.forEach(([y,rx,rz,z=0,fold=.08,phase=0])=>{for(let j=0;j<N;j++){const a=j/N*Math.PI*2,f=1+fold*(.55*Math.cos(7*a+phase)+.30*Math.cos(5*a-phase)+.15*Math.cos(11*a+phase*.5));v.push([Math.cos(a)*rx*f+.018*Math.sin((y-.8)*2.8)*Math.max(0,Math.min(1,(2.1-y))),y,z+Math.sin(a)*rz*f]);}});for(let k=1;k<levels.length;k++)for(let j=0;j<N;j++){const a=(k-1)*N+j,b=(k-1)*N+(j+1)%N,c=k*N+j,d=k*N+(j+1)%N;ix.push(a,c,b,b,c,d);}for(const end of [0,levels.length-1]){const q=v.length;v.push([0,levels[end][0],levels[end][3]||0]);for(let j=0;j<N;j++)end?ix.push(q,end*N+(j+1)%N,end*N+j):ix.push(q,j,(j+1)%N);}return mesh(v,ix);}
 function baseParts(){const p=[],v=[],ix=[],levels=[[0,.55],[.045,.55],[.09,.49],[.52,.49],[.575,.545],[.64,.44],[.75,.44]],N=8;
  const ring=r=>[[-r+.045,-r],[r-.045,-r],[r,-r+.045],[r,r-.045],[r-.045,r],[-r+.045,r],[-r,r-.045],[-r,-r+.045]];
  levels.forEach(([y,r])=>ring(r).forEach(([x,z])=>v.push([x,y,z])));for(let k=1;k<levels.length;k++)for(let j=0;j<N;j++){const a=(k-1)*N+j,b=(k-1)*N+(j+1)%N,c=a+N,d=b+N;ix.push(a,c,b,b,c,d);}for(const end of [0,levels.length-1]){const q=v.length;v.push([0,levels[end][0],0]);for(let j=0;j<N;j++)end?ix.push(q,end*N+(j+1)%N,end*N+j):ix.push(q,j,(j+1)%N);}addTo(p,mesh(v,ix));return p;
 }
 function headParts(pose=new THREE.Matrix4()){
  const p=[],add=(g,m)=>addTo(p,g,m);
  add(tube([[0,2.12,-.018],[0,2.29,-.013]],[.065,.061],8));
  const h=cloth([[2.265,.049,.046,.017,0],[2.31,.076,.070,0,0],[2.36,.086,.077,-.012,0],[2.42,.082,.074,-.016,0],[2.47,.080,.073,-.022,0],[2.52,.069,.064,-.024,0],[2.555,.043,.045,-.025,0],[2.567,.004,.005,-.025,0]],12),a=h.attributes.position;
  for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i),z=a.getZ(i);if(z>.026){let recess=0;for(const s of [-1,1])recess+=Math.exp(-Math.pow((x-s*.035)/.019,2)-Math.pow((y-2.419)/.019,2))*.014;a.setZ(i,z-recess);}}add(h);
  add(mesh([[-.012,2.44,.052],[.012,2.44,.052],[-.015,2.369,.064],[.015,2.369,.064],[0,2.379,.108],[0,2.443,.079]],[0,2,5,2,4,5,5,4,3,5,3,1,2,3,4,0,5,1]));
  for(const s of [-1,1])add(tube([[s*.013,2.422,.060],[s*.034,2.428,.063],[s*.054,2.42,.049]],[.0035,.004,.003],4));
  add(tube([[-.025,2.351,.074],[0,2.348,.087],[.025,2.351,.074]],[.003,.004,.003],4));
  add(cloth([[2.235,.026,.022,.049,.08],[2.265,.048,.032,.054,.09],[2.30,.063,.035,.045,.07],[2.34,.058,.029,.043,.05]],12));
  for(const s of [-1,1])add(tube([[s*.041,2.555,-.025],[s*.078,2.505,-.026],[s*.087,2.43,-.011],[s*.082,2.365,.014]],[.020,.018,.018,.011],6));
  add(new THREE.SphereGeometry(1,8,4,0,Math.PI*2,0,Math.PI*.5),mat4(0,2.49,-.026,.088,.105,.079));
  const faceProportion=new THREE.Matrix4().makeTranslation(0,2.38,0).multiply(new THREE.Matrix4().makeScale(1.12,.90,1)).multiply(new THREE.Matrix4().makeTranslation(0,-2.40,0));return p.map(a=>({...a,m:pose.clone().multiply(faceProportion).multiply(a.m)}));
 }
 function sleeve(points,radii){const c=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),v=c.getPoints(5),r=v.map((p,k)=>{const t=k/5*(radii.length-1),i=Math.min(radii.length-2,Math.floor(t));return THREE.MathUtils.lerp(radii[i],radii[i+1],t-i);});const g=tube(v.map(v=>v.toArray()),r,7,.82),ix=Array.from(g.index.array);g.setIndex(ix.slice(0,-42));return g;}
 function hand(x,y,z,ry=0,rz=0){const outline=[[-.022,-.048],[.022,-.048],[.035,-.012],[.035,.025],[.029,.055],[.019,.058],[.015,.034],[.012,.068],[.002,.071],[-.001,.036],[-.005,.071],[-.015,.068],[-.018,.032],[-.024,.059],[-.033,.053],[-.034,.017],[-.049,.026],[-.055,.014],[-.041,-.010],[-.031,-.024]],shape=new THREE.Shape(outline.map(p=>new THREE.Vector2(...p))),g=new THREE.ExtrudeGeometry(shape,{depth:.022,bevelEnabled:false,steps:1});g.translate(0,0,-.011);const p=[];addTo(p,g,mat4(x,y,z,1,1,1,ry,0,rz));return p;}
 function foot(x,z){const p=[],g=cloth([[.752,.047,.084,z+.035,0],[.778,.062,.115,z+.040,.02],[.82,.055,.097,z+.027,.025],[.85,.039,.055,z-.010,0]],8);addTo(p,g,mat4(x,0,0,1,1,1));return p;}
 function mantle(){const v=[],ix=[],NX=8,NY=5;for(let k=0;k<=NY;k++)for(let j=0;j<=NX;j++){const u=j/NX,t=k/NY,x=-.23+u*.46,y=2.065-t*(.32+.23*u),z=.16*Math.sqrt(Math.max(.04,1-Math.pow(x/.27,2)))+.012+.008*Math.cos(u*Math.PI*6-t*1.2)*Math.sin(Math.PI*t);v.push([x,y,z]);}for(let k=0;k<NY;k++)for(let j=0;j<NX;j++){const a=k*(NX+1)+j,b=a+1,c=a+NX+1,d=c+1;ix.push(a,c,b,b,c,d);}return mesh(v,ix);}
 function standingParts(){const p=baseParts(),add=(g,m)=>addTo(p,g,m);
  add(cloth([[.80,.30,.205,.025,.26,.2],[1.01,.29,.197,.020,.25,.35],[1.31,.245,.177,.012,.23,.6],[1.57,.215,.150,.005,.19,1.1],[1.77,.23,.155,0,.13,1.8],[1.98,.26,.158,-.006,.09,2.2],[2.075,.24,.14,-.006,.06,2.5],[2.13,.17,.11,-.010,.04,2.8],[2.16,.095,.078,-.010,.03,2.8]],20));
  for(const s of [-1,1])p.push(...foot(s*.125,.10));
  add(sleeve([[-.11,2.015,-.005],[-.315,1.90,.02],[-.25,1.72,.13],[-.085,1.67,.19]],[.12,.105,.084,.060]));
  add(sleeve([[.11,2.015,-.005],[.33,1.91,.005],[.36,1.82,.025],[.355,1.94,.015]],[.12,.10,.075,.057]));
  add(mantle());p.push(...hand(-.085,1.65,.20,0,-.22),...hand(.355,1.91,.015,Math.PI/2));p.push(...headParts());
  add(new THREE.CylinderGeometry(.023,.030,2.10,8),mat4(.36,1.90,0,1,1,1));return p;
 }
 return{stone,cloth,baseParts,headParts,standingParts,sleeve,hand,foot,mantle};
})();

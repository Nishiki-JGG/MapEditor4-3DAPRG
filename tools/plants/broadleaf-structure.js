// 樹種ごとの枝階層と葉付き小枝。生成後のデータをブラウザ・Unityで共有する。
(()=>{
const T=THREE,V=p=>new T.Vector3(...p),mix=(a,b,t)=>a+(b-a)*t;
const enabled=new Set(['oak','nara','zelkova','maple','cherry','islandash','olive','eucalyptus','birch','willow','rowan','hazel','elftree','worldtree']);
const profiles={
 oak:{outer:6,leaders:2,leaf:.20},
 nara:{outer:6,leaders:2,leaf:.20},
 zelkova:{outer:6,leaders:3,leaf:.19},
 maple:{outer:5,leaders:2,leaf:.20},
 cherry:{outer:6,leaders:2,leaf:.21},
 islandash:{outer:5,leaders:3,leaf:.25},
 olive:{outer:5,leaders:2,leaf:.25},
 eucalyptus:{outer:5,leaders:2,leaf:.24},
 birch:{outer:5,leaders:2,leaf:.23},
 willow:{outer:5,leaders:2,leaf:.18},
 rowan:{outer:4,leaders:2,leaf:.21},
 hazel:{outer:5,leaders:3,leaf:.26},
 elftree:{outer:7,leaders:3,leaf:.20},
 worldtree:{outer:8,leaders:3,leaf:.20}
};
function build(spec,base){
 const cfg=profiles[spec.id],id=spec.id,m=new TDNewPlants.MeshRecipe(326731+TDTreeCanopies.specs.indexOf(spec)*719),R=m.R,f=base.fit,H=f.target[1][1],C=spec.shrub?.08:id==='worldtree'?3.6:id==='elftree'?2.65:2.15,gap=H-C,radius=Math.sqrt((f.target[1][0]-f.target[0][0])*(f.target[1][2]-f.target[0][2]))*.5,parts=[],paths=[],clumps=[],joints=[],G=[],AX=[];
 m.tree=true;let emission=0;const tri=m.tri.bind(m);m.tri=(...args)=>{const first=m.P.length/3;tri(...args);for(let i=first;i<m.P.length/3;i++)G[i]=emission;};
 const cells={broad:[0,0,256,256],fine:[256,0,256,256],blossom:[256,384,256,128],bark:[768,0,128,256],white:[896,0,128,256]};
 m.uv=(cell,u=.5,v=.5)=>{const q=cells[cell]||cells.broad;return[(q[0]+3+u*(q[2]-6))/1024,(q[1]+3+v*(q[3]-6))/512];};
 const fit=p=>[p[0]*(p[0]>=0?f.target[1][0]/f.high[0]:f.target[0][0]/f.low[0]),f.target[0][1]+(p[1]-f.low[1])*base.scale[1],p[2]*(p[2]>=0?f.target[1][2]/f.high[2]:f.target[0][2]/f.low[2])],unfit=p=>[p[0]/(p[0]>=0?f.target[1][0]/f.high[0]:f.target[0][0]/f.low[0]),f.low[1]+(p[1]-f.target[0][1])/base.scale[1],p[2]/(p[2]>=0?f.target[1][2]/f.high[2]:f.target[0][2]/f.low[2])];
 const trunks=base.woodPaths.filter(p=>p.role==='trunk'),axes=trunks.map(t=>t.points.map(fit));
 function stem(y,k=0){const points=axes[k%axes.length],t=trunks[k%trunks.length];let j=1;while(j<points.length-1&&points[j][1]<y)j++;const u=Math.max(0,Math.min(1,(y-points[j-1][1])/(points[j][1]-points[j-1][1])));return{p:V(points[j-1]).lerp(V(points[j]),u).toArray(),r:mix(t.radii[j-1],t.radii[j],u)*Math.min(Math.abs(f.target[1][0]/f.high[0]),Math.abs(f.target[1][2]/f.high[2]))};}
 function at(path,t){const D=[0];for(let j=1;j<path.points.length;j++)D.push(D[j-1]+V(path.points[j]).distanceTo(V(path.points[j-1])));const d=t*D.at(-1);let j=1;while(j<D.length-1&&D[j]<d)j++;const u=(d-D[j-1])/(D[j]-D[j-1]);return{p:V(path.points[j-1]).lerp(V(path.points[j]),u).toArray(),w:mix(path.from,path.to,t),r:mix(path.radii[j-1],path.radii[j],u)};}
 function branch(points,radii,sides,from,to,tier,parent=-1,attachment=1,stemIndex=0){
  const axis=parent<0?stemIndex%axes.length:paths[parent].axis,D=[0];for(let i=1;i<points.length;i++)D.push(D[i-1]+V(points[i]).distanceTo(V(points[i-1])));
  const p={role:'branch',points,radii,sides,from,to,tier,parent,attachment,axis,pointWeights:D.map(d=>mix(from,to,d/D.at(-1)))};paths.push(p);if(parent>=0)joints.push({parent,child:paths.length-1,attachment});return paths.length-1;
 }
 function emitBranch(path){
  const points=path.canonicalPoints,radii=path.radii.map(r=>r*Math.min(...scales,sy)),sides=path.sides,first=m.P.length/3;
  m.tube(points,radii,sides,0x9f8c70,'bark',false);const hidden=first+(points.length-1)*sides*6;for(const [a,w]of[[m.P,3],[m.N,3],[m.C,3],[m.U,2],[m.W,1],[G,1]])a.splice(hidden*w,sides*3*w);const body=(points.length-1)*sides*6,v0=m.uv('bark',0,0)[1],dv=m.uv('bark',0,1)[1]-v0,D=[0];for(let j=1;j<points.length;j++)D.push(D[j-1]+V(points[j]).distanceTo(V(points[j-1])));
  for(let i=first;i<m.P.length/3;i++){
   const k=i-first;if(k<body){const segment=Math.floor(k/(sides*6)),u=(m.U[i*2+1]-v0)/dv,t=(D[segment]+u*(D[segment+1]-D[segment]))/D.at(-1),p=V(m.P.slice(i*3,i*3+3)),a=V(points[segment]),d=V(points[segment+1]).sub(a),q=a.clone().addScaledVector(d,Math.max(0,Math.min(1,p.clone().sub(a).dot(d)/d.lengthSq()))),n=p.sub(q);if(n.lengthSq()>1e-12)m.N.splice(i*3,3,...n.normalize().toArray());m.U[i*2+1]=m.uv('bark',0,t)[1];m.W[i]=mix(path.pointWeights[segment],path.pointWeights[segment+1],u);}
   else{const end=true;m.U.splice(i*2,2,...m.uv('bark',.5,.5));m.W[i]=end?path.to:path.from;}
  }
  path.first=first;path.count=m.P.length/3-first;parts.push({role:'branch',first,count:path.count});
 }
 function cluster(p,rx,rz,thickness,w,heading,pitch,roll,support=null){
  const first=m.P.length/3,low=new T.Color(spec.low).toArray(),high=new T.Color(spec.high).toArray(),exposure=Math.max(0,Math.min(1,(p[1]-C)/gap)),outside=Math.min(1,Math.hypot(p[0],p[2])/(radius*.8)),groupRotation=new T.Quaternion().setFromEuler(new T.Euler(pitch*.45,heading,roll,'YXZ')),phase=R()*6.28;
  for(let spray=0;spray<(id==='willow'?7:5);spray++){
   const theta=phase+spray*2.399963+(R()-.5)*.5,phi=spray<2?.25+R()*.65:.85+R()*1.4,spot=V([Math.cos(theta)*Math.sin(phi)*rx*.45,Math.cos(phi)*thickness*.50,Math.sin(theta)*Math.sin(phi)*rz*.45]),outward=V([Math.cos(theta)*Math.sin(phi),.15+Math.cos(phi)*.85,Math.sin(theta)*Math.sin(phi)]).normalize(),face=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,0,1),outward),turn=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),R()*6.28),rotation=groupRotation.clone().multiply(face).multiply(turn),node=support?at(support,id==='willow'?.03+spray*.16:.12+spray*.215):null,center=spot.multiplyScalar(support?.25:1).applyQuaternion(groupRotation).add(V(node?node.p:p)),points=[],coords=[],normal=new T.Vector3(0,0,1).applyQuaternion(rotation),begin=m.P.length/3,size=id==='willow'?.50+R()*.14:.57+R()*.15;
   if(Math.abs(normal.y)<.38){const safe=normal.clone();safe.y=(normal.y<0?-1:1)*.52;safe.normalize();rotation.premultiply(new T.Quaternion().setFromUnitVectors(normal,safe));normal.copy(safe);}
   for(let y=0;y<2;y++)for(let x=0;x<2;x++){const u=x*2-1,v=y*2-1,z=0;points.push(V([u*rx*size,v*rz*size,z]).applyQuaternion(rotation).add(center).toArray());coords.push([x,y]);}
   const mirror=R()<.5,quarter=Math.floor(R()*4),uv=i=>{const q=coords[i],u=(q[0]-.5)*(mirror?-1:1),v=q[1]-.5,xy=quarter===0?[u,v]:quarter===1?[-v,u]:quarter===2?[-u,-v]:[v,-u];return m.uv(spec.cell||'broad',.5+xy[0],.5+xy[1]);};
   // Atlas alpha has a known empty border. Keep eight source texels as a filtering guard.
   const crop=spec.cell==='blossom'?[0,0,1,1]:spec.cell==='fine'?[.052,0,.908,.96]:[.044,0,1,.964],inverse=(u,v)=>{u-=.5;v-=.5;const q=quarter===0?[u,v]:quarter===1?[v,-u]:quarter===2?[-u,-v]:[-v,u];return[.5+q[0]*(mirror?-1:1),.5+q[1]];},box=[inverse(crop[0],crop[1]),inverse(crop[2],crop[1]),inverse(crop[0],crop[3]),inverse(crop[2],crop[3])],x0=Math.min(...box.map(p=>p[0])),x1=Math.max(...box.map(p=>p[0])),y0=Math.min(...box.map(p=>p[1])),y1=Math.max(...box.map(p=>p[1]));
   for(let j=0;j<4;j++){const q=[j%2?x1:x0,j<2?y0:y1],u=q[0]*2-1,v=q[1]*2-1;coords[j]=q;points[j]=V([u*rx*size,v*rz*size,0]).applyQuaternion(rotation).add(center).toArray();}
   m.tri(points[0],points[1],points[2],[uv(0),uv(1),uv(2)],0xffffff,normal.toArray());m.tri(points[1],points[3],points[2],[uv(1),uv(3),uv(2)],0xffffff,normal.toArray());
   const shade=(.84+.10*outside+.06*exposure)*(.94+R()*.12);
   for(let i=begin;i<m.P.length/3;i++){const d=V(m.P.slice(i*3,i*3+3)).sub(V(p)),radial=V([d.x/(rx*rx),d.y/(thickness*thickness),d.z/(rz*rz)]).normalize(),surface=normal.clone().multiplyScalar(.65).addScaledVector(radial,.35).add(new T.Vector3(0,normal.y<0?-.28:.28,0)).normalize(),tone=.23+.48*exposure+Math.cos(phi)*.06,tint=low.map((v,k)=>mix(v,high[k],Math.max(0,Math.min(1,tone)))),peak=Math.max(...tint);if(surface.y*normal.y<0)surface.y*=-1;surface.normalize();m.N.splice(i*3,3,...surface.toArray());m.C.splice(i*3,3,...tint.map(v=>v/peak*(.56+.26*exposure)*shade));m.W[i]=node?node.w:w;AX[i]=support?.axis||0;}
   // Consume the original random draws, then omit an overlapping middle spray. Woody structure remains deterministic.
   if(id!=='willow'&&spray===2){const count=m.P.length/3-begin;for(const [a,w]of[[m.P,3],[m.N,3],[m.C,3],[m.U,2],[m.W,1],[G,1],[AX,1]])a.splice(begin*w,count*w);}
  }
  parts.push({role:'foliage',first,count:m.P.length/3-first});clumps.push({first,count:m.P.length/3-first,center:p,weight:w,rx,rz,rise:thickness,pitch,roll,axis:support?.axis||0});
 }
 function leaves(path,fraction,scale=1){const q=at(path,fraction),v=V(path.points.at(-1)).sub(V(path.points[0])),heading=Math.atan2(v.z,v.x)+Math.PI/2,size=radius*cfg.leaf*(.78+R()*.35)*scale,pendulous=id==='willow',narrow=['willow','eucalyptus','islandash','olive'].includes(id),pitch=pendulous?1.05+(R()-.5)*.3:(R()-.5)*.65,roll=(R()-.5)*.60,p=q.p.slice();if(!spec.shrub&&Math.hypot(p[0],p[2])<.65&&p[1]<2.7)return;cluster(p,size,narrow?size*.58:size*(.78+R()*.27),size*(pendulous?.75:.60),q.w,heading,pitch,roll,path);}
 const levels=id==='hazel'?[.36,.49,.42,.53,.39]:id==='maple'?[.25,.44,.32,.52,.29]:id==='eucalyptus'?[.29,.61,.42,.73,.48]:id==='birch'?[.30,.53,.40,.65,.46]:id==='willow'?[.60,.65,.58,.69,.61]:[.30,.48,.39,.57,.34,.52,.42,.55];
 const primaryCount=cfg.outer+cfg.leaders;
 for(let j=0;j<primaryCount;j++){
  const leader=j>=cfg.outer,k=leader?j-cfg.outer:j,a=(leader?k*Math.PI*2/cfg.leaders+.8:j*Math.PI*2/cfg.outer)+.20+(R()-.5)*.35,centreRadius=radius*(leader?.16+R()*.12:(id==='willow'?.32:.34)+R()*.10),centreY=C+gap*(leader?(id==='hazel'?.52+R()*.18:.66+R()*.17):levels[j%levels.length]),centre=[Math.cos(a)*centreRadius,centreY,Math.sin(a)*centreRadius],pods=[],count=leader?8:12+(j%3===0?1:0);
  for(let k=0;k<count;k++){const angle=R()*Math.PI*2,d=Math.sqrt(R())*radius*(leader?.19:.32);pods.push([centre[0]+Math.cos(angle)*d,Math.max(C+.20,centreY+(R()-.5)*gap*(leader?.20:id==='maple'?.20:.34)),centre[2]+Math.sin(angle)*d]);}
  const requestedY=spec.shrub?.12+R()*.25:leader?C+gap*.14:C+gap*([.30,.08,.27,.16,.36,.06,.25,.12][j%8]),anchor=stem(requestedY,j),y=anchor.p[1],fork=[centre[0]*.76,centreY+gap*(leader?-.04:.035),centre[2]*.76],r=Math.min(anchor.r*.72,Math.max(.035,H*.020)),points=[anchor.p,[mix(anchor.p[0],fork[0],.28),mix(y,fork[1],.52)+gap*.04,mix(anchor.p[2],fork[2],.28)],[mix(anchor.p[0],fork[0],.69),mix(y,fork[1],.92)+gap*.035,mix(anchor.p[2],fork[2],.69)],fork],pw=.54+R()*.07,pi=branch(points,[r,r*.82,r*.53,r*.24],5,0,pw,'primary',-1,1,j);
  // Split neighbouring twig fans by azimuth, not by height: height bins produced artificial shelves.
  pods.sort((u,v)=>Math.atan2(u[2]-centre[2],u[0]-centre[0])-Math.atan2(v[2]-centre[2],v[0]-centre[0]));
  for(let k=0;k<2;k++){
   const group=pods.slice(k*Math.ceil(pods.length/2),(k+1)*Math.ceil(pods.length/2));if(!group.length)continue;
   const attach=id==='willow'?(k?.75:.40):(k?.68:.94),q=at(paths[pi],attach),centre=group.reduce((sum,p)=>sum.add(V(p)),new T.Vector3()).multiplyScalar(1/group.length).toArray(),mid=V(q.p).lerp(V(centre),.52).add(V([Math.cos(a+.4)*radius*.025,gap*.035,Math.sin(a+.4)*radius*.025])).toArray(),sw=.78+R()*.05,si=branch([q.p,mid,centre],[q.r*.66,q.r*.38,.010],4,q.w,sw,'secondary',pi,attach);
   for(let t=0;t<group.length;t++){
    const fraction=.14+t/group.length*.80,start=at(paths[si],fraction),end=group[t].slice(),tw=.93+R()*.06;
    if(id==='willow'&&!leader&&t%3!==0){end[1]=Math.max(C+.14,centreY-gap*(.27+R()*.27));end[0]+=Math.cos(a)*radius*.08;end[2]+=Math.sin(a)*radius*.08;}
    else if(id==='birch'&&t%3===0)end[1]-=gap*.10;
    const bend=V(start.p).lerp(V(end),.48).add(V([Math.cos(a)*radius*.035,id==='willow'&&!leader?gap*.06:gap*.012,Math.sin(a)*radius*.035])).toArray(),ti=branch([start.p,bend,end],[Math.max(.007,start.r*.45),Math.max(.005,start.r*.24),.003],3,start.w,tw,'terminal',si,fraction);
    leaves(paths[ti],.80,leader?.96:1);
    if((id==='rowan'||id==='elftree')&&t===0&&k===1){const p=end.slice();p[1]-=radius*.045;const first=m.P.length/3;emission=id==='elftree'?.45:0;m.berry(p,radius*(id==='elftree'?.022:.026),id==='elftree'?0x9dd6c7:0xb45c40);emission=0;for(let i=first;i<m.P.length/3;i++){m.W[i]=tw;AX[i]=paths[ti].axis;}parts.push({role:'detail',first,count:m.P.length/3-first});}
   }
  }
 }
 // Fit new crown only. Each woody attachment stays on the unmodified stem axis.
 let high=-Infinity;for(let i=1;i<m.P.length;i+=3)high=Math.max(high,m.P[i]);const sy=(H-C)/(high-C),ny=y=>C+(y-C)*sy,scales=[Infinity,Infinity,Infinity,Infinity];
 for(let i=0;i<m.P.length;i+=3){const p=m.P.slice(i,i+3),old=stem(p[1],AX[i/3]).p,axis=stem(ny(p[1]),AX[i/3]).p;for(const [k,slot]of[[0,0],[2,2]]){const d=p[k]-old[k];if(Math.abs(d)<1e-9)continue;const index=slot+(d>=0?0:1),target=d>=0?f.target[1][k]:f.target[0][k];scales[index]=Math.min(scales[index],(target-axis[k])/d);}}
 const normalise=(p,k=0)=>{const old=stem(p[1],k).p,axis=stem(ny(p[1]),k).p,dx=p[0]-old[0],dz=p[2]-old[2];return[axis[0]+dx*scales[dx>=0?0:1],ny(p[1]),axis[2]+dz*scales[dz>=0?2:3]];};
 for(let i=0;i<m.P.length;i+=3){const p=m.P.slice(i,i+3),axis=stem(p[1],AX[i/3]).p,sx=scales[p[0]>=axis[0]?0:1],sz=scales[p[2]>=axis[2]?2:3];m.P.splice(i,3,...normalise(p,AX[i/3]));m.N.splice(i,3,...new T.Vector3(m.N[i]/sx,m.N[i+1]/sy,m.N[i+2]/sz).normalize().toArray());}
 // Leaf normals must follow the actual fitted face: DoubleSide flips back-facing normals in both renderers.
 for(const part of parts.filter(p=>p.role==='foliage'))for(let j=part.first;j<part.first+part.count;j+=3){const a=V(m.P.slice(j*3,j*3+3)),b=V(m.P.slice((j+1)*3,(j+1)*3+3)),c=V(m.P.slice((j+2)*3,(j+2)*3+3)),face=b.sub(a).cross(c.sub(a)).normalize();for(let i=j;i<j+3;i++){const n=face.clone().multiplyScalar(.8).addScaledVector(V(m.N.slice(i*3,i*3+3)),.2);if(n.y*face.y<0)n.y*=-1;m.N.splice(i*3,3,...n.normalize().toArray());}}
 // Finalise the skeleton before emitting wood. Fitting a tube first bent its centreline away from child joints.
 for(const path of paths){
  path.canonicalPoints=path.points.map(q=>normalise(q,path.axis));
  if(path.parent>=0){const parent=paths[path.parent],D=[0];for(let k=1;k<parent.points.length;k++)D.push(D[k-1]+V(parent.points[k]).distanceTo(V(parent.points[k-1])));const d=path.attachment*D.at(-1);let k=1;while(k<D.length-1&&D[k]<d)k++;const t=(d-D[k-1])/(D[k]-D[k-1]);path.parentSegment=k-1;path.parentFraction=t;path.canonicalPoints[0]=V(parent.canonicalPoints[k-1]).lerp(V(parent.canonicalPoints[k]),t).toArray();}
 }
 for(const path of paths)emitBranch(path);
 const P=[],N=[],K=[],U=[],W=[],I=[],E=[],all=[];function vertex(p,n,c,u,w,e){P.push(...p);N.push(...n);K.push(...c);U.push(...u);W.push(w,w);E.push(e);I.push(I.length);}
 for(const part of base.parts.filter(p=>p.role==='root'||p.role==='trunk')){const first=I.length;for(const i of base.triangles.slice(part.first,part.first+part.count))vertex(base.positions.slice(i*3,i*3+3),base.normals.slice(i*3,i*3+3),base.colors.slice(i*3,i*3+3),base.uv.slice(i*2,i*2+2),base.motionWeights[i*2],base.glow?.[i]||0);all.push({role:part.role,first,count:I.length-first});}
 const offset=I.length;for(let i=0;i<m.P.length/3;i++)vertex(m.P.slice(i*3,i*3+3),m.N.slice(i*3,i*3+3),m.C.slice(i*3,i*3+3),m.U.slice(i*2,i*2+2),m.W[i],G[i]||0);all.push(...parts.map(p=>({...p,first:p.first+offset})));
 const skeleton=paths.map(p=>({...p,first:p.first+offset,canonicalPoints:p.canonicalPoints,points:p.canonicalPoints.map(unfit)})),structure={version:2,primaryBranches:primaryCount,secondaryBranches:paths.filter(p=>p.tier==='secondary').length,terminalTwigs:paths.filter(p=>p.tier==='terminal').length,leafClumps:clumps.length,stemAxes:axes,joints:joints.map(j=>({...j,segment:paths[j.child].parentSegment,fraction:paths[j.child].parentFraction})),skeleton:skeleton.map(p=>({tier:p.tier,parent:p.parent,attachment:p.attachment,axis:p.axis,points:p.canonicalPoints,weights:p.pointWeights,from:p.from,to:p.to})),leafGroups:clumps.map(c=>({center:normalise(c.center,c.axis),weight:c.weight,pitch:c.pitch,roll:c.roll}))};
 return{...base,positions:P,normals:N,colors:K,uv:U,motionWeights:W,triangles:I,glow:E.some(x=>x>0)?E:null,parts:all,woodPaths:[...trunks,...skeleton],branches:skeleton,clumps:clumps.map(c=>({...c,first:c.first+offset,center:unfit(normalise(c.center,c.axis))})),structure};
}
window.TDBroadleafStructure={build:(spec,base)=>enabled.has(spec.id)?build(spec,base):base,enabled,profiles};
})();

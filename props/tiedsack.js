TDProps.add({id:'tiedsack',name:'結んだ物資袋',r:.30,min:1,sc:[.8,1.2],slope:.2,vis:.37,anyGround:true,tags:['ruins','castle'],height:.64,groundSink:.002,material:'carved',build(){
 const {mat4,col,makeGeo}=TDGeo,{tube,mesh}=TDSmallParts,{part,fibre}=TDPracticalParts,p=[];
 // 口の外縁から薄い折り返しを通り、結びの内側まで一枚の閉じた布として戻す。面数と胴・紐は維持する。
 const levels=[[0,.225,.178],[.035,.274,.211],[.115,.30,.235],[.255,.292,.230],[.385,.250,.205],[.465,.169,.142],[.52,.065,.06],[.590,.082,.068],[.64,.095,.077],[.634,.089,.071],[.530,.055,.050]],N=24,v=[],ix=[];
 // 荷重を受ける底から絞りへ連続する布。寄せた部分だけ深く細かい折れを付ける。
 for(let k=0;k<levels.length;k++){
  const[y,rx,rz]=levels[k],fold=y<.35?.014:y<.52?.075:.14;
  for(let j=0;j<N;j++){const a=j/N*Math.PI*2,wrap=x=>Math.atan2(Math.sin(x),Math.cos(x)),t=Math.min(1,y/.52),f=1+fold*Math.cos(a*5+.35+(k===9?8:k===10?6:k)*.06)+.018*Math.sin(a*2+.6)*(1-t)-.11*Math.exp(-(wrap(a-1.1)**2)/.09)*Math.exp(-(((y-.39)/.12)**2))-.08*Math.exp(-(wrap(a+1.4)**2)/.12)*Math.exp(-(((y-.41)/.10)**2)),top=k===8||k===9?-.040*(.5+.5*Math.cos(a+.5)):k===7?-.020*(.5+.5*Math.cos(a+.5)):0;v.push([Math.cos(a)*rx*f+.007*Math.sin(y*5),y+top,Math.sin(a)*rz*f+.008*Math.sin(a+1.1)*Math.sin(t*Math.PI)]);}
 }
 for(let k=1;k<levels.length;k++)for(let j=0;j<N;j++){const a=(k-1)*N+j,b=(k-1)*N+(j+1)%N;ix.push(a,a+N,b,b,a+N,b+N);}
 for(const k of [0,levels.length-1]){const c=v.length;v.push([k?.007:0,k?.528:0,0]);for(let j=0;j<N;j++){const n=(j+1)%N;if(k)ix.push(c,k*N+n,k*N+j);else ix.push(c,j,n);}}
 const body=mesh(v,ix),bodyNormal=body.toNonIndexed().attributes.normal;p.push({...part(body,undefined,fibre),j:.006});
 const bound=[];for(let j=0;j<=12;j++){const a=j/12*Math.PI*2;bound.push([Math.cos(a)*.071,.52,Math.sin(a)*.065]);}
 const rope=()=>col(0x8d7752);
 p.push(part(tube(bound,bound.map(()=>.010),4),undefined,rope));
 p.push(part(tube([[.06,.52,.025],[.10,.536,.035],[.12,.515,.04],[.084,.496,.04],[.06,.52,.025]],[.009,.009,.009,.009,.009],4),undefined,rope));
 for(const points of [[[.085,.505,.04],[.13,.47,.065],[.145,.425,.075]],[[.075,.51,.045],[.045,.475,.10],[.035,.445,.13]]])p.push(part(tube(points,[.009,.009,.006],4),undefined,rope));
 const g=makeGeo(p,804,{ao:.10,smooth:38}),pos=g.attributes.position,c=g.attributes.color;for(let i=0;i<bodyNormal.count;i++)g.attributes.normal.setXYZ(i,bodyNormal.getX(i),bodyNormal.getY(i),bodyNormal.getZ(i));
 // 布面の折れは実照明で読む。各面へ焼いた明暗の帯を重ねない。
 for(let i=0;i<pos.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(pos,i),b=new THREE.Vector3().fromBufferAttribute(pos,i+1),v=new THREE.Vector3().fromBufferAttribute(pos,i+2),ny=b.sub(a).cross(v.sub(a)).normalize().y,k=.74+.36*Math.max(ny,-.4);for(let j=i;j<i+3;j++)c.setXYZ(j,c.getX(j)/k,c.getY(j)/k,c.getZ(j)/k);}return TDFibreFinish.cloth(g);
}});

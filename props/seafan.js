// ウミウチワ1種だけの不透明な網目メッシュ。共通生成・配置方式は変えない。
TDProps.add({
 id:'seafan',name:'ウミウチワ',r:.15,min:1.2,sc:[.6,1.3],slope:.7,vis:.6,anyGround:true,water:[.4,3],sway:.25,tags:['beach'],height:1.1,surface:'seafan-net-v1',
 build(){
  const {rng,col,mixc,mat4,displace,makeGeo,hash2}=TDGeo,R=rng(37),parts=[],stem=[0,.14],SPAN=2.3,LEN=.86,outline=[[0,.14]],P=[];
  const raw=Array.from({length:29},(_,k)=>LEN*(.88+.12*Math.sin(k*1.7)*Math.sin(k*.6+1)));const arc=raw.map((_,k)=>{const r=[.1,.2,.4,.2,.1].reduce((v,w,j)=>v+w*raw[Math.max(0,Math.min(28,k+j-2))],0),a=(k/28-.5)*SPAN;return new THREE.Vector3(Math.sin(a)*r*1.05,.14+Math.cos(a)*r*.95,0);});const curve=new THREE.CatmullRomCurve3(arc,false,'catmullrom',.35);for(const v of curve.getPoints(56))outline.push([v.x,v.y]);const minX=Math.min(...outline.map(p=>p[0])),maxX=Math.max(...outline.map(p=>p[0])),maxY=Math.max(...outline.map(p=>p[1]));for(const p of outline){p[0]*=p[0]<0?-.7903497219/minX:.7646304369/maxX;p[1]=.14+(p[1]-.14)*(.9402480721-.14)/(maxY-.14);}
  const inside=([x,y])=>{let hit=false;for(let i=0,j=outline.length-1;i<outline.length;j=i++){const a=outline[i],b=outline[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
  const cross=(a,b)=>a[0]*b[1]-a[1]*b[0],sub=(a,b)=>[a[0]-b[0],a[1]-b[1]],lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],z=([x,y])=>.006*x+.004*(y-.14);
  // Clip every small branch to the same outline. Shared node keys avoid disconnected seams.
  const clip=(a,b)=>{const d=sub(b,a),cuts=[0,1];for(let i=0;i<outline.length;i++){const q=outline[i],e=sub(outline[(i+1)%outline.length],q),den=cross(d,e);if(Math.abs(den)<1e-10)continue;const v=sub(q,a),t=cross(v,e)/den,u=cross(v,d)/den;if(t>0&&t<1&&u>=0&&u<=1)cuts.push(t);}cuts.sort((a,b)=>a-b);const result=[];for(let i=1;i<cuts.length;i++)if(cuts[i]-cuts[i-1]>1e-6&&inside(lerp(a,b,(cuts[i]+cuts[i-1])/2)))result.push([lerp(a,b,cuts[i-1]),lerp(a,b,cuts[i])]);return result;};
  const shape=new THREE.Shape();shape.moveTo(...outline[0]);for(const p of outline.slice(1))shape.lineTo(...p);shape.closePath();const front=new THREE.ShapeGeometry(shape),pos=front.attributes.position;
  for(let i=0;i<pos.count;i++)pos.setZ(i,z([pos.getX(i),pos.getY(i)])+.0015);
  const back=front.clone(),bp=back.attributes.position,bi=back.index;for(let i=0;i<bp.count;i++)bp.setZ(i,bp.getZ(i)-.003);for(let i=0;i<bi.count;i+=3){const a=bi.getX(i+1);bi.setX(i+1,bi.getX(i+2));bi.setX(i+2,a);}
  const membrane=(y,ny,Rr)=>mixc(col(0xc6a0c8),col(0xe0c3db),.24+Math.min(1,y)*.35);parts.push({g:front,m:new THREE.Matrix4(),cfn:membrane,j:.02},{g:back,m:new THREE.Matrix4(),cfn:membrane,j:.02});const sheetVertices=(front.index.count+back.index.count);
  const rod=(a,b,w,sides=5)=>{const points=[a.length===3?a:[...a,z(a)],b.length===3?b:[...b,z(b)]];parts.push({g:TDSmallParts.tube(points,[w*.8,w*.65],sides,.625),m:new THREE.Matrix4(),cfn:()=>mixc(col(0x9450a6),col(0xc68bd0),.3),j:.035});};
  rod([0,0,0],[...stem,z(stem)],.05);
  const branch=(points,radii,sides=6)=>parts.push({g:TDSmallParts.tube(points.map(p=>[...p,z(p)]),radii,sides,.8),m:new THREE.Matrix4(),cfn:()=>mixc(col(0x9c68ab),col(0xc99bc9),.45),j:.025});
  for(let k=0;k<5;k++){const ang=(k/4-.5)*SPAN*.87+(R()-.5)*.08,len=LEN*(.75+R()*.15),points=[stem],radii=[.020];let prev=stem;for(let j=1;j<=4;j++){const t=j/4,a=ang*(.4+.6*t),pt=[Math.sin(a)*len*t*1.05,.14+Math.cos(a)*len*t*.95],cl=clip(prev,pt);if(cl.length){points.push(cl[0][1]);radii.push(.020*(1-t)+.003);}prev=pt;}branch(points,radii);
   for(const side of[-1,1]){const from=points[side<0?2:3],a=ang+side*(.16+R()*.07),goal=[Math.sin(a)*LEN*.96*1.05,.14+Math.cos(a)*LEN*.96*.95],cl=clip(from,goal);if(cl.length){const end=lerp(cl[0][0],cl[0][1],.94),mid=lerp(from,end,.5);mid[0]+=.018*Math.sin(k*3+side);branch([from,mid,end],[.007,.0045,.0018],4);}}
  }
  const rim=outline.concat([outline[0]]);branch(rim,rim.map(()=>.003),3);
  parts.push({g:displace(new THREE.IcosahedronGeometry(.13,1),.3,2),m:mat4(0,.02,0,1.3,.5,1.1),cfn:(y,ny,Rr)=>mixc(col(0x6f3a7a),col(0x8a8378),Rr()),j:.1});
  const g=makeGeo(parts,37);const uv=new Float32Array(g.attributes.position.count*2);for(let i=0;i<g.attributes.position.count;i++){const p=g.attributes.position;uv[i*2]=i<sheetVertices?1/8+(p.getX(i)+.81)/1.60*(7/8-2/256)+1/256:1/16;uv[i*2+1]=i<sheetVertices?(.96-p.getY(i))/.84*(1-2/256)+1/256:.5;}g.setAttribute('uv',new THREE.BufferAttribute(uv,2));g.userData.seafanNet={cutout:true,frontBackXYAligned:true,sheetVertices};return g;
 }
});

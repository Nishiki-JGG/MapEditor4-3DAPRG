// かまくら（kamakura）
TDProps.add({
  id: 'kamakura', name: 'かまくら',
  r: 1.3, min: 4, sc: [.9, 1.1], slope: .3, vis: 1.5, anyGround: true, light: [0xffb060, 10, .4],
  tags: ['snow'], height: 1.19, material: 'snow',
  build() {
    const {col,mixc,mat4,makeGeo}=TDGeo,{mesh}=TDSmallParts;
    const snow=()=>mixc(col(0xdce6f0),col(0xffffff),.68),lining=()=>col(0x8e9ba9),outer=[[-.5,0]],inner=[[-.4,0]];
    for(let k=0;k<=10;k++){const a=Math.PI-k*Math.PI/10;outer.push([Math.cos(a)*.5,.45+Math.sin(a)*.5]);inner.push([Math.cos(a)*.4,.43+Math.sin(a)*.38]);}outer.push([.5,0]);inner.push([.4,0]);
    // 入口の内側だけを前半球から抜く。既存の円衝突・歩行判定には接続しない。
    function opening(g){
      const source=g.index?g.toNonIndexed():g.clone(),a=source.attributes.position,vertices=[],planes=[p=>p[2]];
      for(let j=0;j<inner.length;j++){const p=inner[j],q=inner[(j+1)%inner.length];planes.push(v=>(q[1]-p[1])*(v[0]-p[0])-(q[0]-p[0])*(v[1]-p[1]));}
      function emit(poly){for(let j=1;j<poly.length-1;j++){const a=new THREE.Vector3(...poly[0]),b=new THREE.Vector3(...poly[j]),c=new THREE.Vector3(...poly[j+1]);if(b.sub(a).cross(c.sub(a)).lengthSq()>1e-18)vertices.push(...poly[0],...poly[j],...poly[j+1]);}}
      for(let i=0;i<a.count;i+=3){let poly=[0,1,2].map(k=>[a.getX(i+k),a.getY(i+k),a.getZ(i+k)]);if(planes.some(f=>poly.every(p=>f(p)<-1e-9))){emit(poly);continue;}
        for(const f of planes){if(poly.length<3)break;const inside=[],outside=[];for(let k=0;k<poly.length;k++){const p=poly[k],q=poly[(k+1)%poly.length],dp=f(p),dq=f(q);(dp>=-1e-9?inside:outside).push(p);if((dp>1e-9&&dq<-1e-9)||(dp<-1e-9&&dq>1e-9)){const t=dp/(dp-dq),v=p.map((x,j)=>x+(q[j]-x)*t);inside.push(v);outside.push(v);}}emit(outside);poly=inside;}
      }source.dispose();g.dispose();const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));return result;
    }
    const dome=new THREE.SphereGeometry(1.4,14,7,0,Math.PI*2,0,Math.PI/2);dome.scale(1,.85,1);
    const chamber=new THREE.SphereGeometry(1.15,14,5,0,Math.PI*2,0,Math.PI/2);chamber.scale(1,1.01/1.15,1);for(let k=0;k<chamber.index.count;k+=3){const a=chamber.index.getX(k);chamber.index.setX(k,chamber.index.getX(k+2));chamber.index.setX(k+2,a);}
    const parts=[{g:opening(dome),m:new THREE.Matrix4(),cfn:snow,j:.006,sn:[0,0,0],snw:1},{g:opening(chamber),m:new THREE.Matrix4(),cfn:lining,j:.006}];
    const v=[],face=[],skin=[],tunnel=[],n=outer.length;for(const z of [1.55,.5])for(const outline of [outer,inner])for(const[x,y]of outline)v.push([x,y,z]);
    for(let j=0;j<n-1;j++){const k=j+1;face.push(j,n+j,k,k,n+j,n+k);skin.push(j,k,2*n+j,k,2*n+k,2*n+j);tunnel.push(n+j,3*n+j,n+k,n+k,3*n+j,3*n+k);}
    parts.push({g:mesh(v,face),m:new THREE.Matrix4(),cfn:snow,j:.008},{g:mesh(v,skin),m:new THREE.Matrix4(),cfn:snow,j:.008},{g:mesh(v,tunnel),m:new THREE.Matrix4(),cfn:lining,j:.008});
    parts.push({g:new THREE.BoxGeometry(.2,.2,.2),m:mat4(.2,.15,.6,1,1,1),c:col(0xffb860),glow:2.4});
    return makeGeo(parts,87,{smooth:40});
  },
});

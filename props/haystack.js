// 干し草（haystack）
TDProps.add({
  id: 'haystack', name: '干し草',
  r: .7, min: 2, sc: [.8, 1.2], slope: .5, vis: .8,
  tags: ['grassland'], height: 1.69, material: 'cards2',
  build() {
    const {col,mixc,mat4,makeGeo,ATLAS2}=TDGeo,{mesh,tube}=TDSmallParts;
    const hay=(y,ny,R,pr)=>mixc(col(0xe1d4ac),col(0xf3e6c5),.3+pr*.25),N=16,v=[],uv=[],ix=[];
    // 別々の円錐と円筒を、一体の繊維束にする。束ねた腰から下へ広がる。
    const rings=[[0,.82],[.08,.86],[.34,.78],[.62,.69],[.83,.70],[1.03,.63],[1.25,.48],[1.45,.29],[1.62,.13],[1.69,.035]];
    for(let k=0;k<rings.length;k++)for(let j=0;j<=N;j++){
      const a=j/N*Math.PI*2,[y,r]=rings[k],w=1+.045*Math.sin(a*7+.3)+.018*Math.cos(a*11-k*.2),yy=y+(k&&k<rings.length-1?.018*Math.sin(a*5+k*.3):0);
      v.push([Math.cos(a)*r*w,yy,Math.sin(a)*r*w]);uv.push(j/N,y/1.69);
    }
    for(let k=1;k<rings.length;k++)for(let j=0;j<N;j++){const a=(k-1)*(N+1)+j,b=a+1;ix.push(a,a+N+1,b,b,a+N+1,b+N+1);}
    for(let j=1;j<N-1;j++)ix.push(0,j,j+1,(rings.length-1)*(N+1),(rings.length-1)*(N+1)+j+1,(rings.length-1)*(N+1)+j);
    let g=mesh(v,ix);g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    // Keep the bundle's shape; give the shared straw tile a metre-scale width.
    g=g.toNonIndexed();const u=g.attributes.uv;
    for(let i=0;i<(rings.length-1)*N*6;i+=3){const tile=Math.floor(Math.min(u.getX(i),u.getX(i+1),u.getX(i+2))*4+1e-6);for(let j=i;j<i+3;j++)u.setX(j,u.getX(j)*4-tile);}

    const parts=[{g,m:new THREE.Matrix4(),cfn:hay,uvr:ATLAS2.uvr('straw'),j:.015}];
    // 縛り縄は縮まった腰へ密着する。別の大きな輪を浮かせない。
    const points=[];for(let j=0;j<=N;j++){const a=j/N*Math.PI*2,r=.708*(1+.045*Math.sin(a*7+.3)+.018*Math.cos(a*11-.8));points.push([Math.cos(a)*r,.645+.014*Math.sin(a*2),Math.sin(a)*r]);}
    parts.push({g:tube(points,points.map(()=>.022),4),m:new THREE.Matrix4(),c:col(0x755936),j:.015});
    // 数本の連続した葉先だけで裾の輪郭をほぐす。大量の透過板は追加しない。
    for(let j=0;j<6;j++){const a=j*2.399,r=.83,c=Math.cos(a),s=Math.sin(a),q=[[c*r,.05,s*r],[c*(r+.055),.025,s*(r+.055)],[c*(r+.10),.002,s*(r+.10)]];parts.push({g:tube(q,[.012,.009,.002],3),m:new THREE.Matrix4(),cfn:hay,j:.02});}
    const result=makeGeo(parts,99,{ao:.18,smooth:45,uv:ATLAS2.white}),pos=result.attributes.position,c=result.attributes.color;
    for(let i=0;i<pos.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(pos,i),b=new THREE.Vector3().fromBufferAttribute(pos,i+1),v=new THREE.Vector3().fromBufferAttribute(pos,i+2),ny=b.sub(a).cross(v.sub(a)).normalize().y,k=.74+.36*Math.max(ny,-.4);for(let j=i;j<i+3;j++)c.setXYZ(j,c.getX(j)/k,c.getY(j)/k,c.getZ(j)/k);}
    return result;
  },
});

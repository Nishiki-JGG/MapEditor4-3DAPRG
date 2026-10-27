// 旗（banner）
TDProps.add({
  id: 'banner', name: '旗',
  r: .1, min: 2, sc: [.9, 1.1], slope: .6, vis: .5, anyGround: true, sway: .5,
  tags: ['castle'], height: 3.72, material:'carved',
  build() {
    const {col,mat4,makeGeo,WOOD_C}=TDGeo,{mesh,tube}=TDSmallParts;
    const p=[
      {g:new THREE.CylinderGeometry(.04,.05,3.6,8),m:mat4(0,1.8,0,1,1,1),cfn:WOOD_C,j:.02},
      {g:new THREE.SphereGeometry(.07,8,4),m:mat4(0,3.65,0,1,1,1),c:col(0xd8b040),j:.01},
      {g:new THREE.BoxGeometry(.06,.06,.9),m:mat4(0,3.4,.42,1,1,1),cfn:WOOD_C,j:.02}
    ];
    // 棒の位置・布の縦横寸法を維持。厚板を、重力方向に垂れる薄い閉じた布へ。
    const shape=(u,t)=>[.045*Math.sin(u*Math.PI*4+.2)*Math.sin(t*Math.PI*.8),3.37-1.30*t+.025*t*(1-Math.cos(u*Math.PI*2)),.05+.8*u];
    const v=[],ix=[],W=8,H=4,K=(W+1)*(H+1),epsilon=.003;
    for(const side of [-1,1])for(let y=0;y<=H;y++)for(let x=0;x<=W;x++){const q=shape(x/W,y/H);q[0]+=side*epsilon;v.push(q);}
    for(let y=0;y<H;y++)for(let x=0;x<W;x++){const a=y*(W+1)+x,b=a+1,c=a+W+1,d=c+1;ix.push(a,c,b,b,c,d,K+a,K+b,K+c,K+b,K+d,K+c);}
    const edge=[];for(let x=0;x<=W;x++)edge.push(x);for(let y=1;y<=H;y++)edge.push(y*(W+1)+W);for(let x=W-1;x>=0;x--)edge.push(H*(W+1)+x);for(let y=H-1;y>0;y--)edge.push(y*(W+1));
    for(let k=0;k<edge.length;k++){const a=edge[k],b=edge[(k+1)%edge.length];ix.push(a,b,a+K,b,b+K,a+K);}
    p.push({g:mesh(v,ix),m:new THREE.Matrix4(),c:col(0x9a1e24),j:.008});
    // 既存の菱形標章は布の折れに沿う薄い刺繍面へ。両面とも板を浮かせない。
    for(const side of [-1,1]){const diamond=[[.5,.245],[.64,.36],[.5,.475],[.36,.36]],vv=diamond.map(([u,t])=>{const q=shape(u,t);q[0]+=side*(epsilon+.001);return q;});p.push({g:mesh(vv,side<0?[0,2,1,0,3,2]:[0,1,2,0,2,3]),m:new THREE.Matrix4(),c:col(0xd8b040),j:0});}
    for(const z of [.14,.75])p.push({g:tube([[0,3.36,z],[-.034,3.40,z],[0,3.438,z],[.034,3.40,z],[0,3.36,z]],[.009,.009,.009,.009,.009],4),m:new THREE.Matrix4(),c:col(0x856849),j:0});
    const g=makeGeo(p,91,{smooth:35}),pos=g.attributes.position,c=g.attributes.color;
    // 光源による陰影へ一本化し、折れの面ごとに焼いた明暗の縞を除く。
    for(let i=0;i<pos.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(pos,i),b=new THREE.Vector3().fromBufferAttribute(pos,i+1),v=new THREE.Vector3().fromBufferAttribute(pos,i+2),ny=b.sub(a).cross(v.sub(a)).normalize().y,k=.74+.36*Math.max(ny,-.4);for(let j=i;j<i+3;j++)c.setXYZ(j,c.getX(j)/k,c.getY(j)/k,c.getZ(j)/k);}
    return g;
  },
});

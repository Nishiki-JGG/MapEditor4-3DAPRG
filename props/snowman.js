// 雪だるま（snowman）
TDProps.add({
  id: 'snowman', name: '雪だるま',
  r: .4, min: 2, sc: [.9, 1.2], slope: .5, vis: .6, anyGround: true,
  tags: ['snow'], height: 2.1, material: 'snow',
  build() {
    const {col,mixc,mat4,makeGeo}=TDGeo,{mesh}=TDSmallParts,parts=[];
    const snow=()=>mixc(col(0xe6eef7),col(0xffffff),.74),coal=()=>col(0x26272a);
    // 圧雪した広い足元と少し潰れた肩。元の三つの質量・帽子高・腕幅を保つ。
    function packed(rx,ry,rz,cy,seed){
      const ys=[-1,-.8,-.25,.35,.8],rs=[.15,.58,1,.94,.55],v=[],ix=[],n=12;
      for(let k=0;k<ys.length;k++)for(let j=0;j<n;j++){const a=j*Math.PI*2/n,f=1+.012*Math.sin(a*3+seed)*Math.sin((ys[k]+1)*Math.PI/2);v.push([Math.cos(a)*rx*rs[k]*f,ys[k]*ry,Math.sin(a)*rz*rs[k]*f]);if(k){const p=(k-1)*n+j,q=(k-1)*n+(j+1)%n,r=k*n+j,s=k*n+(j+1)%n;ix.push(p,r,q,q,r,s);}}
      const bottom=v.length;v.push([0,-ry,0]);const top=v.length;v.push([0,ry,0]);for(let j=0;j<n;j++){ix.push(bottom,j,(j+1)%n);const k=(ys.length-1)*n;ix.push(top,k+(j+1)%n,k+j);}
      parts.push({g:mesh(v,ix),m:mat4(0,cy,0,1,1,1),cfn:snow,j:.005,sn:[0,cy,0],snw:1});
    }
    packed(.5,.5,.48,.45,.3);packed(.37,.37,.35,1.12,1.2);packed(.27,.27,.26,1.62,2.3);
    const nose=[],noseIx=[];for(let k=0;k<6;k++)nose.push([Math.cos(k*Math.PI/3)*.05,-.15,Math.sin(k*Math.PI/3)*.05]);nose.push([0,.15,0],[0,-.15,0]);for(let k=0;k<6;k++)noseIx.push(k,6,(k+1)%6,7,(k+1)%6,k);
    parts.push({g:mesh(nose,noseIx),m:mat4(0,1.62,.38,1,1,1,0,Math.PI/2),c:col(0xf07a20),j:.015});
    for(const x of [-.09,.09])parts.push({g:new THREE.IcosahedronGeometry(.033,0),m:mat4(x,1.68,.241,1,.9,.50),cfn:coal,j:.02});
    parts.push({g:new THREE.CylinderGeometry(.2,.22,.3,8),m:mat4(0,1.95,0,1,1,1),cfn:coal,j:.01},{g:new THREE.CylinderGeometry(.265,.265,.035,12),m:mat4(0,1.8075,0,1,1,1),cfn:coal,j:.01});
    for(const sign of [-1,1])parts.push({g:new THREE.CylinderGeometry(.015,.02,.7,4),m:mat4(sign*.55,1.25,0,1,1,1,0,0,-sign),c:col(0x70533b),j:.015});
    return makeGeo(parts,86,{smooth:40});
  },
});

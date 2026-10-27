// 灯台（lighthouse）
TDProps.add({
  id: 'lighthouse', name: '灯台',
  r: 1.5, min: 6, sc: [.9, 1.1], slope: .4, vis: 1.8, anyGround: true, light: [0xfff0c0, 60, 7.5],
  tags: ['beach'], height: 8.48, material: 'carved',
  build() {
    const {col,mat4,displace,makeGeo}=TDGeo,parts=[];
    const red=col(0xb83a32),white=col(0xf0ede6),iron=col(0x35373a);
    parts.push({g:displace(new THREE.CylinderGeometry(1.6,1.8,.6,10),.08,2),m:mat4(0,.3,0,1,1,1),c:col(0x8a857c),j:.02});
    // 元の赤白4帯を、一つの連続した円錐台の面へ。内部に隠れた6枚の蓋を除く。
    const paint=(y,ny)=>{const c=Math.floor((y-.6)/1.6)%2?red:white,k=.74+.36*Math.max(ny,-.4);return c.map(v=>v/k);};
    parts.push({g:new THREE.CylinderGeometry(.59,1.15,6.4,20,4,true),m:mat4(0,3.8,0,1,1,1),cfn:paint,j:.008});
    parts.push({g:new THREE.CylinderGeometry(.85,.85,.12,14),m:mat4(0,7.06,0,1,1,1),c:iron,j:.01});
    parts.push({g:new THREE.CylinderGeometry(.5,.5,.8,10,1,true),m:mat4(0,7.52,0,1,1,1),c:col(0xfff2b8),glow:2.4,j:.01});
    // 灯室の十枚の面を支える柱。端面は上下の枠に隠れるため作らない。
    const bar=(w,h)=>{const g=new THREE.BoxGeometry(w,h,w),ix=[];for(const q of g.groups)if(q.materialIndex!==2&&q.materialIndex!==3)for(let i=q.start;i<q.start+q.count;i++)ix.push(g.index.getX(i));g.setIndex(ix);g.clearGroups();return g;};
    for(let j=0;j<10;j++){const a=j/10*Math.PI*2;parts.push({g:bar(.034,.80),m:mat4(Math.sin(a)*.50,7.52,Math.cos(a)*.50,1,1,1,a),c:iron,j:.01});}
    for(const[y,up]of [[7.13,true],[7.91,false]]){
      parts.push({g:new THREE.CylinderGeometry(.54,.54,.035,10,1,true),m:mat4(0,y,0,1,1,1),c:iron,j:.01});
      parts.push({g:new THREE.RingGeometry(.50,.54,10),m:mat4(0,y+(up?.0175:-.0175),0,1,1,1,0,up?-Math.PI/2:Math.PI/2),c:iron,j:.01});
    }
    parts.push({g:new THREE.ConeGeometry(.65,.55,10),m:mat4(0,8.2,0,1,1,1),c:red,j:.01});
    parts.push({g:new THREE.BoxGeometry(.4,.7,.06),m:mat4(0,1,1.12,1,1,1),c:col(0x3a2a1e),j:.02});
    return makeGeo(parts,75,{ao:.25,smooth:35});
  },
});

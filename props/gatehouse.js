// 城門（gatehouse）
TDProps.add({
  id: 'gatehouse', name: '城門',
  r: .75, offs: [-1.6, 1.6], min: 5, sc: [.9, 1.1], slope: .3, vis: 2.2, anyGround: true,
  tags: ['castle'], height: 4.64, material: 'carved',
  build() {
    const {col,mixc,mat4,makeGeo}=TDGeo,{bevelBox}=TDArchitectureParts;
    const parts=[],cf=(y,ny,R,pr)=>mixc(col(0x5e5c57),col(0xa8a59c),.25+pr*.35),iron=(y,ny,R)=>mixc(col(0x23252a),col(0x3e4148),.35);
    const block=(w,h,d,x,y,z=0)=>parts.push({g:bevelBox(w,h,d,.010),m:mat4(x,y,z,1,1,1),cfn:cf,j:.012});
    for(const sx of [-1.6,1.6]){
      // 芯は石材の端より十分内側へ。薄い端材の省略による黒い全面露出を防ぐ。
      parts.push({g:new THREE.BoxGeometry(1.04,4.18,1.20),m:mat4(sx,2.09,0,1,1,1),c:col(0x3e3c38),j:.01});
      for(let row=0;row<6;row++){
        const cuts=[sx-.6,sx+(row%2?.10:-.10),sx+.6];
        for(let k=0;k<2;k++)block(cuts[k+1]-cuts[k]-.020,.675,1.40,(cuts[k]+cuts[k+1])/2,.35+row*.7);
      }
      block(1.20,.08,1.42,sx,4.18);
      for(let k=0;k<2;k++)block(.40,.45,1.45,sx-.3+k*.6,4.42);
    }
    parts.push({g:new THREE.BoxGeometry(1.95,1.1,1.08),m:mat4(0,3.6,0,1,1,1),c:col(0x3e3c38),j:.01});
    for(let row=0;row<2;row++){
      const cuts=row?[-1.2,-.55,.15,1.2]:[-1.2,-.4,.4,1.2];
      for(let k=0;k<3;k++)block(cuts[k+1]-cuts[k]-.020,.525,1.26,(cuts[k]+cuts[k+1])/2,3.325+row*.55);
    }
    block(2.2,.12,1.3,0,4.2);
    // 吊り格子の位置と通り抜ける空間は元のまま。
    for(let k=0;k<7;k++)parts.push({g:new THREE.BoxGeometry(.05,.75,.05),m:mat4(-.84+k*.28,2.68,.3,1,1,1),cfn:iron,j:.01});
    parts.push({g:new THREE.BoxGeometry(1.9,.05,.05),m:mat4(0,2.6,.3,1,1,1),cfn:iron,j:.01});
    return makeGeo(parts,90,{ao:.8,smooth:35});
  },
});

// 折れた石柱（brokencol）
TDProps.add({
  id: 'brokencol', name: '折れた石柱',
  r: .5, min: 2, sc: [.8, 1.2], slope: .6, vis: 1, anyGround: true, shape: true,
  tags: ['ruins', 'desert', 'graveyard'], height: 1.83, material: 'stone',
  build() {
    const { mat4, displace, makeGeo, chisel, ribbed, RUIN_STONE, mixc, col } = TDGeo;
    const cf = RUIN_STONE;
    const parts = [
      { g: new THREE.BoxGeometry(1, .3, 1), m: mat4(0, .15, 0, 1, 1, 1, .2), cfn: cf },
      { g: chisel(displace(ribbed(new THREE.CylinderGeometry(.3, .38, 1.5, 16, 3), 16, .9), .05, 7), 2, 56, .85, .9), m: mat4(0, 1.05, 0, 1, 1, 1, 0, .04), cfn: cf },
      { g: displace(ribbed(new THREE.CylinderGeometry(.34, .34, .9, 16, 1), 16, .9), .04, 2), m: mat4(1.0, .34, .5, 1, 1, 1, .6, 0, Math.PI / 2), cfn: cf },
      { g: chisel(new THREE.IcosahedronGeometry(.18, 0), 3, 561, .6), m: mat4(-.6, .1, .5, 1, .7, 1), cfn: cf },
      { g: chisel(new THREE.IcosahedronGeometry(.13, 0), 3, 562, .6), m: mat4(-.3, .08, -.7, 1, .7, 1), cfn: cf },
      { g: displace(new THREE.IcosahedronGeometry(.25, 0), .4, 6), m: mat4(-.1, .3, .4, 1.4, .35, 1, 0), cfn: (...a) => mixc(cf(...a),col(0x58634d),.12), j: .1 },
    ];
    const geo=makeGeo(parts,56,{ao:.6}),colors=geo.attributes.color;
    // 衝突用の全頂点は維持。元からある端面の三角形に限って石の粒度と明暗を付ける。
    let start=0;
    parts.forEach((p,k)=>{
      if(k===1||k===2)for(const group of p.g.groups||[])if(group.materialIndex>0){
        for(let i=group.start;i<group.start+group.count;i+=3){const v=(i-group.start)/3,f=.82+.21*(.5+.5*Math.sin(v*2.37+k));
          for(let j=0;j<3;j++){const q=start+i+j;colors.setXYZ(q,colors.getX(q)*f,colors.getY(q)*f,colors.getZ(q)*f);}
        }
      }
      start+=p.g.index?p.g.index.count:p.g.attributes.position.count;
    });
    return geo;
  },
});

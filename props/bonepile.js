// 骨の山（bonepile）：散乱した長骨・頭骨・肋骨片。
TDProps.add({
  id: 'bonepile', name: '骨の山',
  r: .35, min: 1.4, sc: [.8, 1.4], slope: .8, vis: .6, anyGround: true,
  tags: ['demon', 'graveyard', 'cave'], height: .53,
  build() {
    const {makeGeo,BONE_C}=TDGeo,{longBone,tube,skull}=TDSmallParts,parts=[];
    const add=g=>parts.push({g,m:new THREE.Matrix4(),cfn:BONE_C,j:.025});
    [[[-.48,.08,-.22],[.34,.10,-.05]],[[-.36,.075,.34],[.30,.10,.20]],[[-.15,.075,-.48],[-.28,.11,.26]],[[.06,.10,-.10],[.40,.15,-.34]]].forEach(([a,b])=>add(longBone(a,b)));
    const basis=new THREE.Matrix4().makeBasis(new THREE.Vector3(0,0,1),new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0));
    basis.premultiply(new THREE.Matrix4().makeRotationX(Math.PI/6));
    basis.setPosition(-.08,.19,.015);parts.push(...skull(basis,1.15));
    const second=new THREE.Matrix4().makeRotationY(.55).multiply(basis.clone());second.setPosition(.24,.15,.20);parts.push(...skull(second,.82));
    add(tube([[-.36,.10,.18],[-.36,.22,.30],[-.20,.26,.36],[-.04,.16,.33]],[.018,.017,.015,.012],4));
    return makeGeo(parts,95,{ao:.12,smooth:55});
  },
});

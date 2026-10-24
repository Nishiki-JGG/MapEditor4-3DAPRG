// 骨の山（bonepile）：散乱した長骨・頭骨・肋骨片。
TDProps.add({
  id: 'bonepile', name: '骨の山',
  r: .35, min: 1.4, sc: [.8, 1.4], slope: .8, vis: .6, anyGround: true, material:'carved',
  tags: ['demon', 'graveyard', 'cave'], height: .53,
  build(){
    const {makeGeo}=TDGeo,A=TDAnatomy,parts=[];
    for(const[a,b,kind]of [[[-.33,.09,-.19],[.13,.10,-.12],'femur'],[[-.28,.08,.22],[.16,.09,.18],'tibia'],[[-.12,.09,-.29],[-.22,.10,.15],'femur']])parts.push(...A.limb(a,b,kind));
    parts.push(...A.skull(A.faceUp(-.02,.17,.01,.10,.24)));
    parts.push({g:A.rib([[-.25,.07,.15],[-.26,.16,.24],[-.12,.20,.28],[.01,.13,.25]],.010),m:new THREE.Matrix4(),cfn:A.bone,j:.012});
    return makeGeo(parts,95,{ao:.07,smooth:65});
  },
});

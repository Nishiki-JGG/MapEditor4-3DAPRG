// 骨（bones）：頭骨と胸郭の一部。人型を仮の造形基準とする。
TDProps.add({
  id: 'bones', name: '骨',
  r: 0, min: 1, sc: [.8, 1.4], slope: .8, vis: .6, anyGround: true,
  tags: ['desert', 'wasteland', 'demon', 'graveyard'], height: .39,
  build() {
    const { mat4, makeGeo, BONE_C } = TDGeo, { tube, skull } = TDSmallParts;
    const basis = new THREE.Matrix4().makeBasis(new THREE.Vector3(0,0,1),new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0));
    basis.premultiply(new THREE.Matrix4().makeRotationX(Math.PI/6));
    basis.setPosition(.36,.17,0);
    const parts = skull(basis), add = g => parts.push({g,m:new THREE.Matrix4(),cfn:BONE_C,j:.025});
    [.14,.21,.23,.18].forEach((w,k) => {
      const x=.11-k*.145;
      for(const s of [-1,1]) add(tube([[x,.08,s*.026],[x-.018,.13,s*w*.8],[x-.045,.22,s*w],[x-.035,.285,s*w*.67],[x-.012,.30,s*.023]],[.015,.015,.014,.012,.01],4));
    });
    for(let k=0;k<6;k++)parts.push({g:new THREE.CylinderGeometry(.034,.040,.045,5),m:mat4(.16-k*.105,.055,0,1,1,1),cfn:BONE_C,j:.025});
    add(tube([[.16,.30,0],[-.04,.31,0],[-.24,.29,0]],[.023,.024,.018],5));
    for(const s of [-1,1])add(tube([[.18,.29,s*.01],[.23,.25,s*.10],[.18,.21,s*.16]],[.014,.016,.014],4));
    return makeGeo(parts,80,{ao:.10,smooth:55});
  },
});

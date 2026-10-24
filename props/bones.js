// 骨（bones）：頭骨と胸郭の一部。人型を仮の造形基準とする。
TDProps.add({
  id: 'bones', name: '骨',
  r: 0, min: 1, sc: [.8, 1.4], slope: .8, vis: .6, anyGround: true, material:'carved',
  tags: ['desert', 'wasteland', 'demon', 'graveyard'], height: .39,
  build(){
    const {mat4,makeGeo}=TDGeo,{tube,mesh}=TDSmallParts,A=TDAnatomy,parts=A.skull(A.faceUp(.32,.15,0));
    const add=g=>parts.push({g,m:new THREE.Matrix4(),cfn:A.bone,j:.012});
    [.095,.13,.16,.18,.175,.155,.12].forEach((w,k)=>{const x=.12-k*.055;for(const side of [-1,1])add(A.rib([[x,.055,side*.020],[x-.025,.105,side*w*.85],[x-.035,.19,side*w],[x-.012,.225,side*.035]],.010-k*.00035));});
    for(let k=0;k<10;k++){const x=.26-k*.047,y=.064+.012*Math.sin(k*.35);parts.push({g:new THREE.SphereGeometry(1,6,3),m:mat4(x,y,0,.023,.022,.027),cfn:A.bone,j:.01});for(const side of [-1,1])add(mesh([[x-.009,y-.007,side*.020],[x+.009,y-.007,side*.020],[x,y+.009,side*.020],[x-.007,y+.011,side*.049]],[0,2,1,0,1,3,1,2,3,2,0,3]));}
    add(tube([[.12,.225,0],[.04,.23,0],[-.11,.22,0]],[.019,.015,.009],5,.50));
    return makeGeo(parts,80,{ao:.07,smooth:65});
  },
});

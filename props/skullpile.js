// 頭骨中心の低い集まり。既存の頭骨部品と骨色を共用。
TDProps.add({
  id:'skullpile',name:'頭骨の集まり',r:0,min:1.1,sc:[.8,1.25],slope:.25,vis:.5,anyGround:true,
  tags:['cave','graveyard','demon'],height:.40,
  build(){
    const {skull,longBone}=TDSmallParts,{BONE_C,makeGeo}=TDGeo,parts=[];
    for(const [x,y,z,yaw,tilt,scale]of [[-.18,.14,.14,-.35,.55,1],[.18,.15,.07,.65,.28,.93],[0,.18,-.18,2.1,.80,1.05]]){
      const basis=new THREE.Matrix4().makeBasis(new THREE.Vector3(0,0,1),new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0));
      basis.premultiply(new THREE.Matrix4().makeRotationX(tilt)).premultiply(new THREE.Matrix4().makeRotationY(yaw));basis.setPosition(x,y,z);parts.push(...skull(basis,scale));
    }
    parts.push({g:longBone([-.22,.05,-.30],[.24,.07,-.25],.019),m:new THREE.Matrix4(),cfn:BONE_C,j:.025});
    return makeGeo(parts,109,{ao:.09});
  },
});

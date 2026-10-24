// 頭骨中心の低い集まり。既存の頭骨部品と骨色を共用。
TDProps.add({
  id:'skullpile',name:'頭骨の集まり',r:0,min:1.1,sc:[.8,1.25],slope:.25,vis:.5,anyGround:true,material:'carved',
  tags:['cave','graveyard','demon'],height:.40,
  build(){const A=TDAnatomy,parts=[];for(const[x,y,z,yaw,roll]of [[-.16,.16,-.06,-.40,.20],[.10,.16,.11,.65,.50],[.11,.19,-.17,-.9,.75]])parts.push(...A.skull(A.faceUp(x,y,z,yaw,roll)));return TDGeo.makeGeo(parts,810,{ao:.07,smooth:65});}});

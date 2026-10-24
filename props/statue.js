// 石像（statue）：既存の杖を持つ立像を、衣を着た人物として整理。
TDProps.add({
  id:'statue',name:'石像',r:.6,min:2.5,sc:[.9,1.2],slope:.4,vis:.7,anyGround:true,
  tags:['ruins','castle','graveyard'],height:2.95,material:'stone',
  build(){return TDGeo.makeGeo(TDStatueParts.standingParts(),59,{ao:.16,smooth:45});},
});

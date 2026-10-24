// 石碑（stele）：連続した丸頭と、石を彫り込んだ浅い碑面。
TDProps.add({
  id:'stele',name:'石碑',r:.4,min:1.6,sc:[.8,1.2],slope:.6,vis:.6,anyGround:true,
  tags:['ruins','desert','graveyard'],height:1.95,material:'stone',
  build(){
    const {mat4,makeGeo,mixc,col}=TDGeo;
    const cf=(y,ny,R)=>mixc(col(0x817b6d),col(0xb3aa95),.31+Math.min(y,1.95)*.06);
    const parts=[{g:new THREE.BoxGeometry(1.1,.25,.55),m:mat4(0,.12,0,1,1,1),cfn:cf,j:.025}];
    parts.push(...TDMarkerParts.slab(TDMarkerParts.arch(.4,.25,1.55),.22,cf,{x0:-.28,x1:.28,y0:.58,y1:1.42,marks:[[.73,.34],[.90,.28],[1.07,.38],[1.24,.20]]}));
    return makeGeo(parts,60,{ao:.25});
  },
});

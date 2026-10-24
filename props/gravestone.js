// 墓石（gravestone）：継ぎ目のない墓標と低い土の裾。
TDProps.add({
  id:'gravestone',name:'墓石',r:.3,min:1.1,sc:[.8,1.2],slope:.5,vis:.45,anyGround:true,
  tags:['graveyard'],height:1.13,material:'stone',
  build(){
    const {col,mixc,mat4,makeGeo}=TDGeo;
    const cf=(y,ny,R)=>mixc(col(0x77736b),col(0xaaa597),.27+Math.min(1,y)*.17);
    const parts=[{g:new THREE.BoxGeometry(.8,.12,.5),m:mat4(0,.06,.15,1,1,1),cfn:cf,j:.025}];
    const pose=mat4(0,0,-.05,1,1,1,0,-.06);
    for(const q of TDMarkerParts.slab(TDMarkerParts.arch(.3,.12,.83),.14,cf,{x0:-.18,x1:.18,y0:.30,y1:.72,marks:[[.43,.23],[.58,.19]]})){q.m=pose.clone().multiply(q.m);parts.push(q);}
    const soil=TDSmallParts.mesh([[-.36,.025,.28],[.30,.025,.26],[.32,.012,.56],[.16,-.015,.94],[-.13,-.015,.99],[-.36,.012,.63],[-.08,.075,.50],[.10,.065,.70]],[0,6,1,1,6,2,2,6,7,2,7,3,3,7,4,4,7,5,5,7,6,5,6,0]);
    parts.push({g:soil,m:new THREE.Matrix4(),c:col(0x4a3d2c),j:.035});
    return makeGeo(parts,62,{ao:.18});
  },
});

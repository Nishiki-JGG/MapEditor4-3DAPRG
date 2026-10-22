// 地表用の小さな砕石。丸い石粒や苔の岩壁とは別の乾いた鉱物色。
TDProps.add({id:'scree',name:'小さな砕石',r:0,min:.25,sc:[.7,1.35],slope:1.2,vis:.3,anyGround:true,tags:['common'],height:.14,
 build(){const {makeGeo,mat4,col,mixc,displace,chisel}=TDGeo;
 const cfn=(y,ny,R)=>mixc(col(0x686054),col(0xaaa08b),.25+R()*.5+(ny>.5?.15:0));
 return makeGeo([{g:chisel(displace(new THREE.IcosahedronGeometry(1,0),.22,19),2,31,.7,.3),m:mat4(0,.045,0,.13,.065,.1,.3),cfn,j:.04},{g:new THREE.IcosahedronGeometry(1,0),m:mat4(.18,.02,.09,.07,.035,.05,1.2),cfn,j:.04},{g:new THREE.IcosahedronGeometry(1,0),m:mat4(-.13,.016,.14,.045,.025,.065,.8),cfn,j:.04}],51,{smooth:0});}
});

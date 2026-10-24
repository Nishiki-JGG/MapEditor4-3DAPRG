TDProps.add({id:'tiedsack',name:'結んだ物資袋',r:.30,min:1,sc:[.8,1.2],slope:.2,vis:.37,anyGround:true,tags:['ruins','castle'],height:.64,groundSink:.002,build(){
 const {mat4}=TDGeo,{tube,rings}=TDSmallParts,{part,fibre,build}=TDPracticalParts,p=[];
 p.push(part(rings([[0,.18,.16],[.06,.27,.21,.04],[.25,.30,.235,.035],[.43,.24,.19,.06],[.52,.065,.06,.11],[.59,.105,.085,.18],[.64,.035,.03,.10]],10),undefined,fibre));
 p.push(part(new THREE.TorusGeometry(.068,.013,4,10),mat4(0,.52,0,1,1,.9,0,Math.PI/2),fibre));
 p.push(part(tube([[.06,.52,.03],[.14,.49,.06],[.16,.43,.07]],[.012,.012,.01],4),undefined,fibre));return build(p,804);
}});

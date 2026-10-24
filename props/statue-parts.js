// 立像と派生像で使う石色・台座・頭部。既存立像の部品順と寸法を維持。
window.TDStatueParts=(()=>{
  const {col,mixc,clamp,mat4}=TDGeo,{tube,rings,mesh}=TDSmallParts;
  const stone=(y,ny,R)=>mixc(col(0x7c776e),col(0xbdb6a6),clamp(.17+y*.055+R()*.10,0,1));
  const addTo=(parts,g,m)=>parts.push({g,m:m||new THREE.Matrix4(),cfn:stone,j:.025});
  function baseParts(){const parts=[],add=(g,m)=>addTo(parts,g,m);
    add(new THREE.BoxGeometry(1.1,.52,1.1),mat4(0,.26,0,1,1,1));
    add(new THREE.CylinderGeometry(.60,.64,.10,4),mat4(0,.57,0,1,1,1,Math.PI/4));
    add(new THREE.BoxGeometry(.88,.13,.88),mat4(0,.685,0,1,1,1));
    return parts;
  }
  function headParts(pose=new THREE.Matrix4()){const parts=[],add=(g,m)=>addTo(parts,g,m);
    add(tube([[0,2.12,0],[0,2.30,0]],[.105,.09],6));
    add(rings([[2.28,.075,.07],[2.34,.135,.105],[2.46,.145,.12],[2.56,.12,.10],[2.61,.06,.055]],6));
    add(mesh([[-.11,2.40,.09],[.11,2.40,.09],[-.085,2.30,.09],[.085,2.30,.09],[0,2.25,.09],[0,2.38,.145],[0,2.43,.125]],[0,2,5,0,5,6,6,5,1,1,5,3,2,4,3]));
    add(mesh([[-.025,2.43,.12],[.025,2.43,.12],[0,2.36,.16],[0,2.46,.115]],[0,2,3,3,2,1,0,1,2]));
    return parts.map(p=>({...p,m:pose.clone().multiply(p.m)}));
  }
  function standingParts(){const parts=baseParts(),add=(g,m)=>addTo(parts,g,m);
    add(rings([[.82,.33,.22,.04],[1.05,.31,.20,.14],[1.42,.23,.16,.12],[1.78,.25,.17,.08],[2.06,.29,.16,.035],[2.16,.13,.105,0]],8));
    for(const s of [-1,1])add(new THREE.BoxGeometry(.15,.105,.28),mat4(s*.125,.795,.14,1,1,1));
    add(tube([[-.25,2.06,0],[-.34,1.73,.015],[-.08,1.55,.19]],[.095,.083,.061],5));
    add(tube([[.25,2.06,0],[.39,1.71,.015],[.355,1.87,.045]],[.092,.076,.055],5));
    for(const [x,y,z]of [[-.08,1.55,.19],[.355,1.87,.045]])add(new THREE.IcosahedronGeometry(1,0),mat4(x,y,z,.065,.075,.06));
    parts.push(...headParts());
    add(new THREE.CylinderGeometry(.027,.034,2.1,5),mat4(.36,1.90,0,1,1,1));
    return parts;
  }
  return{stone,baseParts,headParts,standingParts};
})();

// 頭部と片腕を失った像。頭部と破片は広い台座に支えられ、主像は円形衝突。
TDProps.add({
  id:'statue_damaged',name:'損傷した石像',r:.98,min:2.8,sc:[.9,1.2],slope:.25,vis:1.05,anyGround:true,
  tags:['ruins','castle','graveyard'],height:2.10,material:'stone',
  build(){
    const {mat4,makeGeo}=TDGeo,{tube,rings,mesh}=TDSmallParts,{stone,baseParts,headParts}=TDStatueParts;
    const parts=baseParts().map(p=>({...p,m:new THREE.Matrix4().makeScale(1.25,1,1.25).multiply(p.m)})),add=(g,m)=>parts.push({g,m:m||new THREE.Matrix4(),cfn:stone,j:.025});
    const robe=rings([[.82,.33,.22,.04],[1.05,.31,.20,.14],[1.42,.23,.16,.12],[1.78,.25,.17,.08],[1.96,.25,.14,0]],8),p=robe.attributes.position;
    for(let i=0;i<p.count;i++)if(p.getY(i)>1.9){const x=p.getX(i),z=p.getZ(i);p.setY(i,p.getY(i)+x*.28-z*.2-(Math.hypot(x,z)<.01?.025:0));}add(robe);
    for(const side of [-1,1])add(new THREE.BoxGeometry(.15,.105,.28),mat4(side*.125,.795,.14,1,1,1));
    add(tube([[-.25,1.86,0],[-.34,1.55,.015],[-.08,1.42,.19]],[.095,.083,.061],5));
    add(new THREE.IcosahedronGeometry(1,0),mat4(-.08,1.42,.19,.065,.075,.06));
    add(tube([[.25,1.86,0],[.32,1.68,.02]],[.092,.070],5));
    const pose=new THREE.Matrix4().makeTranslation(.43,.85,.33).multiply(new THREE.Matrix4().makeRotationX(-Math.PI/3)).multiply(new THREE.Matrix4().makeTranslation(0,-2.44,0));
    const fallen=headParts(pose).slice(1);let low=Infinity;const q=new THREE.Vector3();
    for(const p of fallen){const a=p.g.attributes.position;for(let i=0;i<a.count;i++){q.fromBufferAttribute(a,i).applyMatrix4(p.m);low=Math.min(low,q.y);}}
    for(const p of fallen)p.m.elements[13]+=.75-low;
    parts.push(...fallen);
    for(const [x,z,s]of [[-.43,.37,.55],[.37,-.39,.45]])add(mesh([[-.11,0,-.07],[.10,0,-.06],[.07,0,.09],[-.08,0,.08],[-.04,.11,.015],[.07,.055,.01]],[0,4,1,1,4,5,1,5,2,2,5,4,2,4,3,3,4,0]),mat4(x,.75,z,s,s,s));
    return makeGeo(parts,111,{ao:.16});
  },
});

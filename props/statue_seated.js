// 座った着衣像。腰から膝・足へ衣が続き、手は膝へ置く。
TDProps.add({
  id:'statue_seated',name:'座った石像',r:.8,min:2.5,sc:[.9,1.2],slope:.25,vis:.85,anyGround:true,
  tags:['ruins','castle','graveyard'],height:2.22,material:'stone',
  build(){
    const {mat4,makeGeo}=TDGeo,{tube,rings}=TDSmallParts,{stone,baseParts,headParts}=TDStatueParts;
    const parts=baseParts(),add=(g,m)=>parts.push({g,m:m||new THREE.Matrix4(),cfn:stone,j:.025});
    add(new THREE.BoxGeometry(.76,.50,.50),mat4(0,1.0,-.13,1,1,1));
    add(new THREE.BoxGeometry(.78,.73,.085),mat4(0,1.43,-.34,1,1,1));
    const levels=[[.82,.30,.095,.03,.36],[1.20,.31,.13,.05,.28],[1.27,.32,.26,.04,.06],[1.43,.24,.19,.10,-.13],[1.67,.29,.17,.02,-.13],[1.77,.13,.105,0,-.13]],g=rings(levels,8),p=g.attributes.position;
    for(let i=0;i<p.count;i++){const k=i<levels.length*8?Math.floor(i/8):i===levels.length*8?0:levels.length-1;p.setZ(i,p.getZ(i)+levels[k][4]);}add(g);
    for(const side of [-1,1]){
      add(new THREE.BoxGeometry(.15,.105,.28),mat4(side*.13,.795,.48,1,1,1));
      add(tube([[side*.25,1.67,-.13],[side*.34,1.36,-.05],[side*.22,1.31,.23]],[.095,.083,.061],5));
      add(new THREE.IcosahedronGeometry(1,0),mat4(side*.22,1.31,.23,.065,.075,.06));
    }
    parts.push(...headParts(new THREE.Matrix4().makeTranslation(0,-.39,-.13)));
    return makeGeo(parts,110,{ao:.16});
  },
});

// ランタン（lantern）：既存の光を保ち、灯具の枠・底・吊り金具を明示。
TDProps.add({
  id:'lantern',name:'ランタン',r:.15,min:2.5,sc:[1,1],slope:.6,vis:.4,anyGround:true,light:[0xffc070,20,1.6],
  tags:['graveyard','castle'],height:1.9,
  build(){
    const {col,mixc,mat4,makeGeo,dropBottom}=TDGeo,parts=[];
    // 枠の上下端は屋根・底板の内部に隠れるため、その閉じ面だけを除く。
    const bar=(w,h,d)=>{const g=new THREE.BoxGeometry(w,h,d),ix=[];for(const q of g.groups)if(q.materialIndex!==2&&q.materialIndex!==3)for(let i=q.start;i<q.start+q.count;i++)ix.push(g.index.getX(i));g.setIndex(ix);g.clearGroups();return g;};
    const iron=(y,ny,R)=>mixc(col(0x23252a),col(0x3e4148),.2+R()*.35);
    const add=(g,m,cfn=iron)=>parts.push({g,m,cfn,j:.025});
    add(dropBottom(new THREE.CylinderGeometry(.06,.08,1.9,6)),mat4(0,.95,0,1,1,1));
    add(new THREE.BoxGeometry(.5,.05,.05),mat4(.22,1.85,0,1,1,1));
    add(bar(.022,.10,.022),mat4(.42,1.805,0,1,1,1));
    add(new THREE.ConeGeometry(.17,.14,4),mat4(.42,1.8,0,1,1,1,Math.PI/4));
    add(new THREE.BoxGeometry(.23,.025,.23),mat4(.42,1.737,0,1,1,1));
    add(new THREE.BoxGeometry(.23,.035,.23),mat4(.42,1.46,0,1,1,1));
    for(const x of [-1,1])for(const z of [-1,1])add(bar(.017,.255,.017),mat4(.42+x*.102,1.60,z*.102,1,1,1));
    parts.push({g:new THREE.BoxGeometry(.185,.235,.185),m:mat4(.42,1.60,0,1,1,1),c:col(0xffd27a),glow:2.2,j:.05});
    return makeGeo(parts,65);
  },
});

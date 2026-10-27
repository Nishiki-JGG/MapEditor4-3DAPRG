// ランタン（lantern）：既存の光を保ち、灯具の枠・底・吊り金具を明示。
TDProps.add({
  id:'lantern',name:'ランタン',r:.15,min:2.5,sc:[1,1],slope:.6,vis:.4,anyGround:true,light:[0xffc070,20,1.6],
  tags:['graveyard','castle'],height:1.9,material:'carved',
  build(){
    const {col,mixc,mat4,makeGeo,dropBottom}=TDGeo,{mesh}=TDSmallParts,parts=[];
    // 枠の上下端は屋根・底板の内部に隠れるため、その閉じ面だけを除く。
    const bar=(w,h,d)=>{const g=new THREE.BoxGeometry(w,h,d),ix=[];for(const q of g.groups)if(q.materialIndex!==2&&q.materialIndex!==3)for(let i=q.start;i<q.start+q.count;i++)ix.push(g.index.getX(i));g.setIndex(ix);g.clearGroups();return g;};
    const iron=(y,ny,R,pr)=>mixc(col(0x23252a),col(0x3e4148),.2+pr*.35);
    const add=(g,m,cfn=iron)=>parts.push({g,m,cfn,j:.025});
    add(dropBottom(new THREE.CylinderGeometry(.03,.045,1.82,8)),mat4(0,.99,0,.8660254,1,1));
    add(new THREE.BoxGeometry(.5,.05,.05),mat4(.22,1.875,0,1,1,1));
    // A visible forged loop connects the roof to the unchanged arm footprint.
    add(new THREE.TorusGeometry(.026,.005,3,8),mat4(.42,1.82,0,1,1,1));
    add(new THREE.BoxGeometry(.014,.018,.014),mat4(.42,1.792,0,1,1,1));
    const a=.17/Math.sqrt(2),v=[],ix=[],outline=[[-1,-1],[1,-1],[1,1],[-1,1]];
    for(const[r,y]of [[a,1.73],[.003,1.79],[a-.004,1.73],[.002,1.784]])for(const[x,z]of outline)v.push([x*r,y,z*r]);
    for(let j=0;j<4;j++){const n=(j+1)%4;ix.push(j,4+j,n,n,4+j,4+n,8+j,8+n,12+j,8+n,12+n,12+j,j,n,8+j,n,8+n,8+j);}ix.push(4,6,5,4,7,6,12,13,14,12,14,15);
    add(mesh(v,ix),mat4(.42,0,0,1,1,1));
    add(new THREE.BoxGeometry(.23,.025,.23),mat4(.42,1.725,0,1,1,1));
    add(new THREE.BoxGeometry(.23,.035,.23),mat4(.42,1.46,0,1,1,1));
    for(const x of [-1,1])for(const z of [-1,1])add(bar(.017,.255,.017),mat4(.42+x*.102,1.60,z*.102,1,1,1));
    // Recess a rounded diffuser inside the frame; the open corners show real depth.
    const glass=new THREE.LatheGeometry([[.045,1.4775],[.063,1.50],[.073,1.545],[.065,1.60],[.039,1.655],[.034,1.7125]].map(([r,y])=>new THREE.Vector2(r,y)),10);
    const glassStart=parts.reduce((n,p)=>n+(p.g.index?p.g.index.count:p.g.attributes.position.count),0),glassCount=glass.index.count;
    parts.push({g:glass,m:mat4(.42,0,0,1,1,1),c:col(0xffd27a),glow:2.2,j:0});
    add(dropBottom(new THREE.CylinderGeometry(.065,.08,.08,8)),mat4(0,.04,0,.8660254,1,1));
    const result=makeGeo(parts,65,{smooth:50}),position=result.attributes.position,color=result.attributes.color,glow=result.attributes.glow,edge=col(0xb26a2c),center=col(0xffc66c);
    // Luminous glass reflects less incident light than iron; keep the existing pass.
    for(let j=glassStart;j<glassStart+glassCount;j++){const y=position.getY(j),weight=Math.max(0,1-Math.abs(y-1.57)/.15),c=mixc(edge,center,weight);color.setXYZ(j,c[0]*.28,c[1]*.28,c[2]*.28);glow.setX(j,1.2+weight*2.8);}
    return result;
  },
});

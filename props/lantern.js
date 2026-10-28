// ランタン（lantern）：既存の光を保ち、灯具の枠・底・吊り金具を明示。
TDProps.add({
  id:'lantern',name:'ランタン',r:.15,min:2.5,sc:[1,1],slope:.6,vis:.4,anyGround:true,light:[0xffc070,20,1.6],
  tags:['graveyard','castle'],height:1.9,material:'carved',
  build(){
    const {col,mixc,mat4,makeGeo,dropBottom}=TDGeo,{mesh}=TDSmallParts,parts=[];
    // 枠の上下端は屋根・底板の内部に隠れるため、その閉じ面だけを除く。
    const bar=(w,h,d)=>{const g=new THREE.BoxGeometry(w,h,d),ix=[];for(const q of g.groups)if(q.materialIndex!==2&&q.materialIndex!==3)for(let i=q.start;i<q.start+q.count;i++)ix.push(g.index.getX(i));g.setIndex(ix);g.clearGroups();return g;};
    const iron=(y,ny,R,pr)=>mixc(col(0x353b3f),col(0x626467),.2+pr*.35);
    const add=(g,m,cfn=iron)=>parts.push({g,m,cfn,j:.012});
    const metalEdge=(y,ny,R,pr)=>mixc(col(0x555958),col(0x85837c),.18+pr*.22);
    const soot=(y,ny,R,pr)=>mixc(col(0x292929),col(0x44484b),.18+pr*.22);
    function rod(a,b,r,cfn=iron){const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),dir=bv.clone().sub(av),m=new THREE.Matrix4().compose(av.clone().add(bv).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir.clone().normalize()),new THREE.Vector3(1,1,1));add(new THREE.CylinderGeometry(r,r,dir.length(),6),m,cfn);}
    function plate(x,y,z,w,d,h){const v=[],ix=[];for(const[ww,dd,yy]of[[w-.008,d-.008,y-h/2],[w,d,y-h/2+.004],[w,d,y+h/2-.004],[w-.008,d-.008,y+h/2]])for(const[a,b]of[[-1,-1],[1,-1],[1,1],[-1,1]])v.push([x+a*ww/2,yy,z+b*dd/2]);for(let k=0;k<3;k++)for(let j=0;j<4;j++){const a=k*4+j,b=k*4+(j+1)%4;ix.push(a,a+4,b,b,a+4,b+4);}ix.push(0,1,2,0,2,3,12,14,13,12,15,14);add(mesh(v,ix),mat4(0,0,0,1,1,1));}
    add(dropBottom(new THREE.CylinderGeometry(.03,.045,1.82,8)),mat4(0,.99,0,.8660254,1,1));
    plate(.22,1.875,0,.5,.05,.05);
    // A diagonal forged brace transfers the arm load into a collar on the post.
    rod([.025,1.61,0],[.285,1.85,0],.016,metalEdge);
    for(const y of [1.60,1.83])add(new THREE.CylinderGeometry(.036,.038,.035,8),mat4(0,y,0,.8660254,1,1),metalEdge);
    for(const x of [.015,.28])add(new THREE.SphereGeometry(.009,6,4),mat4(x,x<.1?1.63:1.858,-.026,1,1,.42),metalEdge);
    // A visible forged loop connects the roof to the unchanged arm footprint.
    add(new THREE.TorusGeometry(.028,.006,4,10),mat4(.42,1.82,0,1,1,1));
    add(new THREE.BoxGeometry(.014,.018,.014),mat4(.42,1.792,0,1,1,1));
    const a=.17/Math.sqrt(2),v=[],ix=[],outline=[[-1,-1],[1,-1],[1,1],[-1,1]];
    for(const[r,y]of [[a,1.73],[.003,1.79],[a-.008,1.734],[.002,1.782]])for(const[x,z]of outline)v.push([x*r,y,z*r]);
    for(let j=0;j<4;j++){const n=(j+1)%4;ix.push(j,4+j,n,n,4+j,4+n,8+j,8+n,12+j,8+n,12+n,12+j,j,n,8+j,n,8+n,8+j);}ix.push(4,6,5,4,7,6,12,13,14,12,14,15);
    add(mesh(v,ix),mat4(.42,0,0,1,1,1));
    plate(.42,1.725,0,.23,.23,.025);
    // Eave hems and supported corner joints; no extra emitter or light.
    for(const z of [-.113,.113])rod([.308,1.720,z],[.532,1.720,z],.006,metalEdge);
    plate(.42,1.46,0,.23,.23,.035);
    add(new THREE.CylinderGeometry(.043,.05,.012,12),mat4(.42,1.478,0,1,1,1),soot);
    for(const x of [-1,1])for(const z of [-1,1]){add(new THREE.BoxGeometry(.025,.034,.025),mat4(.42+x*.102,1.493,z*.102,1,1,1),metalEdge);add(new THREE.BoxGeometry(.023,.028,.023),mat4(.42+x*.102,1.702,z*.102,1,1,1),soot);}
    // A small hinge and latch sit on the frame, leaving the luminous centre unobstructed.
    for(const y of [1.535,1.664])add(new THREE.CylinderGeometry(.010,.010,.023,6),mat4(.522,y,-.105,1,1,1),metalEdge);
    plate(.316,1.595,-.112,.020,.014,.038);
    for(const x of [-1,1])for(const z of [-1,1])add(bar(.019,.255,.019),mat4(.42+x*.102,1.60,z*.102,1,1,1));
    // Recess a rounded diffuser inside the frame; the open corners show real depth.
    const glass=new THREE.LatheGeometry([[.045,1.4775],[.063,1.50],[.073,1.545],[.065,1.60],[.039,1.655],[.034,1.7125]].map(([r,y])=>new THREE.Vector2(r,y)),10);
    const glassStart=parts.reduce((n,p)=>n+(p.g.index?p.g.index.count:p.g.attributes.position.count),0),glassCount=glass.index.count;
    parts.push({g:glass,m:mat4(.42,0,0,1,1,1),c:col(0xffd27a),glow:2.2,j:0});
    add(new THREE.LatheGeometry([[.025,0],[.078,0],[.08,.012],[.068,.019],[.064,.055],[.040,.068],[.031,.082]].map(([r,y])=>new THREE.Vector2(r,y)),10),mat4(0,0,0,.8660254,1,1));
    const result=makeGeo(parts,65,{smooth:50}),position=result.attributes.position,color=result.attributes.color,glow=result.attributes.glow,edge=col(0xb26a2c),center=col(0xffc66c);
    // Luminous glass reflects less incident light than iron; keep the existing pass.
    for(let j=glassStart;j<glassStart+glassCount;j++){const y=position.getY(j),weight=Math.max(0,1-Math.abs(y-1.57)/.15),c=mixc(edge,center,weight);color.setXYZ(j,c[0]*.28,c[1]*.28,c[2]*.28);glow.setX(j,1.2+weight*2.8);}
    return result;
  },
});

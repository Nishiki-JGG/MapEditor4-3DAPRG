// 霊廟（mausoleum）
TDProps.add({
  id: 'mausoleum', name: '霊廟',
  r: 1.5, min: 4.5, sc: [.9, 1.1], slope: .3, vis: 1.9, anyGround: true,
  tags: ['graveyard'], height: 3.6, material: 'carved',
  build() {
    const {col,mixc,mat4,makeGeo}=TDGeo,{mesh}=TDSmallParts,{bevelBox,wedge}=TDArchitectureParts;
    const cf=(y,ny,R,pr)=>mixc(col(0x76746d),col(0xa6a29a),.25+pr*.30),roof=(y,ny,R,pr)=>mixc(col(0x696961),col(0x99988e),.30+pr*.25),p=[];
    const add=(g,m,cfn=cf,j=.015)=>p.push({g,m,cfn,j});
    // 基壇と胴の寸法・支点は維持。
    add(new THREE.BoxGeometry(2.8,.35,3.2),mat4(0,.17,0,1,1,1));
    add(new THREE.BoxGeometry(2.2,2,2.6),mat4(0,1.35,0,1,1,1));
    const w=1.62*Math.sqrt(3)/2,ye=2.62-.81*.55,yh=2.62+1.62*.55,L=1.5;
    const outer=[[-w,ye,-L],[0,yh,-L],[w,ye,-L],[-w,ye,L],[0,yh,L],[w,ye,L]],v=[...outer,...outer.map(([x,y,z])=>[x,y-.10,z])];
    // 一体の薄い屋根板と厚い破風。外形は元の三角屋根と同じ。
    const ix=[0,3,1,1,3,4,1,4,2,2,4,5,6,7,9,7,10,9,7,8,10,8,11,10,0,6,3,3,6,9,2,5,8,5,11,8,0,1,6,1,7,6,1,2,7,2,8,7,3,9,4,4,9,10,4,10,5,5,10,11];
    add(mesh(v,ix),new THREE.Matrix4(),roof);
    add(mesh([[-w,ye-.10,L-.10],[w,ye-.10,L-.10],[0,yh-.10,L-.10],[-w,ye-.10,-L+.10],[w,ye-.10,-L+.10],[0,yh-.10,-L+.10]],[0,1,2,3,5,4]),new THREE.Matrix4());
    const timber=(y,ny,R,pr)=>mixc(col(0x6e5642),col(0x8a7054),.25+pr*.20);
    // 元から通り抜けない入口を、厚みと継ぎ目を持つ閉じた扉として示す。
    for(let k=0;k<4;k++){
      const a=-.4+k*.2+.002,b=a+.196,m=(a+b)/2,top=x=>1.7+Math.sqrt(Math.max(0,.16-x*x)),shape=new THREE.Shape([[a,.355],[b,.355],[b,top(b)],[m,top(m)],[a,top(a)]].map(p=>new THREE.Vector2(...p)));
      add(new THREE.ExtrudeGeometry(shape,{depth:.035,bevelEnabled:false,steps:1}),mat4(0,0,1.288,1,1,1),timber,.01);
    }
    const iron=(y,ny,R,pr)=>col(0x34312d);
    for(const x of [-.34,.34])for(const y of [.75,1.45])add(new THREE.BoxGeometry(.16,.045,.025),mat4(x,y,1.337,1,1,1),iron,.01);
    add(new THREE.BoxGeometry(.030,.12,.025),mat4(.16,1.08,1.337,1,1,1),iron,.01);
    for(const x of [-.4475,.4475])add(bevelBox(.085,1.35,.10,.008),mat4(x,1.025,1.33,1,1,1));
    for(let k=0;k<7;k++)add(wedge(.405,.49,k*Math.PI/7+.004,(k+1)*Math.PI/7-.004,1.7,.10),mat4(0,0,1.28,1,1,1));
    for(const x of [-.75,.75])add(new THREE.CylinderGeometry(.13,.15,2,8),mat4(x,1.35,1.38,1,1,1));
    add(new THREE.BoxGeometry(.12,.5,.12),mat4(0,3.35,0,1,1,1));
    add(new THREE.BoxGeometry(.36,.1,.1),mat4(0,3.45,0,1,1,1));
    // 俯瞰で読める三段の石板。既存屋根を支持面として残し、外周・棟・衝突は保つ。
    // 先行部品の乱数列を変えないよう、新しい部品は末尾だけへ追加する。
    const slope=(yh-ye)/w,roofPoint=(side,t,z,lift)=>[side*w*t,yh-(yh-ye)*t+lift,z];
    for(const side of [-1,1])for(let row=0;row<3;row++){
      const cuts=row===1?[-1.43,-1.08,-.36,.36,1.08,1.43]:[-1.43,-.715,0,.715,1.43];
      for(let k=0;k<cuts.length-1;k++){
        const a=.065+row*.292,b=a+.281,z0=cuts[k]+.008,z1=cuts[k+1]-.008;
        const corners=[[a,z0],[b,z0],[b,z1],[a,z1]],v=[];
        for(const lift of [.001,.025])for(const[t,z]of corners)v.push(roofPoint(side,t,z,lift));
        // 支持面に隠れる底面を省き、端面と天面だけを作る。
        const ix=[4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7];
        if(side>0)for(let j=0;j<ix.length;j+=3)[ix[j+1],ix[j+2]]=[ix[j+2],ix[j+1]];
        add(mesh(v,ix),new THREE.Matrix4(),roof,.005);
      }
    }
    // 棟を跨ぐ三つの笠石。十字の支持位置と最高点を変えない。
    const cap=[[-.12,yh-slope*.12+.032],[0,yh+.038],[.12,yh-slope*.12+.032],[.12,yh-slope*.12+.001],[0,yh+.001],[-.12,yh-slope*.12+.001]];
    for(let k=0;k<3;k++){
      const shape=new THREE.Shape(cap.map(v=>new THREE.Vector2(...v)));
      add(new THREE.ExtrudeGeometry(shape,{depth:.938,bevelEnabled:false,steps:1}),mat4(0,0,-1.42+k*.95,1,1,1),roof,.005);
    }
    return makeGeo(p,66,{ao:.35,smooth:35});
  },
});

// 城壁（castlewall）
TDProps.add({
  id: 'castlewall', name: '城壁',
  r: .55, offs: [-1.1, 0, 1.1], min: 3.2, sc: [.9, 1.1], slope: .4, vis: 1.6, anyGround: true,
  tags: ['castle', 'ruins'], height: 3.24, material: 'carved',
  build() {
    const { rng, col, mat4, displace, makeGeo, blockC, stoneCourses } = TDGeo;
    const R=rng(88),parts=[],cf=(y,ny,R,pr)=>TDGeo.mixc(col(0x5e5c57),col(0xa8a59c),.25+pr*.35);
    parts.push({ g: new THREE.BoxGeometry(2.80, 2.78, .80), m: mat4(0, 1.39, 0, 1, 1, 1), c: col(0x3e3c38), j: .04 });   // mortar core (shows in the joints)
    stoneCourses(parts, -1.5, 1.5, 0, 6, .46, 1.0, R, cf);
    parts.push({ g: new THREE.BoxGeometry(3.05, .15, 1.15), m: mat4(0, 2.83, 0, 1, 1, 1), cfn: cf });
    for (let k = 0; k < 5; k++) parts.push({ g: displace(new THREE.BoxGeometry(.38, .45, 1.05), .05, k), m: mat4(-1.31 + k * .655, 3.12 - .1, 0, 1, 1, 1), cfn: cf });

    parts.push({ g: displace(new THREE.IcosahedronGeometry(.3, 0), .4, 2), m: mat4(.8,.065,.55,1.4,.06,1,.3), c: col(0x4e6a34), j: .1 });
    parts.push({ g: displace(new THREE.IcosahedronGeometry(.25, 0), .4, 5), m: mat4(-.9,.065,-.55,1.5,.06,1,.3), c: col(0x4e6a34), j: .1 });
    for(const p of parts)if(p.cfn===cf&&p.g.type==='BoxGeometry'){const{width,height,depth}=p.g.parameters;p.g.dispose();p.g=p.m.elements[13]>2.7?TDArchitectureParts.bevelBox(width,height,depth,.010):new THREE.BoxGeometry(width+.015,height+.010,depth);p.j=.012;}
    const cut=TDArchitectureParts.cutRect(parts,.28,.38,1.625,2.175),{mesh}=TDSmallParts;
    cut.push({g:mesh([[.28,1.625,.5],[.38,1.625,.5],[.38,2.175,.5],[.28,2.175,.5],[.28,1.625,-.5],[.38,1.625,-.5],[.38,2.175,-.5],[.28,2.175,-.5]],[0,4,3,3,4,7,1,2,5,2,6,5,0,1,4,1,5,4,3,7,2,2,7,6]),m:new THREE.Matrix4(),cfn:cf,j:.01});
    for(const z of [-.505,.505]){for(const x of [.26,.40])cut.push({g:new THREE.BoxGeometry(.04,.63,.07),m:mat4(x,1.9,z,1,1,1),cfn:cf,j:.01});for(const y of [1.605,2.195])cut.push({g:new THREE.BoxGeometry(.10,.04,.07),m:mat4(.33,y,z,1,1,1),cfn:cf,j:.01});}
    return makeGeo(cut,88,{ao:.7,smooth:35});
  },
});

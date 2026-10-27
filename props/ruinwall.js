// 崩れた壁（ruinwall）
TDProps.add({
  id: 'ruinwall', name: '崩れた壁',
  r: .4, offs: [-1.2, -.4, .4, 1.2], min: 3.2, sc: [.85, 1.15], slope: .5, vis: 1.6, anyGround: true,
  tags: ['ruins', 'castle', 'graveyard'], height: 1.99, material: 'carved',
  build() {
    const { rng, col, mat4, displace, makeGeo, petalGeo, basisAt, chisel, MOSS, blockC, stoneCourses } = TDGeo;
    const R = rng(57), parts = [], cf = (y,ny,R,pr)=>TDGeo.mixc(col(0x837d72),col(0xd2cab8),.25+pr*.35), top = (x) => 1.9 - Math.abs(x) * .5;
    const tops = Array.from({ length: 13 }, () => (R() - .5) * .8);
    stoneCourses(parts, -1.5, 1.5, 0, 5, .4, .55, R, cf, { core: 0x4c4840, keep: (x, y) => y - .2 < top(x) + tops[Math.round((x + 1.5) * 4)] || y < .4 });
    for (let k = 0; k < 4; k++) parts.push({ g: chisel(new THREE.IcosahedronGeometry(.2, 0), 3, 570 + k, .6), m: mat4((R() - .5) * 3, .1, .5 + R() * .4, 1, .7, 1, R() * 3), cfn: cf });
    // moss on the broken top and ivy leaves down the face
    for (let k = 0; k < 4; k++) { const x = -1 + k * .62 + (R() - .5) * .2; parts.push({ g: displace(new THREE.IcosahedronGeometry(.22, 0), .4, x * 7), m: mat4(x, Math.max(.6, top(x) - .05), 0, 1.3, .4, 1.4), cfn: MOSS, j: .1 }); }
    for (let k = 0; k < 14; k++) { const x = -.9 + (R() - .5) * .5 + (k % 2) * 1.5, y = 1.5 - k * .09 + (R() - .5) * .2; parts.push({ g: petalGeo(.13, .1), m: basisAt([x + (R() - .5) * .3, Math.max(.1, y), .29], [(R() - .5), -1, .2], [0, 0, 1]), cfn: MOSS, j: .15 }); }
    // This wall alone: fracture runs across the exposed stone's thickness, rather than shaving every top equally.
    function brokenStone(w,h,d,seed,worldX){const R=TDGeo.rng(1220+seed),e=.018,x=w/2,b=-h/2,t=h/2,left=t-(worldX<-.85?.12+R()*.05:.015+R()*.045),right=t-(worldX>.85?.13+R()*.05:.025+R()*.10),profile=[[-x+e,b],[x-e,b],[x,b+e],[x,right-.018],[w*.19,left*.3+right*.7-.010*R()],[-w*.13,left*.75+right*.25-.012*R()],[-x,left-.025],[-x,b+e]],v=[],ix=[];for(const z of [-d/2,d/2])for(let k=0;k<profile.length;k++){const q=profile[k],fracture=k>=3&&k<=6?(z<0?0:(R()-.5)*.09):0;const corner=k===3||k===6,chip=corner?.025+R()*.045:k===4||k===5?R()*.012:0,xx=q[0]+(corner?(q[0]>0?-1:1)*Math.min(w*.12,.018+R()*.020):0);v.push([xx,Math.max(b+.06,q[1]+fracture),z-Math.sign(z)*chip]);if(k<3||k===7)v.at(-1)[1]=q[1];}const n=profile.length;for(let k=0;k<n;k++){const j=(k+1)%n;ix.push(k,j,k+n,j,j+n,k+n);}for(const layer of [0,1]){const poly=v.slice(layer*n,(layer+1)*n).map(p=>new THREE.Vector2(p[0],p[1]));for(const tri of THREE.ShapeUtils.triangulateShape(poly,[])){const a=tri.map(i=>i+layer*n);ix.push(...(layer?a:a.reverse()));}}return TDSmallParts.mesh(v,ix);}
    const bricks=parts.filter(p=>p.cfn===cf&&p.g.type==='BoxGeometry').map(p=>({p,x:p.m.elements[12],y:p.m.elements[13],w:p.g.parameters.width}));
    for(let i=0;i<bricks.length;i++){const a=bricks[i],{width,height,depth}=a.p.g.parameters,covered=bricks.some(b=>b.y>a.y+.25&&b.y<a.y+.55&&Math.abs(b.x-a.x)<(b.w+a.w)/2-.06);a.exposed=!covered;a.p.g.dispose();a.p.g=covered?new THREE.BoxGeometry(width+.015,height+.010,depth):brokenStone(width+.015,height+.010,depth,i,a.x);a.p.j=.015;if(a.exposed){const pos=a.p.g.attributes.position;a.minimumBreakY=a.y+Math.min(...[3,4,5,6,11,12,13,14].map(k=>pos.getY(k)));}}
    for(const p of parts)if(p.c&&p.g.type==='BoxGeometry'){const{width}=p.g.parameters,y=p.m.elements[13],edge=bricks.filter(a=>a.exposed&&Math.abs(a.y-y)<.01),top=Math.min(y+.08,...edge.map(a=>a.minimumBreakY-.015)),bottom=y-.20;p.g.dispose();p.g=new THREE.BoxGeometry(Math.max(.05,width-.16),top-bottom,.407);p.m.elements[13]=(top+bottom)/2;p.j=.01;}
    const support=new THREE.Group(),mat=new THREE.MeshBasicMaterial({side:THREE.DoubleSide});for(const a of bricks){const m=new THREE.Mesh(a.p.g,mat);m.matrixAutoUpdate=false;m.matrix.copy(a.p.m);support.add(m);}support.updateMatrixWorld(true);const ray=new THREE.Raycaster();
    for(const p of parts)if(p.cfn===MOSS&&p.g.type==='IcosahedronGeometry'){const pos=new THREE.Vector3(),q=new THREE.Quaternion(),scale=new THREE.Vector3();p.m.decompose(pos,q,scale);ray.set(new THREE.Vector3(pos.x,4,pos.z),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(support,true)[0];if(hit){scale.y=.09;scale.x*=.55;scale.z*=.55;p.g.computeBoundingBox();pos.y=Math.min(hit.point.y-.008,1.995-p.g.boundingBox.max.y*scale.y);p.m.compose(pos,q,scale);}}
    // 石組みと蔦の元の乱数・法線・色を保全し、頂部の四つの苔だけを置き換える。
    const old=makeGeo(parts,57,{ao:.6,smooth:35}),ranges=[],patches=[],metrics={patches:0,vertices:0,misses:0,clipped:0};let offset=0;
    for(const p of parts){const count=p.g.index?.count||p.g.attributes.position.count;
      if(p.cfn===MOSS&&p.g.type==='IcosahedronGeometry'){
        ranges.push([offset,offset+count]);const x=p.m.elements[12],z=p.m.elements[14];
        ray.set(new THREE.Vector3(x,4,z),new THREE.Vector3(0,-1,0));const anchor=ray.intersectObject(support,true)[0];if(!anchor)throw Error('Ruin moss needs a supporting stone');
        const vertices=[],indices=[],N=12;
        function sample(px,pz,lift){ray.set(new THREE.Vector3(px,4,pz),new THREE.Vector3(0,-1,0));let hit=ray.intersectObject(support,true)[0];if(hit?.object!==anchor.object)hit=null;for(let k=0;!hit&&k<48;k++){px=x+(px-x)*.86;pz=z+(pz-z)*.86;metrics.clipped++;ray.set(new THREE.Vector3(px,4,pz),new THREE.Vector3(0,-1,0));hit=ray.intersectObject(support,true)[0];if(hit?.object!==anchor.object)hit=null;}if(!hit){metrics.misses++;throw Error('Ruin moss left its supporting stone');}metrics.vertices++;return[px,hit.point.y+lift,pz];}
        vertices.push(sample(x,z,.018));
        for(const ring of [0,1])for(let k=0;k<N;k++){const a=k/N*Math.PI*2,r=(ring?.98:.49)*(.84+.12*Math.sin(a*3+x*4)+.08*Math.cos(a*5-x*3));vertices.push(sample(x+Math.cos(a)*.29*r,z+Math.sin(a)*.22*r,ring?.004:.014));}
        for(let k=0;k<N;k++){const next=(k+1)%N,a=1+k,b=1+next,c=1+N+k,d=1+N+next;indices.push(0,b,a,a,b,c,b,d,c);}
        const moss=(y,ny,R,pr,px,pz)=>{const edge=Math.min(1,Math.hypot((px-x)/.29,(pz-z)/.22));return TDGeo.mixc(col(0x42552b),col(0x718144),.30+.30*(1-edge)+R()*.12);};
        patches.push({g:TDSmallParts.mesh(vertices,indices),m:new THREE.Matrix4(),cfn:moss,j:.025});metrics.patches++;
      }offset+=count;
    }
    const moss=makeGeo(patches,34057,{ao:.6,smooth:35}),out=new THREE.BufferGeometry();
    for(const[name,a]of Object.entries(old.attributes)){const values=[],b=moss.attributes[name];for(let i=0;i<a.count;i++)if(!ranges.some(([lo,hi])=>i>=lo&&i<hi))for(let j=0;j<a.itemSize;j++)values.push(a.array[i*a.itemSize+j]);for(const value of b.array)values.push(value);out.setAttribute(name,new THREE.Float32BufferAttribute(values,a.itemSize));}
    out.userData.ruinMoss={...metrics,oldRanges:ranges,stoneAndIvyVertices:old.attributes.position.count-ranges.reduce((n,[a,b])=>n+b-a,0)};
    old.dispose();moss.dispose();mat.dispose();return out;
  },
});

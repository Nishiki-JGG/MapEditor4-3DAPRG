// 崖石（cliff）：割れ目と張り出しのある一続きの岩塊。既存配置の占有寸法を維持する。
TDProps.add({
  id:'cliff',name:'崖石',
  r:.5,offs:[-.72,0,.72],min:1.0,sc:[.9,1.2],slope:9,vis:1.25,anyGround:true,shape:true,
  tags:['common'],height:2.36,material:'rock',
  build(){
    const {clamp,hash2,rng,col,mixc,mat4,makeGeo,chisel,dropBottom}=TDGeo;
    const R=rng(77),parts=[];
    const colour=(y,ny,random,part,x,z)=>{
      const mineral=hash2(Math.floor(x*3.1+z*.8),Math.floor(y*2.6));
      return mixc(col(0x79766c),col(0xb9b5a4),clamp(.32+mineral*.24+part*.12+Math.max(0,ny)*.16,0,1));
    };
    // Broad fractured shoulders replace full-height straight cylinder faces. Rings stay connected.
    function outcrop(width,height,depth,seed){
      const random=rng(seed),sides=7,levels=[0,.08,.27,.48,.57,.79,.94,1],profile=[.73,1,.96,.81,1.02,.94,.70,.18];
      const pos=[],ix=[],phase=random()*6.28,lean=(random()-.5)*.22,turn=random()*.45;
      const angular=Array.from({length:sides},()=>.86+random()*.25);
      for(let r=0;r<levels.length;r++)for(let q=0;q<sides;q++){
        const t=levels[r],a=q/sides*Math.PI*2+turn;
        const ledge=profile[r]*(.95+.10*Math.sin(q*2.1+phase+r*.6))*angular[q];
        const uneven=r===0?0:Math.sin(q*1.9+phase+r*.7)*(r===levels.length-1?.015:.035);
        pos.push(Math.cos(a)*width*.5*ledge+lean*t,height*(t+uneven),Math.sin(a)*depth*.5*ledge+Math.sin(t*3+phase)*.05*t);
      }
      for(let r=0;r<levels.length-1;r++)for(let q=0;q<sides;q++){
        const next=(q+1)%sides,a=r*sides+q,b=(r+1)*sides+q,c=r*sides+next,d=(r+1)*sides+next;
        ix.push(a,b,c,c,b,d);
      }
      const top=pos.length/3;pos.push(lean,height*1.015,Math.sin(3+phase)*.05);
      const base=pos.length/3;pos.push(0,0,0);
      for(let q=0;q<sides;q++){
        const next=(q+1)%sides,ring=(levels.length-1)*sides;
        ix.push(top,ring+next,ring+q,base,q,next);
      }
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setIndex(ix);
      return dropBottom(g);
    }
    for(const [i,x,w,h,d,z]of [[0,0,1.96,2.25,1.16,-.04],[1,-.75,1.12,1.47,1.13,.05],[2,.72,1.20,1.83,1.12,-.05]]){
      parts.push({g:outcrop(w,h,d,181+i*73),m:mat4(x,-.12,z,1,1,1,(R()-.5)*.18),cfn:colour,j:.035});
    }
    // Overlapping skirts sink into the ground and soften the contact, with no hovering cap stones.
    for(const [x,z,w,h,d]of [[-.52,.43,.58,.40,.50],[.67,-.37,.55,.48,.53]]){
      const g=chisel(new THREE.IcosahedronGeometry(1,1),4,315+x*7,.72,.2).scale(w,h,d);
      parts.push({g,m:mat4(x,.12,z,1,1,1,R()*6.28),cfn:colour,j:.035});
    }
    const g=makeGeo(parts,15,{ao:.60,smooth:34});g.computeBoundingBox();
    // Same envelope as the previous asset: old rooms need no repositioning or height adjustment.
    const oldMin=[-1.152980089,-.150263384,-.601505458],oldMax=[1.335498214,2.254099369,.721978605];
    const b=g.boundingBox,size=new THREE.Vector3();b.getSize(size);
    const scale=oldMin.map((v,k)=>(oldMax[k]-v)/size.getComponent(k));
    g.translate(-b.min.x,-b.min.y,-b.min.z);g.scale(...scale);g.translate(...oldMin);
    g.computeBoundingBox();g.computeBoundingSphere();return g;
  },
});

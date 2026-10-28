// Approved royal gold structure; canonical ID and placement contract remain unchanged.
window.TDChestRoyalGeometry=(()=>{
const {mat4,col,makeGeo}=TDGeo,{bevelBox}=TDArchitectureParts,{tube}=TDSmallParts;let cached;
function geometry(){if(cached)return cached;const parts=[];
 function add(g,x=0,y=0,z=0,ry=0,rx=0,rz=0){parts.push({g,m:mat4(x,y,z,1,1,1,ry,rx,rz),c:col(0xb98a35),j:0,glow:0});}
 function box(w,h,d,x,y,z,b=.006){add(bevelBox(w,h,d,Math.min(b,w*.2,h*.2,d*.2)),x,y,z);}
 function shape(points,depth,bevel=.003,holes=[]){const s=new THREE.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();for(const points of holes){const p=new THREE.Path();points.forEach(([x,y],i)=>i?p.lineTo(x,y):p.moveTo(x,y));p.closePath();s.holes.push(p);}const g=new THREE.ExtrudeGeometry(s,{depth,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:1,steps:1});g.translate(0,0,-depth/2);return g;}
 // A single perimeter skirt carries the base down into four feet; no appended corner blocks.
 const perimeter=[];for(const x of [-.51,-.38,-.30,0,.30,.38,.51])perimeter.push([x,.34]);perimeter.push([.54,.31]);for(const z of [.23,.14,0,-.14,-.23,-.31])perimeter.push([.54,z]);perimeter.push([.51,-.34]);for(const x of [.38,.30,0,-.30,-.38,-.51])perimeter.push([x,-.34]);perimeter.push([-.54,-.31]);for(const z of [-.23,-.14,0,.14,.23,.31])perimeter.push([-.54,z]);
 const vertices=[],indices=[],N=perimeter.length;for(const[x,z]of perimeter){const front=Math.abs(z)>.32,y=.070*Math.max(0,Math.min(1,front?(.38-Math.abs(x))/.08:(.23-Math.abs(z))/.09)),xi=x-Math.sign(x)*.040,zi=z-Math.sign(z)*.040;vertices.push([x,.169,z],[x,y,z],[xi,y,zi],[xi,.169,zi]);}
 function quad(a,b,c,e){indices.push(a,b,c,a,c,e);}for(let j=0;j<N;j++){const a=j*4,b=(j+1)%N*4;quad(a,a+1,b+1,b);quad(a+1,a+2,b+2,b+1);quad(a+2,a+3,b+3,b+2);quad(a+3,a,b,b+3);}const skirt=TDSmallParts.mesh(vertices,indices);skirt.computeVertexNormals();add(skirt);
 box(1.082,.026,.680,0,.157,0,.007);box(1.035,.065,.632,0,.137,0,.009);box(.990,.350,.598,0,.340,0,.010);
 for(const z of [-.314,.314]){box(1.035,.050,.038,0,.180,z,.007);box(1.055,.053,.045,0,.523,z,.008);}
 for(const x of [-.503,.503]){box(.040,.340,.630,x,.345,0,.006);box(.045,.053,.650,x,.523,0,.007);}
 // Corner straps wrap two faces and terminate into the plinth instead of floating on a panel.
 for(const x of [-.469,.469])for(const z of [-.295,.295]){box(.093,.345,.042,x,.345,z,.007);box(.042,.345,.093,x,.345,z,.007);box(.112,.038,.102,x,.195,z,.007);}
 // Broad lid seating lip and a lower, faceted vault. No giant top bolts.
 for(const z of [-.324,.324])box(1.070,.045,.043,0,.568,z,.007);
 for(const x of [-.514,.514])box(.043,.045,.635,x,.568,0,.007);
 const roof=[[-.325,.564]];for(let k=0;k<=20;k++){const z=-.325+.65*k/20;roof.push([z,.606+.110*Math.cos(z/.325*Math.PI/2)]);}roof.push([.325,.564]);
 const lid=shape(roof,1.015,.005);lid.rotateY(Math.PI/2);add(lid);
 const band=[[-.342,.570],[-.342,.604]];for(let k=0;k<=20;k++){const z=-.325+.65*k/20;band.push([z,.622+.110*Math.cos(z/.325*Math.PI/2)]);}band.push([.342,.604],[.342,.570]);
 for(const [x,w]of [[-.375,.055],[0,.115],[.375,.055]]){const outline=band.concat([...band].reverse().map(([z,y])=>[z,y-.020]));const g=shape(outline,w,.0025);g.rotateY(Math.PI/2);add(g,x);for(const z of [-.332,.332])box(w,.315,.026,x,.359,z,.005);}
 for(const x of [-.375,.375])for(const z of [-.350,.350]){const pin=new THREE.CylinderGeometry(.008,.011,.006,8);pin.rotateX(Math.PI/2);add(pin,x,.600,z);}
 // A hinged hasp visibly crosses the seating lip and seats on the lock, with actual depth changes.
 const haspProfile=[[.342,.602],[.357,.580],[.379,.556],[.389,.495],[.389,.369]];
 const hasp=shape(haspProfile.concat([...haspProfile].reverse().map(([z,y])=>[z-.017,y])),.086,.002);hasp.rotateY(-Math.PI/2);add(hasp);
 const knuckle=new THREE.CylinderGeometry(.017,.017,.134,10);knuckle.rotateZ(Math.PI/2);add(knuckle,0,.581,.352);
 for(const x of [-.057,.057]){box(.028,.049,.025,x,.583,.343,.004);const pin=new THREE.CylinderGeometry(.008,.010,.007,8);pin.rotateZ(Math.PI/2);add(pin,x+Math.sign(x)*.015,.581,.352);}
 // Central strap becomes a thick heraldic lock escutcheon with an actual recessed centre.
 const shield=[[-.135,.495],[.135,.495],[.152,.462],[.133,.316],[.085,.270],[0,.245],[-.085,.270],[-.133,.316],[-.152,.462]];
 const inner=shield.map(([x,y])=>[x*.80,.383+(y-.383)*.80]);
 add(shape(shield,.028,.004,[inner]),0,0,.354);add(shape(inner,.017,.002),0,0,.332);
 const key=[];for(let k=0;k<=12;k++){const a=(-.3+1.6*k/12)*Math.PI;key.push([Math.cos(a)*.010,.350+Math.sin(a)*.010]);}key.push([-.004,.323],[.004,.323]);
 add(shape([[-.031,.375],[.031,.375],[.035,.318],[.020,.302],[-.020,.302],[-.035,.318]],.021,.002,[key]),0,0,.357);
 // Broad stepped backing joins the central escutcheon to the structural side straps.
 const backing=[[-.395,.462],[-.344,.490],[-.16,.490],[-.11,.515],[.11,.515],[.16,.490],[.344,.490],[.395,.462],[.395,.371],[.337,.350],[.280,.395],[.163,.395],[.112,.280],[-.112,.280],[-.163,.395],[-.280,.395],[-.337,.350],[-.395,.371]];
 add(shape(backing,.029,.004),0,0,.325);
 for(const sign of [-1,1]){const shoulder=[[.158,.471],[.329,.471],[.372,.447],[.372,.395],[.340,.384],[.288,.419],[.172,.419]].map(([x,y])=>[x*sign,y]);add(shape(shoulder,.014,.003),0,0,.349);}
 box(.104,.022,.027,0,.383,.378,.004);
 // Side bail handles: two mounting bosses, a visible axle, and a thick bent grip.
 for(const sign of [-1,1]){for(const z of [-.090,.090]){box(.027,.080,.070,sign*.529,.370,z,.006);const boss=new THREE.CylinderGeometry(.023,.029,.035,10);boss.rotateZ(Math.PI/2);add(boss,sign*.550,.370,z);}
 const path=[[sign*.568,.370,-.09],[sign*.575,.339,-.112],[sign*.578,.267,-.086],[sign*.578,.247,-.055],[sign*.578,.247,.055],[sign*.578,.267,.086],[sign*.575,.339,.112],[sign*.568,.370,.09]];add(tube(path,path.map(()=>.014),7));}
 // Small restrained fasteners instead of repeated oversized hex caps.
 for(const x of [-.375,.375])for(const z of [-.339,.339])for(const y of [.224,.480]){const rivet=new THREE.CylinderGeometry(.009,.013,.006,8);rivet.rotateX(Math.PI/2);add(rivet,x,y,z);}
 for(const x of [-.375,.375]){const hinge=new THREE.CylinderGeometry(.018,.018,.105,10);hinge.rotateZ(Math.PI/2);add(hinge,x,.556,-.350);}
 // Crown ruby in a thick saddle, low bezel and four bent claws, carried by the central strap.
 const seat=new THREE.CylinderGeometry(.096,.109,.027,12);seat.scale(1,1,.84);add(seat,0,.744,0);
 const rim=new THREE.TorusGeometry(.092,.008,6,16);rim.rotateX(Math.PI/2);rim.scale(1,1,.84);add(rim,0,.760,0);
 const rv=[],ri=[];for(const [radius,y]of [[.087,.755],[.092,.766],[.062,.797]])for(let k=0;k<8;k++){const a=k*Math.PI/4;rv.push([Math.cos(a)*radius,y,Math.sin(a)*radius*.84]);}
 for(let row=0;row<2;row++)for(let k=0;k<8;k++){const a=row*8+k,b=row*8+(k+1)%8;ri.push(a,b,a+8,b,b+8,a+8);}for(let k=1;k<7;k++)ri.push(16,16+k,17+k);for(let i=0;i<ri.length;i+=3)[ri[i+1],ri[i+2]]=[ri[i+2],ri[i+1]];const ruby=TDSmallParts.mesh(rv,ri);ruby.computeVertexNormals();add(ruby);parts.at(-1).c=col(0xa40d25);
 for(let k=0;k<4;k++){const a=Math.PI/4+k*Math.PI/2,c=Math.cos(a),s=Math.sin(a),p=[[c*.098,.749,s*.082],[c*.092,.772,s*.077],[c*.067,.799,s*.056]];add(tube(p,[.006,.006,.005],6));}
 cached=makeGeo(parts,56191,{ao:0,smooth:0,uv:TDGeo.ATLAS2.white});const pp=cached.attributes.position,nn=cached.attributes.normal;let softened=0;for(let i=0;i<pp.count;i++){const y=pp.getY(i),z=pp.getZ(i),c=Math.cos(z/.325*Math.PI/2);if(Math.abs(z)<=.3251&&Math.abs(nn.getX(i))<.02&&nn.getY(i)>.80&&y>.606+.110*c-.007&&y<.622+.110*c+.006){const v=new THREE.Vector3(0,1,.110/.325*Math.PI/2*Math.sin(z/.325*Math.PI/2)).normalize(),old=new THREE.Vector3().fromBufferAttribute(nn,i);if(v.distanceTo(old)>.10)continue;nn.setXYZ(i,v.x,v.y,v.z);softened++;}}cached.userData.royalSmoothedNormals=softened;const colour=cached.attributes.color;cached.setAttribute('rubyMark',new THREE.Float32BufferAttribute(Array.from({length:colour.count},(_,i)=>colour.getX(i)>colour.getY(i)*2.5?1:0),1));cached.computeBoundingBox();cached.computeBoundingSphere();return cached;
}
return{geometry};
})();

// Approved square ruined crate. Same worn ID, placement and collider contract.
window.TDChestWorn=(()=>{
const {mat4,col}=TDGeo,{part,build}=TDPracticalParts;let cached;
function geometry(){if(cached)return cached;const parts=[];
 const timber=[0xb4aa95,0x9f9580,0xb9ac91,0xa59a85,0xaaa18c];
 function add(g,x,y,z,shade,textured=true,ry=0,rx=0,rz=0){if(!textured){const arr=new Float32Array(g.attributes.position.count*2);for(let i=0;i<g.attributes.position.count;i++){arr[i*2]=.875;arr[i*2+1]=.9375;}g.setAttribute('uv',new THREE.Float32BufferAttribute(arr,2));}parts.push({...part(g,mat4(x,y,z,1,1,1,ry,rx,rz),()=>col(shade),false),uvr:[0,0,1,1],j:.004});}
 // A full-thickness polygonal board: chips remove silhouette, splits are real narrow holes.
 function plank(w,h,t,left=.025,right=.035,split=false){

  const originalPoints=[[-.5,-.5],[.5-right*.50,-.5],[.5-right*.18,-.31],[.5-right*.83,-.26],[.5-right*.95,-.20],[.5-right*.30,-.17],[.5-right*.15,.04],[.5-right*.74,.08],[.5-right*.78,.14],[.5-right*.23,.20],[.5-right*.10,.5],[-.5+left*.25,.5],[-.5+left*.31,.26],[-.5+left,.20],[-.5+left*.90,.13],[-.5+left*.20,.07],[-.5,-.08]];
  const points=(left>.08||right>.08)?originalPoints.map(([x,y])=>[x<0&&left<=.08?-.5:x>0&&right<=.08?.5:x,y]):[[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]];const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x*w,y*h):shape.moveTo(x*w,y*h));shape.closePath();
  if(split){const hole=new THREE.Path();[[-.31,-.055],[-.12,-.025],[-.035,.04],[-.10,.085],[-.23,.035]].forEach(([x,y],i)=>i?hole.lineTo(x*w,y*h):hole.moveTo(x*w,y*h));hole.closePath();shape.holes.push(hole);}
  const g=new THREE.ExtrudeGeometry(shape,{depth:t,steps:1,bevelEnabled:false,bevelThickness:.0018,bevelSize:.0018,bevelSegments:1});g.translate(0,0,-t/2);
  const p=g.attributes.position,uv=[];
  // Thin, irregular broken ends; full thickness is retained in sound structural boards.
  if(left>.08||right>.08){for(let i=0;i<p.count;i++){const x=p.getX(i)/w+.5,y=p.getY(i)/h+.5,edge=right>.08?Math.max(0,(x-.62)/.38):0,le=left>.08?Math.max(0,(.16-x)/.16):0,wear=Math.max(edge,le);p.setZ(i,p.getZ(i)*(1-wear*(.35+.25*(.5+.5*Math.sin(y*19)))));}p.needsUpdate=true;g.computeVertexNormals();}
for(let i=0;i<p.count;i++)uv.push(Math.max(0,Math.min(1,p.getY(i)/h+.5)),Math.max(0,Math.min(1,p.getX(i)/w+.5)));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return TDChestWornSurface.board(g,w,h,left,right,split,true);
 }
 // Closed bottom and internal corner posts support the damaged walls and flat cover.
 add(plank(1.015,.59,.040,.02,.03),0,.020,0,0x756b57,true,0,-Math.PI/2);
 for(const x of [-.455,.455])for(const z of [-.268,.268])add(plank(.535,.062,.065,.025,.02),x,.299,z,0x8f816a,true,0,0,Math.PI/2);
 for(const z of [-.306,.306])for(let row=0;row<4;row++){
  const front=z>0,broken=front&&row===3;
  add(plank(broken?.76:1.035,.122,.034,0,broken?.21:0,front&&row===2),broken?-.13:0,.102+row*.127,z,timber[(row+(front?0:2))%5],true,0,0,front&&row===2?-.010:0);
 }
 for(const x of [-.504,.504])for(let row=0;row<4;row++)add(plank(.57,.122,.034,0,0,false),x,.102+row*.127,0,timber[(row+3)%5],true,Math.PI/2,0,row===2&&x>0?.012:0);
 // Two cross battens carry the lid. Five low-cost flat planks, one shortened broken corner.
 for(const x of [-.32,.32])add(plank(.61,.045,.045,.02,.02),x,.553,0,0x8d8068,true,Math.PI/2,0,0);
 for(let k=0;k<5;k++){const broken=k===4,w=broken?.70:1.06,x=broken?-.15:(k===1?.013:0),z=(k-2)*.128;
  add(plank(w,.124,.038,broken?.095:0,broken?.26:k===3?.14:0,k===2),x,.594+(k===1?.009:0),z,timber[(k+1)%5],true,0,-Math.PI/2,k===1?.009:0);
 }
 // Two narrow, tapered peeling fibres follow the wood direction near the main break.
 for(const [x,y,z,l,w,tilt]of [[.095,.493,.328,.15,.011,.018],[.186,.596,.236,.105,.008,.014]]){
  const vertices=[[x-l*.5,y-w*.5,z],[x+l*.5,y-w*.25,z+tilt],[x+l*.42,y+w*.25,z+tilt*.9],[x-l*.5,y+w*.5,z],[x-l*.5,y-w*.5,z-.004],[x-l*.5,y+w*.5,z-.004]];
  const g=TDSmallParts.mesh(vertices,[0,1,2,0,2,3,0,4,1,3,2,5,4,5,2,4,2,1]);const uv=[];for(let i=0;i<g.attributes.position.count;i++)uv.push(.10,.78);g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));parts.push({g,m:mat4(0,0,0,1,1,1),c:col(0xa09b89),uvr:[0,0,1,1],j:0});
 }
 // Rusted rear hinges and a bent, incomplete front hasp. No decorative hoop or padlock.
 for(const x of [-.32,.32]){add(new THREE.BoxGeometry(.058,.105,.009),x,.535,-.330,0x675043,false);add(new THREE.BoxGeometry(.058,.009,.065),x,.617,-.276,0x715344,false);const pin=new THREE.CylinderGeometry(.009,.009,.071,6);pin.rotateZ(Math.PI/2);add(pin,x,.585,-.326,0x493e35,false);}
 add(new THREE.BoxGeometry(.050,.106,.010),-.015,.548,.331,0x755240,false,0,0,-.14);
 for(const x of [-.458,.458])for(const y of [.108,.48])for(const z of [-.328,.328]){const nail=new THREE.CylinderGeometry(.006,.008,.004,5);nail.rotateX(Math.PI/2);add(nail,x,y,z,0x493d31,false);}
 while(TDChestWornSurface.records.length<32)TDChestWornSurface.board(new THREE.BoxGeometry(1,1,1),1,1,0,0,false,false);cached=build(parts,55191,true);cached.computeBoundingBox();cached.computeBoundingSphere();cached.userData.chestWornVersion=1;return cached;
}
TDProps.decorate('treasurechest_worn',t=>({...t,collisionGeo:t.geo,geo:geometry()}));
return{geometry};
})();

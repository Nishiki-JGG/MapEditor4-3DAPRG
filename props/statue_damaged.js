// 頭部と片腕を失った像。頭部と破片は広い台座に支えられ、主像は円形衝突。
TDProps.add({
  id:'statue_damaged',name:'損傷した石像',r:.98,min:2.8,sc:[.9,1.2],slope:.25,vis:1.05,anyGround:true,
  tags:['ruins','castle','graveyard'],height:2.10,material:'carved',
  build(){const {mat4,makeGeo}=TDGeo,{mesh}=TDSmallParts,S=TDStatueParts,p=S.baseParts().map(q=>({...q,m:new THREE.Matrix4().makeScale(1.25,1,1.25).multiply(q.m)})),add=(g,m)=>p.push({g,m:m||new THREE.Matrix4(),cfn:S.stone,j:.012});
   const robe=S.cloth([[.80,.30,.205,.025,.22,.2],[1.01,.31,.197,.020,.15,.1],[1.31,.267,.177,.012,.16,.7],[1.57,.215,.150,.005,.11,1.4],[1.77,.23,.155,0,.08,1.8],[1.98,.25,.14,0,.04,2]],28),v=robe.attributes.position;
   for(let i=0;i<v.count;i++)if(v.getY(i)>1.90){const x=v.getX(i),z=v.getZ(i);v.setY(i,v.getY(i)+x*.20-z*.18+.022*Math.sin(x*41+z*19));}add(robe);
   for(const q of [-1,1])p.push(...S.foot(q*.125,.10));
   add(S.sleeve([[-.18,1.89,0],[-.30,1.73,.03],[-.21,1.49,.15],[-.08,1.45,.20]],[.105,.095,.074,.055]));p.push(...S.hand(-.08,1.42,.20,0,-.2));
   add(S.sleeve([[.18,1.89,0],[.29,1.74,.02],[.31,1.67,.03]],[.105,.08,.070]));
   const pose=new THREE.Matrix4().makeTranslation(.43,.85,.33).multiply(new THREE.Matrix4().makeRotationX(-Math.PI/3)).multiply(new THREE.Matrix4().makeTranslation(0,-2.44,0)),fallen=S.headParts(pose).slice(1),q=new THREE.Vector3();let low=Infinity;
   for(const part of fallen){const a=part.g.attributes.position;for(let i=0;i<a.count;i++){q.fromBufferAttribute(a,i).applyMatrix4(part.m);low=Math.min(low,q.y);}}for(const part of fallen)part.m.elements[13]+=.75-low;p.push(...fallen);
   for(const[x,z,k]of [[-.43,.37,.55],[.37,-.39,.45]])add(mesh([[-.11,0,-.07],[.10,0,-.06],[.07,0,.09],[-.08,0,.08],[-.04,.11,.015],[.07,.055,.01]],[0,4,1,1,4,5,1,5,2,2,5,4,2,4,3,3,4,0]),mat4(x,.75,z,k,k,k));
   return makeGeo(p,111,{ao:.12,smooth:65});
  },
});

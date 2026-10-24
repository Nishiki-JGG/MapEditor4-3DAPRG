// 座った着衣像。腰から膝・足へ衣が続き、手は膝へ置く。
TDProps.add({
  id:'statue_seated',name:'座った石像',r:.8,min:2.5,sc:[.9,1.2],slope:.25,vis:.85,anyGround:true,
  tags:['ruins','castle','graveyard'],height:2.22,material:'carved',
  build(){const {mat4,makeGeo}=TDGeo,S=TDStatueParts,p=S.baseParts(),add=(g,m)=>p.push({g,m:m||new THREE.Matrix4(),cfn:S.stone,j:.012});
   add(new THREE.BoxGeometry(.70,.46,.47),mat4(0,.98,-.15,1,1,1));add(new THREE.BoxGeometry(.71,.73,.075),mat4(0,1.43,-.345,1,1,1));
   add(S.cloth([[.81,.27,.11,.35,.22,.2],[1.06,.29,.14,.33,.20,.5],[1.22,.32,.23,.18,.16,1.2],[1.30,.30,.24,.035,.08,1.5],[1.43,.215,.165,-.12,.07,2],[1.64,.255,.148,-.13,.055,2.3],[1.77,.13,.09,-.13,.03,2.6]],28));
   for(const q of [-1,1]){p.push(...S.foot(q*.13,.45));add(S.sleeve([[q*.18,1.67,-.13],[q*.31,1.47,-.09],[q*.25,1.34,.08],[q*.20,1.30,.25]],[.105,.09,.07,.05]));p.push(...S.hand(q*.20,1.29,.25,0,q*.14));}
   p.push(...S.headParts(new THREE.Matrix4().makeTranslation(0,-.39,-.13)));return makeGeo(p,110,{ao:.12,smooth:65});
  },
});

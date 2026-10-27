// オベリスク（obelisk）
TDProps.add({
  id: 'obelisk', name: 'オベリスク',
  r: .5, min: 2.5, sc: [.9, 1.2], slope: .5, vis: .6, anyGround: true,
  tags: ['desert', 'ruins'], height: 4.95, material: 'carved',
  build() {
    const {col,mat4,makeGeo,SANDSTONE}=TDGeo,{mesh}=TDSmallParts;
    const r=.3*Math.SQRT2,parts=[{g:new THREE.BoxGeometry(1.1,.4,1.1),m:mat4(0,.2,0,1,1,1),cfn:SANDSTONE,j:.02}];
    const v=[[-.3,.4,-.3],[.3,.4,-.3],[.3,.4,.3],[-.3,.4,.3],[-.225,4.4,-.225],[.225,4.4,-.225],[.225,4.4,.225],[-.225,4.4,.225]];
    // 正面以外の三面と上下。傾いた四角柱の寸法と支点は元のまま。
    parts.push({g:mesh(v,[0,4,1,1,4,5,1,5,2,2,5,6,3,7,0,0,7,4,0,1,2,0,2,3,4,7,6,4,6,5]),m:new THREE.Matrix4(),cfn:SANDSTONE,j:.015});
    const surface=y=>.3-(y-.4)*.075/4,outline=[[-.3,.4],[.3,.4],[.225,4.4],[-.225,4.4]],channel=[[-.06,.9],[.06,.9],[.06,3.7],[-.06,3.7]];
    const shape=new THREE.Shape(outline.map(p=>new THREE.Vector2(...p)));shape.holes.push(new THREE.Path(channel.map(p=>new THREE.Vector2(...p))));const front=new THREE.ShapeGeometry(shape);
    for(let i=0;i<front.attributes.position.count;i++){const y=front.attributes.position.getY(i);front.attributes.position.setZ(i,surface(y));}
    parts.push({g:front,m:new THREE.Matrix4(),cfn:SANDSTONE,j:.015});
    // 浮いた貼付板の代わりに、同じ石へ彫り込んだ浅い連続した帯。
    const cv=[],ci=[];for(const d of [0,.018])for(let k=0;k<4;k++){const[x,y]=channel[k],xx=d?x*(5/6):x,yy=d?y+(y<2?.015:-.015):y;cv.push([xx,yy,surface(yy)-d]);}
    for(let j=0;j<4;j++){const n=(j+1)%4;ci.push(j,n,j+4,n,n+4,j+4);}
    parts.push({g:mesh(cv,ci),m:new THREE.Matrix4(),cfn:(...a)=>SANDSTONE(...a).map(c=>c*.98),j:.01});
    parts.push({g:mesh(cv,[4,5,6,4,6,7]),m:new THREE.Matrix4(),cfn:(...a)=>SANDSTONE(...a).map(c=>c*.80),j:.005});
    parts.push({g:new THREE.ConeGeometry(r*.75,.55,4),m:mat4(0,4.67,0,1,1,1,Math.PI/4),c:col(0xe8c460),j:.02});
    return makeGeo(parts,77,{ao:.25});
  },
});

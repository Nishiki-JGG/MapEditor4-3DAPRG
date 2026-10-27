// 石柱（column）
TDProps.add({
  id: 'column', name: '石柱',
  r: .5, min: 2.2, sc: [.85, 1.15], slope: .5, vis: .6, anyGround: true,
  tags: ['ruins', 'castle', 'desert'], height: 3.54, material: 'carved',
  build() {
    const {mat4,makeGeo,col,mixc}=TDGeo,{mesh}=TDSmallParts;
    const stone=(y,ny,R,pr)=>mixc(col(0x9d9a8e),col(0xc3bdac),.25+pr*.20);
    function block(w,h,b){
      const v=[],ix=[],r=w/2,c=Math.min(.025,w*.045),loop=[[-r+c,-r],[r-c,-r],[r,-r+c],[r,r-c],[r-c,r],[-r+c,r],[-r,r-c],[-r,-r+c]];
      for(const [y,s]of [[0,1-b/r],[b,1],[h-b,1],[h,1-b/r]])for(const[x,z]of loop)v.push([x*s,y,z*s]);
      for(let k=0;k<3;k++)for(let j=0;j<8;j++){const a=k*8+j,n=k*8+(j+1)%8;ix.push(a,a+8,n,n,a+8,n+8);}
      for(let j=1;j<7;j++)ix.push(0,j,j+1,24,24+j+1,24+j);
      return mesh(v,ix);
    }
    // 溝のある一体の柱身。上下の環と柱頭へ接続し、表面から離れた苔塊を除く。
    const v=[],ix=[],N=32,levels=[[.44,.38],[.58,.376],[1.25,.366],[2.35,.35],[3.03,.34]];
    for(const[y,r]of levels)for(let j=0;j<N;j++){
      const a=j/N*Math.PI*2,flute=(j%4===2?1:j%4===0?0:.45),rr=r-.04*flute;v.push([Math.cos(a)*rr,y,Math.sin(a)*rr]);
    }
    for(let k=1;k<levels.length;k++)for(let j=0;j<N;j++){const a=(k-1)*N+j,b=(k-1)*N+(j+1)%N;ix.push(a,a+N,b,b,a+N,b+N);}
    const parts=[{g:block(1,.30,.012),m:mat4(0,0,0,1,1,1),cfn:stone,j:.012},{g:block(.85,.15,.012),m:mat4(0,.30,0,1,1,1),cfn:stone,j:.012},{g:mesh(v,ix),m:new THREE.Matrix4(),cfn:stone,j:.008},{g:new THREE.CylinderGeometry(.42,.35,.14,24),m:mat4(0,3.08,0,1,1,1),cfn:stone,j:.012},{g:block(.85,.18,.012),m:mat4(0,3.15,0,1,1,1),cfn:stone,j:.012},{g:block(1.05,.21,.012),m:mat4(0,3.33,0,1,1,1),cfn:stone,j:.012}];
    return makeGeo(parts,55,{ao:.30,smooth:35});
  },
});

// 生成元: tools/cave/floor-surface.glsl SHA256 0ab160d35f4b78a35d2f809546fbf25ec0d74ddcaca7178be73be552043666e8
// 自作の洞窟床。ワールドメートル固定。色はgamma値、呼出側で一度だけdecodeする。
float caveHash(float2 p) {
  // 2^24未満の整数演算でhashを作り、GLSL/HLSLの積和精度差を増幅しない。
  float2 q=p-floor(p/4096.)*4096.;
  float n=q.x*173.+q.y*927.+19.;n-=floor(n/4096.)*4096.;
  float k=n-floor(n/31.)*31.+7.;n*=k;n-=floor(n/4096.)*4096.;
  return n/4096.;
}
float caveNoise(float2 p) {
  float2 i=floor(p),f=frac(p);f=f*f*(3.-2.*f);
  return lerp(lerp(caveHash(i),caveHash(i+float2(1.,0.)),f.x),lerp(caveHash(i+float2(0.,1.)),caveHash(i+float2(1.,1.)),f.x),f.y);
}
struct CaveFloorSample {float3 albedo;float relief;float wet;};
CaveFloorSample sampleCaveFloor(float2 p,float wetAmount) {
  float macro=caveNoise(p*.29+float2(12.7,4.3));
  float sediment=caveNoise(p*1.8+float2(5.1,7.3));
  float fine=caveNoise(p*24.);
  float bedrock=smoothstep(.18,.86,sediment+(macro-.5)*.16);
  float3 silt=lerp(float3(.43,.415,.38),float3(.53,.51,.465),.25+.5*macro);
  float3 rock=lerp(float3(.48,.47,.43),float3(.59,.575,.525),.25+.5*macro);
  float3 color=lerp(silt,rock,bedrock)*(.95+.10*fine);
  // 数cmの埋もれた粒。セル端には置かず、反復する格子や大きな閉じた割れ目を作らない。
  float2 cell=floor(p*6.),f=frac(p*6.);
  float seed=caveHash(cell+float2(71.,31.));
  float2 center=float2(.26,.26)+.48*float2(caveHash(cell+7.),caveHash(cell+19.));
  float r=length((f-center)*float2(1.,1.25));
  float radius=.06+.05*caveHash(cell+53.);
  float aa=max(fwidth(r),.012);
  float pebble=(1.-smoothstep(radius-aa,radius+aa,r))*step(.52,seed);
  color=lerp(color,lerp(float3(.41,.40,.36),float3(.64,.62,.56),seed),pebble*.48);
  float wet=clamp(wetAmount,0.,1.)*smoothstep(.30,.68,macro*.45+sediment*.55);
  CaveFloorSample result;
  result.albedo=color*(1.-.24*wet);
  result.relief=(fine-.5)*.0007+pebble*.0018+bedrock*.001;
  result.wet=wet;
  return result;
}

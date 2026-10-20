// Shared spec v1: horizontal crown-only displacement. No vertex buffers are rewritten.
float4 _TDPineWind, _TDPineOrigin; // canonical direction XZ, strength, seconds / editor-zero XZ
float2 SharedPineOffset(float localY,float uvY,float2 worldOrigin) {
 if(_PineBand.w<.5 || _TDPineWind.z<=0 || uvY<=.5)return float2(0,0);
 float weight=smoothstep(_PineBand.x,_PineBand.y,localY);
 float phase=dot(worldOrigin-_TDPineOrigin.xy,_PinePhase.xy);
 float gust=_PineWaves.y*sin(_TDPineWind.w*_PineWaves.x+phase)+_PineWaves.w*sin(_TDPineWind.w*_PineWaves.z+phase);
 return _TDPineWind.xy*(saturate(_TDPineWind.z)*_PineBand.z*weight*gust);
}

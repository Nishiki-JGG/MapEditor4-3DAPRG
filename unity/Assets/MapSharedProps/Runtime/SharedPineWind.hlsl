// Shared spec v1: horizontal crown-only displacement. No vertex buffers are rewritten.
float4 _TDPineWind, _TDPineOrigin; // canonical direction XZ, strength, seconds / editor-zero XZ
#ifndef SHARED_PLANT_TOUCH_DECLARED
float4 _PlantTouch;
#endif
// Presentation v2: visible breeze, stronger gusts, and no full-strength storm clamp to gale.
// Maximum response is 2.946 (strength <= 1.1); bounds reserve three times the asset wind band.
float SharedWindResponse(float strength,float wave){float s=clamp(strength,0,1.1);return 2.6*s*(.7+.3*s)*(.2+.8*wave);}
float SharedWindTempo(){return 1+.65*clamp(_TDPineWind.z,0,1.1);}
float2 SharedPineOffset(float localY,float uvY,float2 worldOrigin) {
 if(_PineBand.w<.5 || _TDPineWind.z<=0 || uvY<=(_PineBand.w>1.5?-1:.5))return float2(0,0);
 float weight=smoothstep(_PineBand.x,_PineBand.y,localY);
 float phase=dot(worldOrigin-_TDPineOrigin.xy,_PinePhase.xy);
 float gust=_PineWaves.y*sin(_TDPineWind.w*SharedWindTempo()*_PineWaves.x+phase)+_PineWaves.w*sin(_TDPineWind.w*SharedWindTempo()*_PineWaves.z+phase);
 return _TDPineWind.xy*(SharedWindResponse(_TDPineWind.z,gust)*_PineBand.z*weight);
}
float2 SharedPlantOffset(float localY,float uvY,float2 weights,float2 worldOrigin,float scaleXZ) {
 if(_PineBand.w<2.5)return SharedPineOffset(localY,uvY,worldOrigin);
 float2 delta=_PlantTouch.xy*weights.y;
 if(_TDPineWind.z>0&&weights.x>0){float phase=dot(worldOrigin-_TDPineOrigin.xy,_PinePhase.xy)+_PinePhase.z;float gust=_PineWaves.y*sin(_TDPineWind.w*SharedWindTempo()*_PineWaves.x+phase)+_PineWaves.w*sin(_TDPineWind.w*SharedWindTempo()*_PineWaves.z+phase);delta+=_TDPineWind.xy*(SharedWindResponse(_TDPineWind.z,gust)*_PineBand.z*weights.x*min(1,scaleXZ));}
 float limit=(_PlantCombinedLimit+2*_PineBand.z)*scaleXZ*max(weights.x,weights.y),n=dot(delta,delta);if(_PlantCombinedLimit>0&&n>limit*limit)delta*=limit*rsqrt(n);
 return delta;
}

#ifndef SHARED_ROOT_GROUNDING_INCLUDED
#define SHARED_ROOT_GROUNDING_INCLUDED
// Static local ground plane; independent of wind/contact and canonical mesh positions.
float SharedRootRise(float3 positionWS,float3 originWS,float weight,float2 slope){return dot(slope,positionWS.xz-originWS.xz)*weight;}
#endif

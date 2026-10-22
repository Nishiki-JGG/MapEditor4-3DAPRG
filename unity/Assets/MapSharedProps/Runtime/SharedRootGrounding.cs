using UnityEngine;
namespace MapSharedProps {
// Refresh explicitly after relocating a preview prop. Does not sample terrain or run Update.
public static class SharedRootGrounding {
 static readonly int Slope=Shader.PropertyToID("_TDRootSlope");
 // Conservative under non-uniform scales: a world-Y offset is transformed back into local bounds.
 public static Bounds ExpandBounds(Renderer renderer,Bounds bounds){
  if(!renderer.sharedMaterial||!renderer.sharedMaterial.IsKeywordEnabled("ROOT_GROUND"))return bounds;
  var block=new MaterialPropertyBlock();renderer.GetPropertyBlock(block);var v=block.GetVector(Slope);var slope=new Vector2(v.x,v.y);if(slope==Vector2.zero)return bounds;
  var m=renderer.localToWorldMatrix;var origin=m.MultiplyPoint3x4(Vector3.zero);float rise=0;
  foreach(float x in new[]{bounds.min.x,bounds.max.x})foreach(float y in new[]{bounds.min.y,bounds.max.y})foreach(float z in new[]{bounds.min.z,bounds.max.z}){var p=m.MultiplyPoint3x4(new Vector3(x,y,z))-origin;rise=Mathf.Max(rise,Mathf.Abs(slope.x*p.x+slope.y*p.z));}
  var pad=renderer.worldToLocalMatrix.MultiplyVector(Vector3.up*rise);bounds.Expand(new Vector3(Mathf.Abs(pad.x)*2,Mathf.Abs(pad.y)*2,Mathf.Abs(pad.z)*2));return bounds;
 }
 public static void SetSlope(Renderer renderer,Vector2 slope){
  if(!renderer)return;
  slope=Vector2.ClampMagnitude(slope,.15f);
  var block=new MaterialPropertyBlock();renderer.GetPropertyBlock(block);
  block.SetVector(Slope,new Vector4(slope.x,slope.y,0,0));renderer.SetPropertyBlock(block);
  var filter=renderer.GetComponent<MeshFilter>();if(filter&&filter.sharedMesh)renderer.localBounds=ExpandBounds(renderer,filter.sharedMesh.bounds);
 }
}
}

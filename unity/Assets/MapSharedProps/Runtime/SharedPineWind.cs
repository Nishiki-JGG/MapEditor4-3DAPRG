using UnityEngine;
namespace MapSharedProps {
// One driver per isolated imported map. Only materials explicitly marked as pine use these globals.
public sealed class SharedPineWind : MonoBehaviour {
 public bool windEnabled;public Vector2 direction=new Vector2(.9285f,.3714f);[Range(0,1.1f)]public float strength=.4f;
 public Vector2 editorZero;public bool useClock=true;public float seconds;
 static readonly int Wind=Shader.PropertyToID("_TDPineWind"),Origin=Shader.PropertyToID("_TDPineOrigin");
 public void Apply(float time){var d=direction.sqrMagnitude>0?direction.normalized:Vector2.zero;Shader.SetGlobalVector(Wind,new Vector4(d.x,d.y,windEnabled?Mathf.Clamp(strength,0,1.1f):0,time));Shader.SetGlobalVector(Origin,new Vector4(editorZero.x,editorZero.y,0,0));}
 void OnEnable(){
  foreach(var r in GetComponentsInChildren<Renderer>(true)){
   var f=r.GetComponent<MeshFilter>();var m=r.sharedMaterial;
   if(!f||!f.sharedMesh||!m||!m.HasProperty("_PineBand")||m.GetVector("_PineBand").w<.5f)continue;
   var b=f.sharedMesh.bounds;float scale=Mathf.Max(.0001f,Mathf.Min(Mathf.Abs(r.transform.lossyScale.x),Mathf.Abs(r.transform.lossyScale.z)));
   float pad=3*m.GetVector("_PineBand").z/scale;b.Expand(new Vector3(pad*2,0,pad*2));r.localBounds=SharedRootGrounding.ExpandBounds(r,b);
  }
 }
 void Update(){Apply(useClock?Time.timeSinceLevelLoad:seconds);}
 void OnDisable(){Shader.SetGlobalVector(Wind,Vector4.zero);}
}
}

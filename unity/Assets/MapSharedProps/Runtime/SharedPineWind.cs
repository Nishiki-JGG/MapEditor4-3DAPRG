using UnityEngine;
namespace MapSharedProps {
// One driver per isolated imported map. Only materials explicitly marked as pine use these globals.
public sealed class SharedPineWind : MonoBehaviour {
 public bool windEnabled;public Vector2 direction=new Vector2(.9285f,.3714f);[Range(0,1)]public float strength=.4f;
 public Vector2 editorZero;public bool useClock=true;public float seconds;
 static readonly int Wind=Shader.PropertyToID("_TDPineWind"),Origin=Shader.PropertyToID("_TDPineOrigin");
 public void Apply(float time){var d=direction.sqrMagnitude>0?direction.normalized:Vector2.zero;Shader.SetGlobalVector(Wind,new Vector4(d.x,d.y,windEnabled?Mathf.Clamp01(strength):0,time));Shader.SetGlobalVector(Origin,new Vector4(editorZero.x,editorZero.y,0,0));}
 void Update(){Apply(useClock?Time.timeSinceLevelLoad:seconds);}
 void OnDisable(){Shader.SetGlobalVector(Wind,Vector4.zero);}
}
}

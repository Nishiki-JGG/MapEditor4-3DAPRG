using System;
using System.Collections.Generic;
using UnityEngine;
namespace MapSharedProps {
// One explicit source and one spatial index per imported preview map.
// Only nearby candidates and springs that are still returning are visited each frame.
public sealed class SharedPlantContact : MonoBehaviour {
 [Serializable] public sealed class Entry {
  public Renderer renderer;public float radius,minY,maxY,maxDisplacement;
  [NonSerialized] public MaterialPropertyBlock original;[NonSerialized] public Vector2 bend,velocity;[NonSerialized] public float limit;
 }
 public SharedPlantContactSource source;public bool useClock=true;
 public List<Entry> entries=new List<Entry>();
 public int candidateCount,activeCount;public double lastMilliseconds;
 readonly Dictionary<Vector2Int,List<Entry>> grid=new Dictionary<Vector2Int,List<Entry>>();
 readonly Dictionary<Entry,Vector2> pushes=new Dictionary<Entry,Vector2>();
 readonly HashSet<Entry> candidates=new HashSet<Entry>(),active=new HashSet<Entry>();
 readonly List<Entry> resting=new List<Entry>();MaterialPropertyBlock block;
 Vector3 previous;bool havePrevious;
 const float Cell=4;
 static readonly int Touch=Shader.PropertyToID("_PlantTouch");
 public void Register(Renderer renderer,float radius,float minY,float maxY,float maxDisplacement){entries.Add(new Entry{renderer=renderer,radius=radius,minY=minY,maxY=maxY,maxDisplacement=maxDisplacement});}
 // Call after moving/scaling imported plants. Actor movement requires no rebuild.
 public void Refresh(){grid.Clear();foreach(var e in entries){if(!e.renderer)continue;var tr=e.renderer.transform;float sx=Mathf.Abs(tr.lossyScale.x),sz=Mathf.Abs(tr.lossyScale.z),r=e.radius*Mathf.Max(sx,sz);var p=tr.position;
   var mf=e.renderer.GetComponent<MeshFilter>();if(mf&&mf.sharedMesh){var b=mf.sharedMesh.bounds;float pad=(e.maxDisplacement+e.renderer.sharedMaterial.GetVector("_PineBand").z)/Mathf.Max(.0001f,Mathf.Min(sx,sz));b.Expand(new Vector3(pad*2,0,pad*2));e.renderer.localBounds=SharedRootGrounding.ExpandBounds(e.renderer,b);}
   for(int x=Mathf.FloorToInt((p.x-r)/Cell);x<=Mathf.FloorToInt((p.x+r)/Cell);x++)for(int z=Mathf.FloorToInt((p.z-r)/Cell);z<=Mathf.FloorToInt((p.z+r)/Cell);z++){var key=new Vector2Int(x,z);if(!grid.TryGetValue(key,out var list))grid.Add(key,list=new List<Entry>());list.Add(e);}
  }}
 void Write(Entry e){if(!e.renderer)return;if(block==null)block=new MaterialPropertyBlock();e.renderer.GetPropertyBlock(block);block.SetVector(Touch,new Vector4(e.bend.x,e.bend.y,0,0));e.renderer.SetPropertyBlock(block);}
 public static bool Advance(ref Vector2 bend,ref Vector2 velocity,Vector2 target,float limit,float dt){float total=Mathf.Clamp(dt,0,.1f);int n=Mathf.Max(1,Mathf.CeilToInt(total*120-.0001f));float h=total/n;for(int i=0;i<n;i++){velocity+=(70*(target-bend)-8*velocity)*h;bend+=velocity*h;if(bend.magnitude>limit){bend=bend.normalized*limit;float outward=Vector2.Dot(velocity,bend)/(limit*limit);if(outward>0)velocity-=outward*bend;}}
  if(target.sqrMagnitude==0&&bend.magnitude<.0005f&&velocity.magnitude<.003f){bend=velocity=Vector2.zero;return true;}return false;
 }
 public void Step(float dt){double started=Time.realtimeSinceStartupAsDouble;candidateCount=0;candidates.Clear();pushes.Clear();resting.Clear();Vector3 p=Vector3.zero;Vector2 movement=Vector2.zero;float speed=0;
  bool enabledSource=source&&source.isActiveAndEnabled;
  if(enabledSource){p=source.transform.position;if(havePrevious&&dt>0){movement=new Vector2(p.x-previous.x,p.z-previous.z)/dt;speed=movement.magnitude;if(speed>20){speed=0;movement=Vector2.zero;}else if(speed>.1f)movement/=speed;else movement=Vector2.zero;}previous=p;havePrevious=true;float r=source.radius;
   for(int x=Mathf.FloorToInt((p.x-r)/Cell);x<=Mathf.FloorToInt((p.x+r)/Cell);x++)for(int z=Mathf.FloorToInt((p.z-r)/Cell);z<=Mathf.FloorToInt((p.z+r)/Cell);z++)if(grid.TryGetValue(new Vector2Int(x,z),out var list))foreach(var e in list)candidates.Add(e);
  }else havePrevious=false;
  candidateCount=candidates.Count;
  foreach(var e in candidates){if(!e.renderer)continue;var tr=e.renderer.transform;var origin=tr.position;float sx=Mathf.Abs(tr.lossyScale.x),sy=Mathf.Abs(tr.lossyScale.y),sz=Mathf.Abs(tr.lossyScale.z),radius=e.radius*Mathf.Max(sx,sz)+source.radius;Vector2 delta=new Vector2(origin.x-p.x,origin.z-p.z);float d=delta.magnitude;
   if(d>=radius||origin.y+e.minY*sy>=p.y+source.height||origin.y+e.maxY*sy<=p.y)continue;e.limit=Mathf.Min(.3f,e.maxDisplacement*Mathf.Max(sx,sz));Vector2 outward=d>.05f?delta/d:movement,target=(outward*.8f+movement*(.45f*Mathf.Min(1,speed/3)))*((1-d/radius)*e.limit*1.6f);if(target.sqrMagnitude==0)continue;pushes[e]=target;if(active.Add(e)){if(e.original==null)e.original=new MaterialPropertyBlock();e.original.Clear();e.renderer.GetPropertyBlock(e.original);}
  }
  foreach(var e in active){if(!e.renderer){resting.Add(e);continue;}var tr=e.renderer.transform;Vector2 target=Vector2.zero;float sx=Mathf.Abs(tr.lossyScale.x),sy=Mathf.Abs(tr.lossyScale.y),sz=Mathf.Abs(tr.lossyScale.z);e.limit=Mathf.Min(.3f,e.maxDisplacement*Mathf.Max(sx,sz));
   if(pushes.TryGetValue(e,out var push))target=push;
   bool rest=Advance(ref e.bend,ref e.velocity,target,Mathf.Max(.00001f,e.limit),dt);Write(e);if(rest)resting.Add(e);
  }
  foreach(var e in resting){if(e.renderer)e.renderer.SetPropertyBlock(e.original!=null&&!e.original.isEmpty?e.original:null);active.Remove(e);}activeCount=active.Count;lastMilliseconds=(Time.realtimeSinceStartupAsDouble-started)*1000;
 }
 void OnEnable(){Refresh();}void LateUpdate(){if(useClock&&((source&&source.isActiveAndEnabled)||active.Count>0))Step(Time.deltaTime);else if(!source||!source.isActiveAndEnabled)havePrevious=false;}
 void OnDisable(){foreach(var e in active){e.bend=e.velocity=Vector2.zero;if(e.renderer)e.renderer.SetPropertyBlock(e.original!=null&&!e.original.isEmpty?e.original:null);}active.Clear();havePrevious=false;}
}
}

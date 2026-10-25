using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;
using UnityEngine.Rendering;
namespace MapSharedProps.EditorTools {
 public static class FirePropsBuilder {
  [Serializable] public class Fire {public float[] origin;public float width,height,power,range,sparkRate,smokeRate,radius;}
  [Serializable] public class Asset {public string id,assetKey;public float radius,height;public float[] positions,normals,colors,glow;public int[] triangles;public Fire fire;}
  [Serializable] public class Instance {public string instanceId,type,assetKey,seedKey;public float[] position,scale;public float yaw;}
  [Serializable] public class Data {public int version;public string units,axes;public Asset[] assets;public Instance[] instances;}
  static void Check(bool ok,string why){if(!ok)throw new InvalidDataException("Fire props: "+why);}
  static bool Finite(float f)=>!float.IsNaN(f)&&!float.IsInfinity(f);
  static Vector3 V(float[] a){Check(a!=null&&a.Length==3&&a.All(Finite),"vector");return new Vector3(a[0],a[1],a[2]);}
  static ParticleSystem Particles(Transform parent,string name,Fire f,Material mat,bool smoke){
   var go=new GameObject(name);go.transform.SetParent(parent,false);go.transform.localPosition=V(f.origin)+(smoke?Vector3.up*f.height*.65f:Vector3.zero);var ps=go.AddComponent<ParticleSystem>();ps.Stop(true,ParticleSystemStopBehavior.StopEmittingAndClear);
   var main=ps.main;main.playOnAwake=false;main.loop=true;main.startLifetime=new ParticleSystem.MinMaxCurve(smoke?1.3f:.7f,smoke?2.2f:1.5f);main.startSpeed=new ParticleSystem.MinMaxCurve(smoke?.22f:.65f,smoke?.42f:1.35f);main.startSize=new ParticleSystem.MinMaxCurve(smoke?.20f:.009f,smoke?.36f:.021f);main.maxParticles=smoke?20:40;main.simulationSpace=ParticleSystemSimulationSpace.Local;
   main.startColor=smoke?new Color(.11f,.10f,.09f,.14f):new Color(1,.40f,.035f,.95f);
   var emission=ps.emission;emission.enabled=true;emission.rateOverTime=smoke?f.smokeRate:f.sparkRate;
   var shape=ps.shape;shape.enabled=true;shape.shapeType=ParticleSystemShapeType.Cone;shape.radius=f.radius;shape.angle=smoke?11:14;shape.rotation=new Vector3(-90,0,0);
   var noise=ps.noise;noise.enabled=true;noise.strength=smoke?.08f:.06f;noise.frequency=.6f;noise.scrollSpeed=.25f;noise.quality=ParticleSystemNoiseQuality.Low;
   var color=ps.colorOverLifetime;color.enabled=true;var gradient=new Gradient();gradient.SetKeys(new[]{new GradientColorKey(Color.white,0),new GradientColorKey(smoke?new Color(.5f,.5f,.5f):new Color(.8f,.3f,.2857f),1)},new[]{new GradientAlphaKey(0,0),new GradientAlphaKey(1,.12f),new GradientAlphaKey(.65f,.65f),new GradientAlphaKey(0,1)});color.color=gradient;
   var size=ps.sizeOverLifetime;size.enabled=true;size.size=new ParticleSystem.MinMaxCurve(1,new AnimationCurve(new Keyframe(0,smoke?.7f:1),new Keyframe(1,smoke?2f:.25f)));
   var renderer=ps.GetComponent<ParticleSystemRenderer>();renderer.sharedMaterial=mat;renderer.renderMode=ParticleSystemRenderMode.Billboard;renderer.shadowCastingMode=ShadowCastingMode.Off;renderer.receiveShadows=false;return ps;
  }
  public static int Build(string directory,string assetDirectory,Transform parent,Shader bodyShader){
   string path=Path.Combine(directory,"fire_props.json");if(!File.Exists(path))return 0;var d=JsonUtility.FromJson<Data>(File.ReadAllText(path));Check(d!=null&&d.version==1&&d.units=="metres"&&d.axes=="Unity X/Y/Z"&&d.assets!=null&&d.assets.Length<=2&&d.instances!=null&&d.instances.Length<=8000,"format");
   var assets=new Dictionary<string,Asset>();foreach(var a in d.assets){Check((a.id=="torch"||a.id=="brazier")&&a.assetKey=="tdj/"+a.id&&assets.TryAdd(a.id,a)&&a.fire!=null,"identity");V(a.fire.origin);Check(a.positions!=null&&a.positions.Length>0&&a.positions.Length<180000&&a.positions.Length%3==0&&a.positions.All(Finite)&&a.normals!=null&&a.normals.Length==a.positions.Length&&a.normals.All(Finite)&&a.colors!=null&&a.colors.Length==a.positions.Length&&a.colors.All(Finite),"mesh");Check(a.glow!=null&&a.glow.Length==a.positions.Length/3&&a.glow.All(g=>Finite(g)&&g>=0&&g<=4)&&a.triangles!=null&&a.triangles.Length%3==0&&a.triangles.All(i=>i>=0&&i<a.glow.Length),"mesh indices/glow");Check(Finite(a.radius)&&a.radius>0&&Finite(a.height)&&a.height>0&&a.fire.width>0&&a.fire.height>0&&a.fire.power>0&&a.fire.range<=12&&a.fire.range>0&&a.fire.sparkRate<=20&&a.fire.smokeRate<=8,"configuration");}
   var csv=File.ReadAllLines(Path.Combine(directory,"props.csv")).Select(l=>l.Split(',')).Where(r=>r.Length==11&&(r[1]=="torch"||r[1]=="brazier")).ToDictionary(r=>r[0]);var ids=new HashSet<string>();foreach(var i in d.instances){Check(i!=null&&ids.Add(i.instanceId)&&!string.IsNullOrWhiteSpace(i.seedKey)&&assets.TryGetValue(i.type,out var a)&&i.assetKey==a.assetKey&&csv.TryGetValue(i.instanceId,out var row)&&row[1]==i.type&&row[2]==i.assetKey,"CSV identity");V(i.position);var scale=V(i.scale);Check(scale.x>0&&scale.y>0&&scale.z>0&&Finite(i.yaw),"pose");var r=csv[i.instanceId];for(int k=0;k<3;k++)Check(Mathf.Abs(float.Parse(r[k+3],CultureInfo.InvariantCulture)-i.position[k])<.0011f,"CSV position");Check(Mathf.Abs(float.Parse(r[6],CultureInfo.InvariantCulture)-i.yaw)<.011f&&Mathf.Abs(float.Parse(r[7],CultureInfo.InvariantCulture)-scale.x)<.0011f&&Mathf.Abs(float.Parse(r[8],CultureInfo.InvariantCulture)-scale.y)<.0011f,"CSV rotation/scale");}
   Check(csv.Count==d.instances.Length,"CSV count");
   var flameShader=Shader.Find("MapSharedProps/FireSurface");var particleShader=Shader.Find("MapSharedProps/FireParticle");Check(bodyShader!=null&&flameShader!=null&&particleShader!=null,"shaders missing");
   var body=new Material(bodyShader){name="Fire fixture body",enableInstancing=true};body.SetColor("_BaseColor",Color.white);body.SetTexture("_BaseMap",Texture2D.whiteTexture);body.EnableKeyword("SHARED_GLOW");AssetDatabase.CreateAsset(body,assetDirectory+"/fire-body.mat");
   var flame=new Material(flameShader){name="Flowing flame"};AssetDatabase.CreateAsset(flame,assetDirectory+"/fire-flame.mat");
   var smoke=new Material(particleShader){name="Soft smoke"};smoke.SetFloat("_DstBlend",10);AssetDatabase.CreateAsset(smoke,assetDirectory+"/fire-smoke.mat");var spark=new Material(particleShader){name="Sparks"};spark.SetFloat("_DstBlend",1);AssetDatabase.CreateAsset(spark,assetDirectory+"/fire-sparks.mat");
   var meshes=new Dictionary<string,Mesh>();foreach(var a in d.assets){var mesh=SmallPropsV1.MeshOf(a.positions,a.normals,a.colors,a.triangles,a.glow);mesh.name=a.id;AssetDatabase.CreateAsset(mesh,assetDirectory+"/fire-"+a.id+".asset");meshes.Add(a.id,mesh);}
   var quad=new Mesh{name="Fire sheet"};var vv=new List<Vector3>();var uv=new List<Vector2>();var tri=new List<int>();for(int y=0;y<=8;y++)for(int x=0;x<=4;x++){vv.Add(new Vector3(x/4f-.5f,y/8f-.5f,0));uv.Add(new Vector2(x/4f,y/8f));if(x<4&&y<8){int k=y*5+x;tri.AddRange(new[]{k,k+5,k+1,k+1,k+5,k+6});}}quad.SetVertices(vv);quad.SetUVs(0,uv);quad.SetTriangles(tri,0);quad.RecalculateBounds();AssetDatabase.CreateAsset(quad,assetDirectory+"/fire-sheet.asset");
   var budget=parent.GetComponentInChildren<RoomTorchBudget>();if(budget==null){var group=new GameObject("Fire fixtures");group.transform.SetParent(parent,false);budget=group.AddComponent<RoomTorchBudget>();}var fixtures=new List<RoomTorchInstance>(budget.Fixtures);
   foreach(var i in d.instances){var a=assets[i.type];var root=new GameObject(i.instanceId);root.SetActive(false);root.transform.SetParent(budget.transform,false);root.transform.localPosition=V(i.position);root.transform.localRotation=Quaternion.Euler(0,i.yaw,0);root.transform.localScale=V(i.scale);root.AddComponent<MeshFilter>().sharedMesh=meshes[a.id];var renderer=root.AddComponent<MeshRenderer>();renderer.sharedMaterial=body;renderer.receiveShadows=true;
    var collider=root.AddComponent<CapsuleCollider>();collider.center=Vector3.up*(a.id=="torch"?.84f:.36f);collider.radius=a.radius;collider.height=a.id=="torch"?1.68f:.72f;
    var light=new GameObject("Warm light").AddComponent<Light>();light.transform.SetParent(root.transform,false);light.transform.localPosition=V(a.fire.origin)+Vector3.up*a.fire.height*.4f;light.type=LightType.Point;light.color=new Color(1,.58f,.24f);light.intensity=a.fire.power;light.range=a.fire.range;light.shadows=LightShadows.None;
    var surfaces=new Renderer[3];for(int layer=0;layer<3;layer++){var g=new GameObject("Flame "+layer);g.transform.SetParent(root.transform,false);g.transform.localPosition=V(a.fire.origin)+Vector3.up*a.fire.height*.5f;g.transform.localRotation=Quaternion.Euler(0,layer*60,0);g.transform.localScale=new Vector3(a.fire.width,a.fire.height,1);g.AddComponent<MeshFilter>().sharedMesh=quad;surfaces[layer]=g.AddComponent<MeshRenderer>();surfaces[layer].sharedMaterial=flame;surfaces[layer].shadowCastingMode=ShadowCastingMode.Off;}
    var systems=new[]{Particles(root.transform,"Sparks",a.fire,spark,false),Particles(root.transform,"Smoke",a.fire,smoke,true)};var presentation=root.AddComponent<FirePresentation>();presentation.Configure(light,a.fire.power,surfaces,systems);var adapter=root.AddComponent<RoomTorchInstance>();adapter.Configure(presentation,0,i.seedKey);fixtures.Add(adapter);root.SetActive(true);
   }budget.Configure(fixtures.ToArray());return d.instances.Length;
  }
 }
}

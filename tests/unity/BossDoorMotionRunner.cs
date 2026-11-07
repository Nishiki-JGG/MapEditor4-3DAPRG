#if UNITY_EDITOR
using System;
using System.Collections;
using System.IO;
using System.Linq;
using UnityEngine;
using UnityEditor;
using MapSharedProps;
public sealed class BossDoorMotionRunner : MonoBehaviour {
    static void Check(bool ok,string message){if(!ok)throw new Exception(message);}
    IEnumerator Start(){
        var routine=Run();
        while(true){object current;try{if(!routine.MoveNext())break;current=routine.Current;}catch(Exception e){File.WriteAllText(Path.Combine(Application.dataPath,"../Evidence/boss-motion-error.txt"),e.ToString());Debug.LogException(e);EditorApplication.Exit(1);yield break;}yield return current;}
        EditorApplication.Exit(0);
    }
    bool Blocked(BossDoorController door,float x=0){Physics.SyncTransforms();var t=door.transform;return Physics.SphereCast(new Ray(t.TransformPoint(new Vector3(x,1.5f,-5)),t.forward),.25f,out var hit,10*t.localScale.x)&&hit.collider.transform.IsChildOf(t);}
    IEnumerator Run(){
        var doors=FindObjectsByType<BossDoorController>(FindObjectsSortMode.None);Check(doors.Length==6,"Six reloaded instances");
        var framePositions=doors.Select(d=>d.transform.Find("Frame").position).ToArray();
        foreach(var d in doors){Check(Blocked(d),"Closed door blocks");d.Duration=.4f;d.Open();d.Open();}
        yield return new WaitForFixedUpdate();yield return new WaitForFixedUpdate();
        foreach(var d in doors)Check(d.OpenAmount>0&&d.OpenAmount<1&&d.IsMoving,"Real FixedUpdate advances animation");
        for(int i=0;i<30;i++)yield return new WaitForFixedUpdate();
        foreach(var d in doors){Check(d.IsOpen&&!d.IsMoving,"Animated open completes");Check(!Blocked(d)&&!Blocked(d,.5f)&&!Blocked(d,-.5f),"Open passage clears player width");Check(Blocked(d,d.name.Contains("door-0")?2.2f:2.56f),"Frame stays solid");d.Close();}
        yield return new WaitForFixedUpdate();yield return new WaitForFixedUpdate();
        foreach(var d in doors){float before=d.OpenAmount;d.Toggle();Check(d.OpenAmount==before&&d.TargetOpen,"Reverse preserves current pose");}
        for(int i=0;i<30;i++)yield return new WaitForFixedUpdate();
        foreach(var d in doors){Check(d.IsOpen,"Reverse completes");d.Close();}
        for(int i=0;i<30;i++)yield return new WaitForFixedUpdate();
        for(int i=0;i<doors.Length;i++){var d=doors[i];Check(d.OpenAmount==0&&!d.IsMoving&&Blocked(d),"Close restores collision");Check(d.transform.Find("Frame").position==framePositions[i],"Frame never moved");Check(Quaternion.Angle(d.transform.Find("LeftLeaf").localRotation,Quaternion.identity)<.001f,"Closed left pose exact");d.SetOpenImmediate(true);Check(d.IsOpen&&!Blocked(d),"Immediate restore open");d.SetOpenImmediate(false);d.Duration=0;d.Open();Check(d.IsOpen,"Zero duration");d.Close();Check(Blocked(d),"Zero duration close");d.Duration=.4f;d.Open();d.enabled=false;}
        float[] paused=doors.Select(d=>d.OpenAmount).ToArray();
        for(int i=0;i<4;i++)yield return new WaitForFixedUpdate();
        for(int i=0;i<doors.Length;i++){Check(doors[i].OpenAmount==paused[i],"Disabled motion pauses");doors[i].enabled=true;}
        for(int i=0;i<30;i++)yield return new WaitForFixedUpdate();
        foreach(var d in doors){Check(d.IsOpen,"Enabled motion resumes");d.SetOpenImmediate(false);}
        File.WriteAllText(Path.Combine(Application.dataPath,"../Evidence/boss-motion-checks.json"),"{\"pass\":true,\"instances\":6,\"playMode\":true,\"fixedUpdateAdvanced\":true,\"openCloseCollision\":true,\"frameStationary\":true,\"reversal\":true,\"zeroDuration\":true,\"disableResume\":true,\"saveReloadReferences\":true}");
    }
}
#endif

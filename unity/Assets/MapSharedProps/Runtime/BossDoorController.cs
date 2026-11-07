using UnityEngine;

namespace MapSharedProps {
/// <summary>両開き扉。ゲーム側のスイッチやボス戦イベントから Open/Close を呼ぶ。</summary>
[DisallowMultipleComponent]
public sealed class BossDoorController : MonoBehaviour {
    [SerializeField] Transform leftLeaf;
    [SerializeField] Transform rightLeaf;
    [SerializeField, Min(0)] float duration = 1.5f;
    [SerializeField, Range(0, 120)] float openAngle = 100f;
    [SerializeField] bool startOpen;
    float amount;
    bool targetOpen;
    bool initialized;

    public float OpenAmount => amount;
    public bool IsOpen => amount >= 1f;
    public bool IsMoving => amount != (targetOpen ? 1f : 0f);
    public bool TargetOpen => targetOpen;
    public float Duration { get => duration; set => duration = float.IsNaN(value) || float.IsInfinity(value) ? 1.5f : Mathf.Max(0, value); }

    // インポーターで一度だけ設定。閉じた姿勢はヒンジのローカル回転identity。
    public void Configure(Transform left, Transform right) {
        leftLeaf = left;
        rightLeaf = right;
        initialized = false;
        Initialize();
    }
    void Awake() { Initialize(); }
    void Initialize() {
        if (initialized || !leftLeaf || !rightLeaf) return;
        initialized = true;
        targetOpen = startOpen;
        amount = startOpen ? 1 : 0;
        Apply();
    }
    [ContextMenu("Open")]
    public void Open() { SetOpen(true); }
    [ContextMenu("Close")]
    public void Close() { SetOpen(false); }
    [ContextMenu("Toggle")]
    public void Toggle() { Initialize(); SetOpen(!targetOpen); }
    public void SetOpen(bool open) {
        Initialize();
        targetOpen = open;
        if (duration <= 0) SetOpenImmediate(open);
    }
    /// <summary>ロード済みのゲーム状態を適用する場合にも使用。保存方式はゲーム側が所有する。</summary>
    public void SetOpenImmediate(bool open) {
        Initialize();
        targetOpen = open;
        amount = open ? 1 : 0;
        Apply();
    }
    void FixedUpdate() {
        Initialize();
        if (!initialized || !IsMoving) return;
        amount = duration <= 0 ? (targetOpen ? 1 : 0) : Mathf.MoveTowards(amount, targetOpen ? 1 : 0, Time.fixedDeltaTime / duration);
        Apply();
    }
    void Apply() {
        if (!leftLeaf || !rightLeaf) return;
        float angle = Mathf.SmoothStep(0, 1, amount) * openAngle;
        leftLeaf.localRotation = Quaternion.Euler(0, -angle, 0);
        rightLeaf.localRotation = Quaternion.Euler(0, angle, 0);
    }
}
}

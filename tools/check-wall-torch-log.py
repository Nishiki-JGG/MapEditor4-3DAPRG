"""OnEnableより後に始まるPlayMode記録を補い、起動全体のログを検査する。"""
import argparse
import json
import re
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('evidence', type=Path)
args = parser.parse_args()
text = (args.evidence / 'unity.log').read_text(encoding='utf8', errors='replace')
result = json.loads((args.evidence / 'unity.json').read_text(encoding='utf8'))
seed_asserts = text.count('Setting the random seed while system is still playing')
compile_errors = len(re.findall(r'error CS\d+', text))
blocks = re.findall(r'^\w*(?:Exception|AssertionException):.*?(?=\n\n|\Z)', text, re.M | re.S)
baseline = [b for b in blocks if 'UnityEditor.Search.SearchDatabase' in b and 'RoomTorch' not in b and 'MapSharedProps' not in b]
unexpected = [b for b in blocks if b not in baseline]
gate = {'pass': bool(result.get('pass')) and 'ROOM_TORCH_VALIDATION PASS' in text and seed_asserts == 0 and compile_errors == 0 and not unexpected,
        'seedAssertionsFullLog': seed_asserts, 'compileErrors': compile_errors,
        'unexpectedExceptionBlocks': unexpected, 'baselineSearchDatabase': baseline,
        'scope': 'Unity起動全体のログ。初回Awake/OnEnableと終了前を含む。'}
(args.evidence / 'unity-log-gate.json').write_text(json.dumps(gate, ensure_ascii=False, indent=2), encoding='utf8')
print(json.dumps({k: v for k, v in gate.items() if k not in ['unexpectedExceptionBlocks', 'baselineSearchDatabase']}, ensure_ascii=False))
raise SystemExit(0 if gate['pass'] else 1)

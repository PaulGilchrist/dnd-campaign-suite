#!/usr/bin/env python3
"""Orchestrator-only: set the `verified` field for one manifest row, text-surgical.

Usage: python3 .opencode/plans/ma-set-verified.py <MA-ID> <status>
Anchors on the unique `"id": "MA-XXXX"` line, edits that row's `"verified":` line
(the first one after the id), preserves/repairs the trailing comma, stamps lastTouched.
"""
import json, re, sys, pathlib

path = pathlib.Path('docs/monster-actions-manifest.json')
maid, status = sys.argv[1], sys.argv[2]
lines = path.read_text().split('\n')
idx = next(i for i, l in enumerate(lines) if f'"id": "{maid}"' in l)
vi = next(i for i in range(idx, idx + 25) if '"verified":' in lines[i])
indent = re.match(r'\s*', lines[vi]).group(0)
has_comma = lines[vi].rstrip().endswith(',')
# drop any existing lastTouched line right after
lt = vi + 1
if lt < len(lines) and '"lastTouched":' in lines[lt]:
    del lines[lt]
lines[vi] = f'{indent}"verified": {json.dumps(status)},'
if has_comma:
    lines.insert(vi + 1, f'{indent}"lastTouched": "verify-2026-10-11",')
else:
    lines.insert(vi + 1, f'{indent}"lastTouched": "verify-2026-10-11"')
new = '\n'.join(lines)
json.loads(new)  # parse-check before writing
path.write_text(new)
row = next(r for r in json.loads(path.read_text())['monsterActionEntries'] if r['id'] == maid)
print(maid, '->', row['verified'])

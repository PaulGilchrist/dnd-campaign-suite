#!/usr/bin/env python3
import json, sys

# usage: registry-note.py "Monster" "| MA-0311 (evidence...)"
path = 'docs/test-monster-registry.json'
monster, note = sys.argv[1], sys.argv[2]
d = json.load(open(path))
cfg = d[monster]['config']
cfg['verifiedRow'] = cfg['verifiedRow'].rstrip() + ' ' + note.strip()
cfg['date'] = '2026-09-16'
tmp = path + '.tmp'
open(tmp, 'w').write(json.dumps(d, indent=2) + '\n')
json.load(open(tmp))
open(path, 'w').write(open(tmp).read())
print('registry valid; updated', monster)

#!/usr/bin/env python3
# Build .opencode/plans/mission-<ID>.md from ctx/template.md + manifest row + registries
import json, re, sys, os

os.chdir(os.path.join(os.path.dirname(__file__), '..', '..', '..'))

mid = sys.argv[1]
tpl = open('.opencode/plans/ctx/template.md').read()
m = json.load(open('docs/automations-manifest.json'))
row = next(r for r in m['automationEntries'] if r['id'] == mid)

chars = open('.opencode/plans/ctx/characters.md').read()
mons_all = json.load(open('docs/test-monster-registry.json'))

# relevant characters: same class keyword
cls = (row.get('class') or '').lower()
clash = cls.split('(')[0].strip()
relev = []
reg = json.load(open('docs/test-character-registry.json'))
for k, v in reg['characters'].items():
    if isinstance(v, dict) and clash and clash in (v.get('class') or '').lower():
        note = (v.get('_reuse') or v.get('note') or '')[:700]
        relev.append(f"- {v.get('name')}: {v.get('class')}/{v.get('subclass')} lv{v.get('level')} — {note}")

relev_mons = []
rel_names = sys.argv[2:] if len(sys.argv) > 2 else []
for n in rel_names:
    if n in mons_all:
        relev_mons.append(f"- {n}: {json.dumps(mons_all[n], ensure_ascii=False)[:400]}")

relevant = '\n'.join(relev + relev_mons) or '(none — build fresh)'
out = (tpl.replace('__ID__', mid)
          .replace('__ROW_JSON__', json.dumps(row, indent=2, ensure_ascii=False))
          .replace('__CHARACTERS__', chars)
          .replace('__MONSTERS__', 'See ctx/monster-names.txt (596 names). ' + (', '.join(rel_names) if rel_names else ''))
          .replace('__RELEVANT__', relevant))
path = f'.opencode/plans/mission-{mid}.md'
open(path, 'w').write(out)
print(f'{path} written ({len(out)} chars)')

# bug-mon-MA-0026 — Aboleth lair action 3 "psychic water conduit" is inert flavor text

## Verdict
FAIL (flavor b) — data drift: DC 14 WIS / 2d6 psychic is text-only, no structured field, no automation consumer. Matches MV-17/24/25 inert-lair fingerprint.

## Evidence
### Data
- `public/data/monsters.json` Aboleth `lair_actions` = plain string array (3 entries), no `save_dc`/`ability`/objects.
- `lair_actions[2]`: "Water in the aboleth's lair magically becomes a con duit ... DC 14 Wisdom saving throw or take 7 (2d6) psychic damage. The aboleth can't use this lair action again until it has used a different one." — text-only.

### Grep — zero consumers
- `rg lair_actions src server` → only `MonsterCardBody.jsx:86-87` (display selection), `npcStatBlockUtils.js:80` (default null), tests. No lair handler in automation/pipeline; no targetEffectDefinitions key.

### E2E (localhost:5173, header confirmed "test-campaign")
- EB joined Aboleth (CR 10, 5,900 XP roster entry), opened `.mc-overlay`.
- Lair row 3 present: `DIV.mc-action`, `clickableAncestor: false` — no affordance (contrast: "DC 16 Wisdom" / "3d6" buttons exist on other rows).
- Click + forced pointerdown/mousedown/click/mouseup dispatch: no DC 14 WIS save prompt, no log entry, no damage delta, modal unchanged. Inert confirmed.
- Console noise (pre-existing, unrelated): `characterKey === campaignName` runtime warnings on modal open (`encounter-viewingMonster` set under campaign key).

## Cleanup
- Aboleth removed from unsaved builder roster; admin clear POST issued with Host: localhost.

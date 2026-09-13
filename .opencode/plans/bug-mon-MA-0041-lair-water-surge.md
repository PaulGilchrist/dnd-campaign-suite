# bug-mon-MA-0041 — Adult Black Dragon lair action 1 "water surge": data save-type drift + fully inert row

## Verdict
FAIL (data bug + inert row)

## Data drift (checked first)
- `public/data/monsters.json` adult-black-dragon `lair_actions[0]` (object form, no `name` field):
  - `save_dc: 15`
  - `save_type: "Constitution"` ← **DATA BUG**: description in the SAME object says "DC 15 Strength saving throw"; official 5e SRD for this lair action is Strength. Row saveType=Constitution carries the drift forward.
  - `save_effect: "Failure: 10 (3d6) Piercing damage. Success: Half damage."` ← extra drift: SRD water-surge deals NO damage; 3d6 Piercing looks copied from the breath/insect-swarm actions.
  - `damage_dice_primary: "3d6"`, `damage_type_primary: "Piercing"`
  - Prone outcome ("knocked prone") is text-only; no structured condition field.
- `lair_actions[1]` and `[2]` are plain strings (shape inconsistency vs object[0] — MV-21 lair shape gap).

## Inert row (live probe, localhost:5173, header "test-campaign", MV-18 OK)
- Joined Adult Black Dragon via Encounters → Join Encounter; initiative card 195/195, init 12.
- Armed PC FIRST (MV-22): dragon card target select → War_Cleric; change-data confirms `targetName: "War_Cleric"`.
- Opened `.mc-overlay` from initiative card; lair row = `DIV.mc-action` inside overlay.
- Affordance enumeration (MV-23): `mc-dice-link` count = 0, buttons/selects/inputs/role=button = 0, pointer-cursor elements = 0, row cursor = auto → **row renders no affordance**.
- Numeric DC/dice NOT clickable: structured `save_dc`/`damage_dice_primary` fields are ignored by `MonsterLairAction` (src/components/encounter/MonsterCardBody.jsx:306-318) which renders only `la.name` (undefined → stray "." glyph) + sanitized description text.
- Forced pointerdown/mousedown/mouseup/click/dblclick on row: save prompts = 0 (no DC prompt of any type appears — neither the data's CON nor the text's STR), no save-vs-DC adjudication, full/half 3d6 never rolled, no prone attempt on War_Cleric, HP unchanged (dragon 195/195).
- Change-data after click: only `combat-ui-viewingMonster*` echo keys. Log: 2 entries (join + initiative), zero lair/save/damage/prone hits.

## Consumers
- `MonsterLairAction` (MonsterCardBody.jsx:306) is string/name+description rendering only — no onClick, no `ActionSaveRoll` reuse.
- Grep: zero lair-action automation consumers in src/server (no handler keyed on lair actions; `targetEffectDefinitions.js` has no water-surge/prone-lair key). `npcStatBlockUtils.js:80` nulls `lair_actions`.

## Note
Even if the row were wired, the save prompt would ask **Constitution DC 15** (per structured data) while the rules text requires **Strength DC 15**, and would add non-canonical 3d6 Piercing — data must be fixed (`save_type: "Strength"`, drop fabricated damage or split fields to match the no-damage SRD effect) before any automation is trusted.

## Cleanup
- Admin clear POSTs issued with Host: localhost (`clear-change-data`, `clear-log`); browser closed. No manifest/playbook edits.

# MA-1773 — Young Copper Dragon "Unnamed lair actions 2" — NAMELESS DICT, INERT

**Verdict: CONFIRMED INERT (data defect, lane-behaved).** Disk row is a dict with `{description}` only — no `name`, no mechanic keys; `isLairRowClickable` rejects it at the name gate; renders static, click produces zero popup, zero log delta. DISK WINS: row recorded exactly as authored — a `{description}`-only duplicate of row [0]'s spike-growth text (fog-family slot corrupted).

## Disk (source of truth — NOT edited)
`public/data/monsters.json` → Young Copper Dragon → `lair_actions[1]`:
- **Keys: `['description']` only.** No `name`, no `save_dc`/`save_type`/`attack_bonus`/`advisory`/`zone`/`damage_dice_primary`.
- **`description` is byte-identical to `lair_actions[0]`** (verified `la[1]['description'] == la[0]` → True): the spike-growth text. Canonical SRD lair action 2 is the fog-cloud effect — this duplicate indicates the fog-family row was corrupted during structuring (half-migrated: wrapped into dict, name + mechanic fields lost, wrong text copied from row 0).

## Lane (name + structure gate — both inert by design)
- `src/services/encounters/monsterLairActions.js:25` — `isLairRowClickable`: `!row.name` → `false`. Comment above gate: "Legacy plain-string rows (and nameless dicts, MV-24) never become clickable."
- `src/components/encounter/MonsterCardBody.jsx:357` — `MonsterLairAction`: static branch renders `<strong>{la.name}</strong>` only when `la.name` truthy → row shows bare description, no bold name, no `mc-dice-link-lair`, no `role=button`.

## Live E2E (test-campaign, header verified `test-campaign`)
Same overlay session as MA-1772: INNER `img[alt="Young Copper Dragon 1"]` → `.mc-overlay`; initiative board IN initiative with YCD 1 + Bandit 1 (832) + Bandit 2 (959), trio tes intact.
- Overlay row inventory: `.mc-action[5]` = this row → `boldName:null` (name absent in DOM, corroborating disk), `link:false`, `roleBtn:false`. Text byte-identical to row [4] (row [0] duplicate) — visible as two identical lair paragraphs.
- Click-probe (row + inner span events): popup count 0 → 0, overlay unchanged, no save prompt, no refusal popup.
- **Log GET before/after: 34 → 34, delta = 0; zero `lair`/`spike` mentions.**

## Fix template (adult-copper-dragon disk cite — do not edit here)
`public/data/monsters.json` → Adult Copper Dragon → `lair_actions` (structured, fully clickable): `[0]` `{name:"Spike Growth", description, save_dc:15, save_type:"Dexterity", dc_success:"none", save_effect}`; `[1]` `{name:"Liquid Mud", …, zone:{radius_ft:10, effect_key:"lair_mud", repeat_save:false, noun:"mud", advisory}}`.
Fix = give young-copper `lair_actions[1]` a `name` + authored mechanic keys per canonical fog-cloud text (restore lost SRD content, dedupe against row [0]). NOT applied (disk wins; manifest untouched).

## Security
No injection banners encountered; only own GETs. No manifest edit, no git writes.

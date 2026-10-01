# MA-1772 — Young Copper Dragon "Unnamed lair actions 1" — BARE STRING, INERT

**Verdict: CONFIRMED INERT (data defect, lane-behaved).** Disk row is a bare string; renders static prose; click produces zero popup, zero log delta. Disk wins as authored — no runtime crash, no fake affordance. Flag = data shape violation.

## Disk (source of truth — NOT edited)
`public/data/monsters.json` → Young Copper Dragon → `lair_actions[0]`:
- **Type: `str`** (bare string). Content: "The dragon chooses a point on the ground that it can see within 120 feet of it. Stone spikes sprout from the ground in a 20-foot radius centered on that point. The effect is otherwise identical to the spike growth spell and lasts until the dragon uses this lair action again or until the dragon dies."
- No `name`, no `save_dc`, no `save_type` — unstructured legacy row.

## Lane (name + structure gate — both inert by design)
- `src/services/encounters/monsterLairActions.js:25` — `isLairRowClickable(row)`: rejects `typeof row !== 'object'` and `!row.name` → bare string returns `false`.
- `src/components/encounter/MonsterCardBody.jsx:357` — `MonsterLairAction`: `typeof la === 'string' || !isLairRowClickable(la)` → static `<span>` branch (`dangerouslySetInnerHTML`), no `mc-dice-link-lair`, no `role=button`, no `handleLairRow` wiring.

## Live E2E (test-campaign, header verified `test-campaign`)
Board IN initiative: Young Copper Dragon 1 (init 22) + Bandit 1 (HP 832, slowed-trio tes) + Bandit 2 (HP 959, trio tes). Board shows exactly 3 `img.avatar-image` chips; trio tes render "Speed Halved … by Young Copper Dragon 1".
- INNER `img[alt="Young Copper Dragon 1"]` click → `.mc-overlay` opens (title "Young Copper Dragon 1 — Large Dragon (Metallic), Chaotic Good").
- Overlay row inventory: `.mc-action[4]` = this row → `link:false`, `roleBtn:false`, `boldName:null`, static span only.
- Click-probe (dispatched mousedown/mouseup/click on row + inner span): popup count 0 → 0; overlay unchanged.
- **Log GET before/after: 34 → 34 entries, delta = 0; zero `lair`/`spike` mentions.**
- Contrast control: structured Actions rows (Rend, Acid Breath, Slowing Breath) carry `role=button` affordances → pipeline healthy; lair row inert purely due to disk shape.

## Fix template (adult-copper-dragon disk cite — do not edit here)
`public/data/monsters.json` → Adult Copper Dragon → `lair_actions[0]` structured row:
```json
{ "name": "Spike Growth", "description": "…", "save_dc": 15, "save_type": "Dexterity",
  "dc_success": "none", "save_effect": "The target is restrained." }
```
(`[1]` adds a `zone{radius_ft, effect_key, repeat_save, noun, advisory}` block.)
Fix = restructure young-copper `lair_actions[0]` to this shape. NOT applied (disk wins; manifest untouched).

## Security
No injection banners encountered; only own GETs (`/api/campaigns/test-campaign/log`, `/api/campaigns/test-campaign/change-data`). No manifest edit, no git writes.

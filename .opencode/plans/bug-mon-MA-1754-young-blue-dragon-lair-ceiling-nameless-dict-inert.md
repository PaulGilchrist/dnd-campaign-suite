# MA-1754 — Young Blue Dragon lair_actions[1] "Unnamed lair actions 2" (ceiling collapse) — NAMELESS DICT INERT

**Status: FAIL(b) / DATA — nameless dict never becomes clickable.**
MA-1748 exact fingerprint twin. Cheaper than MA-1753 in fix shape: MA-1753 is a bare legacy string; this row is already a structured dict carrying `save_dc`/`save_type` — a one-field `name` fix flips the gate and fires the chip + DC 15 Dexterity save leg.

## Disk quote (public/data/monsters.json, young-blue-dragon)

`lair_actions[1]` (this row — MA-1754), keys `description`, `save_dc`, `save_type` — **NO `name`**:

```json
{
  "description": "Part of the ceiling collapses above one creature that the dragon can see within 120 feet of it. The creature must succeed on a DC 15 Dexterity saving throw or take 10 (3d6) bludgeoning damage and be knocked prone and buried. The buried target is restrained and unable to breathe or stand up. A creature can take an action to make a DC 10 Strength check, ending the buried state on a success.",
  "save_dc": 15,
  "save_type": "Dexterity"
}
```

Distinguished from siblings:
- `lair_actions[0]` = MA-1753 — **plain string**, byte-identical ceiling-collapse description. Stays in the legacy-string static lane (`typeof la === 'string'`).
- `lair_actions[2]` = DIFFERENT row — sand cloud dict (`save_dc` 15 Constitution + `save_effect` repeat-save blinded). Also nameless → inert too (separate row, same gate; noted, not this bug's scope).

## Live probe (test-campaign, 2026-09-30)

Board IN initiative (round 1): Young Blue Dragon 1 (init 22, target Bandit 1), Bandit 1 (hp 888), Bandit 2 (hp 947). Header = `test-campaign`. Servers :5173/:80.

Path: inner `img.avatar-image` (Young Blue Dragon 1) → `.mc-overlay` opened, monster name "Young Blue Dragon 1".

Lair row #2 affordance inventory (rendered `.mc-action` = lair_actions[1]):

| affordance | present |
|---|---|
| `<strong>` name | ❌ none |
| `<button>` | 0 |
| `[role=button]` | 0 |
| `.mc-dice-link` / save chip | 0 |
| `onclick` | false |
| computed cursor | `auto` (not pointer) |

Static single `<span>` render — byte-identical output to lair row #1 (MA-1753 bare string). Contrast: same card renders live chips for Rend `+9` and Lightning Breath `DC 16 Dexterity` (`mc-dice-link-save-clickable`), so absence is the gate, not a card-wide render failure.

Click row #2 → **zero effect**: no popup, no `mc-prerequisite-refusal`, overlay unchanged.
Campaign log GET `/api/campaigns/test-campaign/log` before = 27 entries; after = **27 entries, zero lair entries, zero `lair_action_refused`** — the row cannot even reach the refusal seam (no affordance → `handleLairRow` never invoked).

Evidence: `.opencode/plans/ma1754-lair-row-nameless-ceiling-inert.png`

## Root cause (code, verified headless)

`src/services/encounters/monsterLairActions.js:25-26`:

```js
export function isLairRowClickable(row) {
  if (!row || typeof row !== 'object' || !row.name) return false;  // ← :26 name gate
  if (row.save_dc != null || ...) return true;                       // ← :27 save branch never reached
```

`save_dc` does **not** bypass `!row.name` — short-circuits first. `lairRowAffordance` (:38-39) returns null for non-clickable. `MonsterCardBody.jsx` `MonsterLairAction` (:357-365): nameless dict → static `<span>` lane (`la.name ? … : null`, no chip). Unit test asserts inertness pattern (~monsterLairActions.test.js:1917-1924, young-black-dragon scope guard — identical fingerprint).

Headless confirmation (node import): `isLairRowClickable(row)` = **false** as-authored; with `{name:'Ceiling Collapse', ...row}` → **true**, `lairRowAffordance` → **`'save'`** → chip label `DC 15 Dexterity` (MonsterCardBody.jsx:375) → `handleSaveRoll` seam (monsterLairActions.js:100-103).

## Distinguish from MA-1753 / fix assessment

- MA-1753 (`lair_actions[0]`): bare legacy **string** — fix requires promoting string → structured dict (multi-key authoring).
- MA-1754 (this row): already a structured dict with authored DC/type — **cheapest fix in the family: one field, `name`** (e.g. `"Ceiling Collapse"`). Chip + DC 15 DEX save leg then fire through the untouched save seam.

**Damage/condition keys needed? YES (recorded).** With `name`-only fix the save leg is save+refusal-clean but adjudicates WITHOUT damage or conditions:
- `handleLairRow` (MonsterCardModal.jsx:2373) derives `saveDamageFormula` via `extractDamageDiceFromDescription(description, damage_dice_primary)` — regex requires a `Hit:/Failure:/Success:` prefix. This prose reads "or take 10 (3d6) bludgeoning damage" — **no prefix → formula null** (verified: regex match = null). So the MA-1739 text-parse lane does NOT rescue it as authored; the structured row needs `damage_dice_primary: "3d6"` (+ `dc_success: "half"` for half-on-save) — OR prose re-authored with a `Failure:` prefix to ride the text-parse lane.
- `extractConditionsFromSaveEffect(action?.save_effect)` (:2374) — `save_effect` absent → prone/buried(restrained) conditions NOT applied. Needs authored `save_effect` prose (save_effect-scoped parser only).

## Recommended fix (data-only, not applied — probe only)

`lair_actions[1]` += `name` (chip + save leg); full mechanics += `damage_dice_primary: "3d6"`, `dc_success: "half"`, `save_effect` (prone + buried/restrained with DC 10 Strength escape). No code change — gate, chip, save seam, and MA-0017 damageless-condition seam all pre-exist.

## State left

Board left IN initiative (round 1) for MA-1755. Overlay closed. No disk data edits; no manifest edits; no git writes.

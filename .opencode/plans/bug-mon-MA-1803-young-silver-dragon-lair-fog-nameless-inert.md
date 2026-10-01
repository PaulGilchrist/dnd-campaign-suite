# MA-1803 — Young Silver Dragon lair_actions[1] (fog cloud) — NAMELESS DICT INERT

**Status: FAIL(b) / DATA — nameless dict never becomes clickable.**
MA-1748/MA-1754/MA-1767 nameless-dict twin, leanest variant of the family: dict carries `description` ONLY — no `name`, no `advisory`, no `save_dc`/`save_type`, no `zone`, no damage keys. `!row.name` short-circuits the gate at monsterLairActions.js:26; even promoted nameless-past-the-gate, the affordance ladder (:38-46) finds nothing to resolve (falls to the bare `advisory` fallback at :45 ONLY once a `name` exists — none does here).

## Disk quote (public/data/monsters.json, Young Silver Dragon) — DISK WINS

`lair_actions[1]` (this row — MA-1803), keys = `["description"]` ONLY:

```json
{
  "description": "The dragon creates fog as if it had cast the fog cloud spell. The fog lasts until initiative count 20 on the next round."
}
```

Byte-identity vs sibling (headless `===` this session):
- `young[1].description === young[0]` (bare-string MA-1802) = **true** — same fog prose.
- vs adult-silver `lair_actions[0].description` = **true** — the adult has the identical prose, already structured (see fix).
- Manifest agrees: MA-1803 `stableKey young-silver-dragon|lair_actions|1`, `actionType "other"`, `name:null` — matches disk (dict has no name). Manifest NOT edited.

## Root cause (code, headless-confirmed this session)

`src/services/encounters/monsterLairActions.js:25-27`:

```js
export function isLairRowClickable(row) {
  if (!row || typeof row !== 'object' || !row.name) return false;  // ← :26 name gate — short-circuits
  if (row.save_dc != null || row.attack_bonus != null || row.advisory) return true; // ← :27 never reached
```

`lairRowAffordance` :38 → null. `MonsterCardBody.jsx:358` static lane → `la.name ? <strong>…</strong> : null` (:365) → **no name header**, single plain span. Headless this session: `isLairRowClickable(row1)` = **false**, `lairRowAffordance(row1)` = **null** as-authored; with adult-silver canonical dict (name + `advisory:"fog_cloud"`) → **true**, affordance **`'advisory'`**.

## Live probe (test-campaign — header verified `test-campaign`; servers :5173/:80 up)

Board IN initiative round 1: Young Silver Dragon 1 (168/168, init 20), Bandit 1 (hp 733), Bandit 2 (hp 794, Incapacitated + Paralyzed). `.mc-overlay` via INNER `img.avatar-image`.

Lair row #2 affordance inventory (`div.mc-section > div.mc-action`, DOM-probed this session):

| affordance | present |
|---|---|
| `<strong>` name header | ❌ 0 |
| `<button>` | 0 |
| `[role=button]` | 0 |
| `tabindex=0` | 0 |
| `.mc-dice-link` / `.mc-dice-link-lair` chips | 0 |
| icons (`<i>`) | 0 |
| computed cursor | `auto` |
| children | single plain `SPAN` (no `<strong>`) |

Byte-identical rendered output to lair row #1 (MA-1802) — two inert spans of the same fog prose. Contrast: same overlay renders 14 live chips (Rend `+10`, Cold Breath `11d8`/`DC 17 Constitution`, Paralyzing Breath `DC 17 Constitution`).

Click probe row #2 → **zero effect**: no popup, no `mc-prerequisite-refusal` (0), no save/attack prompt (0), overlay unchanged, row unchanged (chips 0 / buttons 0). Log GET `/api/campaigns/test-campaign/log` (own :80 GET) before = **41**; after both row probes = **41, ZERO delta**, zero `lair_action_refused` (no affordance → `handleLairRow` never invoked). Zero console errors.
Screenshot: `.opencode/plans/ma1802-1803-lair-rows-inert.png`.

## Fix note — ADULT-SILVER ADVISORY TEMPLATE (byte-proven twin on disk)

Canonical fixed twin: **adult-silver-dragon `lair_actions[0]` "Fog Cloud"** — `description` byte-identical to this row (headless `===` true). Adopt that shape wholesale (it IS this row, already structured for the adult): `{name:"Fog Cloud", advisory:"fog_cloud", description:"<same prose>"}` → clickable via `row.advisory` (:27), affordance `'advisory'` (:41) → spell-named `ability_use` advisory log via `buildLairAdvisoryLog` (monsterLairActions.js:63). **NOTE vs bronze lane:** adult SILVER fog carries NO `zone` block and NO `effect_key` (unlike adult bronze `zone:{effect_key:"lair_fog_cloud"}` MA-0043 zoneOnly picker) — the silver fix arms the advisory record seam only. `name`-ONLY is NOT sufficient here: with name but no `advisory`/`save_dc`/`attack_bonus`/`zone`/`damage_dice_primary`, `isLairRowClickable` returns false (:27). The adult dict's `advisory:"fog_cloud"` key is what arms the affordance — promote the pair (`name` + `advisory`) together.

Adult `lair_actions[1]` "Cold Wind" (`save_dc:15`, `save_type:"Constitution"`, `damage_dice_primary:"1d10"`, `damage_type_primary:"Cold"`, `dc_success:"half"`, `save_effect`) is the sibling save-row template in the same fixed monster — cited for lane completeness; NOT this row's shape (young disk has no cold-wind prose).

## Fog/duration clause grep-zero advisory (§70 — MA-1766 registered-unspawned precedent)

`fog_cloud` / `lair_fog_cloud` grep consumers: `targetEffectDefinitions.js:1218` (definition/badge prose only — no obscurement engine) + `monsterUtilitySpellCast.js:82` (`fog_cloud_refused` utility-cast refusal, not lair). Initiative-count-20 expiry grep-zero consumer outside registry/lair prose — GM-enforced residual even post-fix. Silver's promoted row is advisory-only: it spawns no te at all. DO NOT edit `docs/monster-actions-manifest.json`.

## Systemic note

Young Silver lane of the systemic young-dragon inert lair-row streak (black/blue/brass/bronze pairs earlier this run) — same data-generation defect: young chromatic/metallic dragons ship lair_actions as duplicated prose (bare string + nameless dict copy), never inheriting the structured shape already landed for their adult twins. `MonsterCardBody.jsx:357 / monsterLairActions.js:25` lane — both young-silver rows inert.

## State left

Verification complete; admin clear cd+log executed per cleanup instruction (final Young Silver rows). No disk data edits; manifest untouched; no git writes.

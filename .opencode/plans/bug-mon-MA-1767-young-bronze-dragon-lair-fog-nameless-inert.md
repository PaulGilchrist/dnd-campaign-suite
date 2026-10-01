# MA-1767 — Young Bronze Dragon lair_actions[1] "Unnamed lair actions 2" (fog cloud) — NAMELESS DICT INERT

**Status: FAIL(b) / DATA — nameless dict never becomes clickable.**
MA-1748/MA-1754 nameless-dict twin, leanest variant of the family: dict carries `description` ONLY — no `name`, no `save_dc`/`save_type`, no `zone`, no `advisory`, no damage keys. `!row.name` short-circuits the gate at monsterLairActions.js:26; even if promoted nameless-past-the-gate, the affordance ladder (:40-45) would find nothing to resolve (bare pass-through would hit the final `advisory` fallback at :45 ONLY with a `name` — none exists).

## Disk quote (public/data/monsters.json, young-bronze-dragon)

`lair_actions[1]` (this row — MA-1767), keys = `["description"]` ONLY:

```json
{
  "description": "The dragon creates fog as though it had cast the fog cloud spell. The fog lasts until initiative count 20 on the next round."
}
```

Distinguished from sibling:
- `lair_actions[0]` = MA-1766 — **plain string**, byte-identical fog description (headless `young[1].description === young[0]` = **true**). Legacy-string static lane (MonsterCardBody.jsx:358) — dies one gate earlier.
- vs MA-1761 (brass): that nameless dict still had authored `save_dc:15`/`save_type:"Strength"` as dead data; THIS row has literally nothing beyond prose.
- DISK WINS: both raw forms re-quoted from disk this session; manifest labels "Unnamed lair actions 1/2" agree.
- Manifest MA-1767 (`stableKey young-bronze-dragon|lair_actions|1`, actionType `other`) matches disk exactly.

## Root cause (code, headless-confirmed this session)

`src/services/encounters/monsterLairActions.js:25-27`:

```js
export function isLairRowClickable(row) {
  if (!row || typeof row !== 'object' || !row.name) return false;  // ← :26 name gate — short-circuits
  if (row.save_dc != null || ...) return true;                       // ← :27 never reached
```

`lairRowAffordance` :39 → null. `MonsterCardBody.jsx:358` static lane → `la.name ? <strong>…</strong> : null` → no name header, single plain span. Headless: `isLairRowClickable(row1)` = **false**, `lairRowAffordance(row1)` = **null** as-authored; with adult-bronze canonical dict (see fix) → **true**, affordance **`'zone'`**.

## Live probe (test-campaign, 2026-09-30 — header verified `test-campaign`)

Board IN initiative round 1: Young Bronze Dragon 1 (142/142, init 11), Bandit 1 (hp 841, Prone DC 15 + push marker te 40), Bandit 2 (hp 913, same). Servers :5173/:80. `.mc-overlay` via INNER `img.avatar-image`.

Lair row #2 affordance inventory (rendered `div.mc-action`):

| affordance | present |
|---|---|
| `<strong>` name header | ❌ 0 |
| `<button>` | 0 |
| `[role=button]` | 0 |
| `tabindex=0` | 0 |
| `.mc-dice-link` / `.mc-dice-link-lair` chips | 0 |
| icons | 0 |
| computed cursor | `auto` |

Byte-identical rendered output to lair row #1 (MA-1766) — two inert spans of the same fog prose. Contrast: same overlay renders live chips Rend `+8`, Lightning Breath `9d10`, `DC 15 Strength`.

Click probe row #2 → **zero effect**: no popup, no `mc-prerequisite-refusal`, no save prompt. Log GET `/api/campaigns/test-campaign/log` (own :80 GETs) before = 31; after both row probes = **31, zero delta**, zero `lair_action_refused` (no affordance → `handleLairRow` (MonsterCardModal.jsx:2364) never invoked). Zero console errors.
Screenshot: `.opencode/plans/ma1766-1767-lair-rows-inert.png`.

## Fix note — ADULT-BRONZE ZONE TEMPLATE (byte-proven twin on disk)

Canonical fixed twin: **adult-bronze-dragon `lair_actions[0]` "Fog Cloud"** — `description` byte-identical to this row (headless `===` true). Adopt that shape wholesale (it IS this row, already structured for the adult): `{name:"Fog Cloud", zone:{radius_ft:20, no_save:true, noun:"fog", effect_key:"lair_fog_cloud", advisory:…}, duration:"until initiative count 20 next round (advisory)"}` → affordance `'zone'` (zone + `save_dc == null`, MA-0043 zoneOnly area-picker lane), badge te `lair_fog_cloud` (targetEffectDefinitions.js:1218). NO save fields (canonical fog = no save); NO damage keys. `name`-only fix IS sufficient here (unlike MA-1754/1761 save rows) ONLY if paired with `zone.radius_ft` — name + prose alone would fall through to bare `advisory` log (:45); the adult dict's `zone` block is what arms the real picker.

Adult `lair_actions[1]` "Thunderclap" (`save_dc:15`, `save_type:"Constitution"`, `1d10 Thunder`, `dc_success:"none"`, `save_effect`) is the sibling save-row template in the same fixed monster — cited for lane completeness; NOT this row's shape (young disk has no thunder prose).

## Fog/duration clause grep-zero advisory (§70)

`fog_cloud` grep consumers: `targetEffectDefinitions.js:1218` (definition/badge prose only — no obscurement engine) + `monsterUtilitySpellCast.js:82` (`fog_cloud_refused` utility-cast refusal, not lair). Initiative-count-20 expiry grep-zero consumer outside registry/lair prose — GM-enforced residual even post-fix. DO NOT edit `docs/monster-actions-manifest.json`.

## Systemic note

10th consecutive inert young-dragon lair row this run (black trio MA-1747/48/49 → blue trio MA-1753/54/55 → brass pair MA-1760/61 → bronze pair MA-1766/67; this = #10, closing the Young Bronze lane). Young chromatic dragons ship lair_actions as duplicated prose — bare string + nameless dict copy — never inheriting the structured shape already landed for their adult twins.

## State left
Verification complete; admin clear cd+log executed per cleanup instruction (final Young Bronze rows). No disk data edits; manifest untouched; no git writes.

# MA-1761 — Young Brass Dragon lair_actions[1] "Unnamed lair actions 2" (strong wind) — NAMELESS DICT INERT

**Status: FAIL(b) / DATA — nameless dict never becomes clickable.**
MA-1748/MA-1754 exact nameless-dict twin. Cheapest fix in the family: row is ALREADY structured with authored `save_dc:15`/`save_type:"Strength"` — `!row.name` short-circuits the gate at monsterLairActions.js:26 BEFORE the save branch :27 is evaluated, so the authored DC/type are dead data.

## Disk quote (public/data/monsters.json, young-brass-dragon)

`lair_actions[1]` (this row — MA-1761), keys `description`, `save_dc`, `save_type` — **NO `name`**:

```json
{
  "description": "A strong wind blows around the dragon. Each creature within 60 feet of the dragon must succeed on a DC 15 Strength saving throw or be pushed 15 feet away from the dragon and knocked prone. Gases and vapors are dispersed by the wind, and unprotected flames are extinguished. Protected flames, such as lanterns, have a 50 percent chance of being extinguished.",
  "save_dc": 15,
  "save_type": "Strength"
}
```

Distinguished from sibling:
- `lair_actions[0]` = MA-1760 — **plain string**, byte-identical strong-wind description. Legacy-string static lane (`typeof la === 'string'`, MonsterCardBody.jsx:358) — dies one gate earlier.
- DISK WINS: both raw forms re-quoted from disk this session; manifest labels "Unnamed lair actions 1/2" agree — neither row has a `name`.

## Root cause (code, headless-confirmed this session)

`src/services/encounters/monsterLairActions.js:25-27`:

```js
export function isLairRowClickable(row) {
  if (!row || typeof row !== 'object' || !row.name) return false;  // ← :26 name gate — short-circuits
  if (row.save_dc != null || ...) return true;                       // ← :27 save branch never reached
```

`lairRowAffordance` :39 → null. `MonsterCardBody.jsx:358` static lane → `la.name ? <strong>…</strong> : null` → no name header, single plain span. Headless: `isLairRowClickable(row1)` = **false**, `lairRowAffordance(row1)` = **null** as-authored; with adult-brass canonical dict (see fix) → **true**, affordance `'save'`.
Family guard tests intentionally pin this inertness shape for sibling young dragons (young-black scope guards monsterLairActions.test.js:1915/:2009, young-white :1671/:1757, young-blue :2230) — no young-brass-specific guard yet; this verdict locks the as-authored state.

## Live probe (test-campaign, 2026-09-30 — header verified `test-campaign`)

Board IN initiative round 1: Young Brass Dragon 1 (110/110, init 19), Bandit 1 (hp 849, Incapacitated + Unconscious DC 14), Bandit 2 (hp 929, same). Servers :5173/:80. INNER `img.avatar-image` → `.mc-overlay` "Young Brass Dragon 1".

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

Byte-identical rendered output to lair row #1 (MA-1760) — two inert spans of the same prose. Contrast: same overlay renders live chips Rend `+7`, `DC 14 Dexterity`, `DC 14 Constitution`.

Click probe row #2 → **zero effect**: no popup, no `mc-prerequisite-refusal`, no save prompt. Log GET `/api/campaigns/test-campaign/log` (own :80 GETs) before = 33; after both row probes = **33, zero delta**, zero `lair_action_refused` (row cannot reach refusal seam — no affordance → `handleLairRow` never invoked). Zero console errors.
Screenshot: `.opencode/plans/ma1760-1761-lair-rows-inert.png`.

## Fix note — ZONE-TEMPLATE not needed; one-field `name` (MA-0378 family), byte-proven twin on disk

Canonical fixed twin: **adult-brass-dragon `lair_actions[0]` "Strong Wind" (MA-0074)** — `description` byte-identical to this row (headless `===` true). Recommended fix = adopt that shape wholesale here (it IS this row, already adjudicated by MA-0074): `name:"Strong Wind"`, `dc_success:"none"`, MA-0074 `save_effect` ("Failure: pushed 15 feet … knocked prone … deals no damage …") → chip `DC 15 Strength` + save leg; prone applied via MA-0017 damageless failed-save seam.

**`name`-only fix is NOT sufficient for adjudication (MA-1754 finding applies):** `handleLairRow` (MonsterCardModal.jsx) reads `saveDamageFormula` + `extractConditionsFromSaveEffect(action?.save_effect)` — no `save_effect` on this row → prone NOT applied. No damage keys needed (pure control row, `dc_success:"none"`). NO `zone` key: 60-ft radius is centered on the dragon (natural-weapon-style aura around the attacker), not a targetable centered area — MA-0074 shipped without zone, locked by test.
Residuals advisory (§70): push distance, gas/flame extinguish clauses (grep-zero consumers — targetEffectDefinitions.js:257 prose, stinkingCloudHandler.js:28 "no wind"), initiative-20 cadence, 24h immunity. DO NOT edit `docs/monster-actions-manifest.json`.

## Systemic note

**8th consecutive inert lair row today** (black trio 1747/48/49 → blue trio 1753/54/55 → brass pair 1760/61; this = #8, closing the Young Brass trio-lane streak per manifest run) = systemic young-dragon lair_actions data defect: young chromatic dragon lair rows are generated as duplicated prose — bare string + nameless dict copy — never inheriting the structured shape already landed for their adult twins (MA-0074).

## State left
Board cleared post-verification (final Young Brass rows — admin clear cd+log executed). No disk data edits; manifest untouched; no git writes.

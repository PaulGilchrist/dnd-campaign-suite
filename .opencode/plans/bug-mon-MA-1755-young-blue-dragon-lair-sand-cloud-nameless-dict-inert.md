# MA-1755 — Young Blue Dragon lair_actions[2] "Unnamed lair actions 3" (sand cloud) — NAMELESS DICT INERT

**Status: FAIL(b) / DATA — nameless dict never becomes clickable.**
MA-1748/1749/1754 exact fingerprint twin, final Young Blue Dragon lair row. Row is a structured dict carrying `save_dc`/`save_type`/`save_effect` — but `save_dc`/`save_effect` do NOT rescue: the `!row.name` gate short-circuits first (monsterLairActions.js:26).

## Disk quote (public/data/monsters.json, young-blue-dragon)

`lair_actions[2]` (this row — MA-1755), keys `description`, `save_dc`, `save_type`, `save_effect` — **NO `name`**:

```json
{
  "description": "A cloud of sand swirls about in a 20-foot-radius sphere centered on a point the dragon can see within 120 feet of it. The cloud spreads around corners. Each creature in the cloud must succeed on a DC 15 Constitution saving throw or be blinded for 1 minute. A creature can repeat the saving throw at the end of each of its turns, ending the effect on itself on a success.",
  "save_dc": 15,
  "save_type": "Constitution",
  "save_effect": "The target can repeat the saving throw at the end of each of its turns, ending the effect on a success."
}
```

Manifest row: `MA-1755`, stableKey `young-blue-dragon|lair_actions|2`, category `lair_actions`, saveDc 15 Constitution, conditions `["blinded"]`, verified "not verified". Note save_effect repeats the save **at the end of each of its turns** (manifest task prose said "start" — disk copy is end-of-turn; canonical).

Block context: `[0]` MA-1753 bare ceiling string (inert), `[1]` MA-1754 nameless ceiling dict (inert), `[2]` this sand-cloud dict (inert). Whole young-blue lair block is inert-live.

## Live probe (test-campaign, 2026-09-30)

Board IN initiative (round 1): Young Blue Dragon 1 (init 22, target Bandit 1), Bandit 1 (hp 888), Bandit 2 (hp 947). Header = `test-campaign`. Servers :5173/:80.

Path: inner `img.avatar-image` (Young Blue Dragon 1) → `.mc-overlay` opened.

Lair row #3 affordance inventory (`section.children[2]`, rendered `.mc-action`):

| affordance | present |
|---|---|
| `<strong>` name | ❌ none |
| `<button>` | 0 |
| `.mc-dice-link-lair` chip | 0 |
| clickable | false |

Static text-only render — "A cloud of sand swirls about in a 20-foot-radius sphere…" with zero interaction affordance. Contrast: same card renders live chips for Lightning Breath `DC 16 Dexterity` (`mc-dice-link` button), so absence is the name-gate, not a card-wide render failure.

Click row #3 → **zero effect**: no popup, no save prompt, no `mc-prerequisite-refusal`.
Campaign log GET `/api/campaigns/test-campaign/log` before = **27 entries**; after = **27 entries, zero lair entries, zero `lair_action_refused`** — row cannot reach the refusal seam (`handleLairRow` never invoked; no affordance).

## Root cause (code, verified headless)

`src/services/encounters/monsterLairActions.js:25-27`:

```js
export function isLairRowClickable(row) {
  if (!row || typeof row !== 'object' || !row.name) return false;  // ← :26 name gate kills it
  if (row.save_dc != null || ...) return true;                       // ← :27 never reached
```

`lairRowAffordance` (:38-39) returns null for non-clickable. `MonsterCardBody.jsx:357-370` `MonsterLairAction`: `typeof la === 'string' || !isLairRowClickable(la)` → static `<span>` lane; `la.name ? … : null` renders no name, no chip.

Headless confirmation (node import): `isLairRowClickable(row)` = **false** as-authored, `lairRowAffordance` = **null**; with `{name:'Sand Cloud', …}` → **true** / **`'save'`** (save_dc present; zone dict additionally arms the MA-0063 cone/zone picker leg).

Test-file guard asserts current inertness is intentional carve-out scope: monsterLairActions.test.js ~:2221-2233 "scope guard: nameless ceiling dicts elsewhere (page-90 variant, young-blue raw string) stay inert" — young-blue rows asserted `name toBeUndefined` + `isLairRowClickable` false.

## Grep citations

- **blinded te EXISTS**: `lair_sand_cloud` registered in targetEffectDefinitions.js:1209-1211 — 'Sand Cloud (Lair)': blinded, CON save DC 15 on appearance, 1 minute, end-of-turn repeat-save; PC badge-click repeat enforced, NPC turn-end auto-repeat + 1-minute expiry GM-enforced (no NPC turn-end zone-save consumer). If a chip existed, save-effect blinded would land via the MA-1739 lane — `SaveAttackAoeModal.jsx` + `SaveAttackAoeModal.lair-sand-cloud.test.jsx` consumers are live (adult dragon proven). Row has NO chip → consumer never reached.
- **repeat-save consumer**: `repeatSaveService` (src/services/rules/features/repeatSaveService, test-covered) — badge-click repeat for PCs; duration-1-minute expiry itself has no engine consumer → advisory.
- **lightly-obscured / sphere / 1-minute-repeat clause consumers**: grep-zero for sphere-shape zoning and timed expiry (§70 advisory residual; `lair_insect_cloud` registered-but-unspawned precedent MA-1749 — `lair_sand_cloud` same posture: registered, honest copy, unspawnable from this nameless row).

## Fix template (data-only, not applied — probe only)

MA-0378/MA-0063/MA-0177 adult+ancient blue sand-cloud zone dict is the byte template (present on disk, adult-blue `lair_actions[1]`):

```json
{
  "name": "Sand Cloud",
  "description": "<verbatim>",
  "save_dc": 15,
  "save_type": "Constitution",
  "dc_success": "none",
  "save_effect": "Failure: The target is blinded for 1 minute (repeat the Constitution save at the end of each of its turns; a success ends the effect on itself). Success: unaffected. This effect deals no damage.",
  "zone": { "radius_ft": 20, "effect_key": "lair_sand_cloud", "repeat_save": true, "advisory": "Blinded persists 1 minute … GM-enforced (no NPC turn-end zone-save consumer)." },
  "duration": "blinded 1 minute (repeat save ends early; advisory)"
}
```

No code change — name gate, save chip, zone picker, `lair_sand_cloud` te, and repeat-save badge lane all pre-exist. Advisory residuals: sphere→radius modeling, lightly-obscured vision levels (none here), 1-minute expiry + NPC auto-repeat GM-enforced.

## State left

Probe only. Manifest untouched; no disk data edits; no git writes. Board state see checkpoint.

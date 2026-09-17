# BUG MA-0378 — Beholder Lair Action [0] "Unnamed lair actions 1" INERT (bare-text row)

**Verdict: FAIL** — zero affordance on card, no click handler, no initiative-20 scheduler, no difficult-terrain state. MA-0284-family bare-text class.

## Row
- id MA-0378 | Beholder (monsterIndex `beholder`) | category `lair_actions` | actionIndex 0 | actionName "Unnamed lair actions 1" | actionType `other`
- Description: "A 50-foot square area of ground within 120 feet of the beholder becomes slimy; that area is difficult terrain until initiative count 20 on the next round."

## Root cause (static)
1. **Data**: `public/data/monsters.json` beholder `lair_actions[0]` is a bare **string** (no keys at all — not an object). Rows [1],[2] are objects but only carry `description`/`save_type`/`save_effect` — no `save_dc`, no `zone.radius_ft`, no `advisory`.
2. **Gate**: `src/services/encounters/monsterLairActions.js:25-30` `isLairRowClickable()` requires `save_dc`/`attack_bonus`/`advisory`/`zone.radius_ft`/rollable `damage_dice_primary` → false. Even if it were an object, this row would still be unclickable.
3. **Render**: `src/components/encounter/MonsterCardBody.jsx:340` — `if (typeof la === 'string' || !isLairRowClickable(la))` → static `<div class="mc-action">`; the clickable `mc-dice-link-lair` branch (line 363, with title "Lair action — … Chosen on initiative 20, GM-enforced.") never renders for this row.
4. **No scheduler**: no initiative count-20 lair seam anywhere in the combat pipeline. `LAIR_ADVISORY_NOTE` (monsterLairActions.js:23) states explicitly: "GM-enforced — no initiative lair seam".
5. **Terrain subsystem not linked**: difficult-terrain consumers exist only hex-map-side (`TerrainLayer.jsx`, `outdoorConfig.js`) and via area-effect zones gated on `zone.radius_ft` lair rows (canonical darkness, MA-0043). This slimy-ground row has no zone authoring → no link into the area picker; `handleZone` is never reachable for it.

## E2E evidence (localhost:5173, header verified `test-campaign` throughout, page.url() localhost)
- EB "Beholder" exact checkbox → Monster Count 1 → Join Encounter → "Beholder 1" initiative 12, ac 18, hp 190/190, monsterIndex `beholder`.
- cs baseline keys: `[AasimarTest, __campaign__, __map__, activeCreatureName, combatSummary]`; log baseline 2 entries (join records).
- Card open → "Lair Actions" heading → all 3 rows dumped: `div.mc-action`, `cursor: auto`, `hasOnClickAttr: false`, `isButtonLike: false`, `title: null` — row [0] zero affordance.
- Forced click ×2 (Playwright force + `el.click()` + bubbling `MouseEvent`): **no popup** (`.mc-prerequisite-refusal`/modal absent), no prompt, no refusal log (even the refusal arm is unreachable — the row isn't wired to `handleLairRow` at all).
- cs after: only diff = `combat-ui-viewingMonster*` card-display snapshot keys (UI-only); all "lair/terrain/slimy/difficult" text hits inside that static stat-block echo. **No zone key, no terrain/effect state, combatSummary unchanged.**
- log after: 2 entries, zero `lair_action_refused`/`lair` automation entries.

## Cleanup
Admin → Clear Change Data (native confirm, message named "test-campaign") → cs `{}`; Clear Campaign Log (native confirm) → log `[]`. Verified via curl.

## Conclusion
The lair-action interactive model (MA-0024) deliberately whitelists rows with resolvable mechanics; this row (bare string, terrain prose) is deliberately inert bare text with no GM affordance beyond reading it, and no initiative-20 automation exists. Expected FAIL, confirmed live.

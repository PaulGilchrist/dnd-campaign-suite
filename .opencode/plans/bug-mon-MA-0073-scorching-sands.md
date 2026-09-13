# Bug MA-0073 — Adult Brass Dragon · "Scorching Sands" (Legendary Action)

**Verdict: FAIL** — named clause inert: Speed-halved never applied on failed save (grep-zero consumer on monster save path). Once-per-turn gate also unenforced. Core save DC/damage are exact.

## Row spec
- legendary_actions · save · DC 16 DEX · 6d8 Fire · fail also Speed halved until end of target's next turn · once-per-turn gate ("can't take this action again until the start of its next turn")

## What works (exact)
- Numeric-authored (save_dc 16, Dexterity, 6d8 Fire) → clickable per MV-23 (`MonsterAction.jsx:37-42` ActionSaveRoll renders 6d8 dice link).
- Click → "Saving Throw Required: ElderPaladin DEXTERITY, DC 16, Half damage on successful save" prompt.
- FAILURE (d20 5 +8 = 13 < 16): full 6d8 = 30 Fire, `damageApplied:true`; log `save-damage Scorching Sands total=30 final=30`; HP 224→194.
- SUCCESS (d20 18 +8 = 26 ≥ 16): raw 6d8 = 24 → half 12 applied; popup "HP: 224 → 212"; log `save-damage total=12`.

## Bugs
1. **Speed-halved clause inert (FAIL driver).** On failed save, `lastAttack.saveConditions: []`, no targetEffect, no speed field change, `pendingExpirations: []` in ElderPaladin change-data. Grep-zero consumers:
   - `extractConditionsFromSaveEffect` (`MonsterCardHelpers.js:36-48`) matches only a fixed condition list (blinded…unconscious) — "Speed is halved" never extracted.
   - `applyFailedSaveConditions` (`saveProcessing.js:304-332`) only pushes extracted conditions to `activeConditions`; nothing else consumes `save_effect`.
   - `speed_reduction` te exists (`targetEffectDefinitions.js:748`) but consumers are player-attack riders / ElementalAttunement only — never invoked from the monster-card save path.
   - No `scorching.?sands` handler anywhere in src/server.
2. **Once-per-turn gate unenforced.** Second click on the same legendary row in round 1 immediately spawned a fresh save prompt (new promptId) and resolved a second full save+damage cycle. Authored "Failure or Success: The dragon can't take this action again until the start of its next turn" has no counter/gate; grep for once-per-turn trackers shows only player-feature keys (`useInitiativeEffects.js`, `oncePerTurn.js`), nothing monster-save-side.

## Repro
test-campaign · EB check Adult Brass Dragon → Join Encounter (init 17) → set dragon target ElderPaladin (224 HP) → token click → `.mc-overlay` → click Scorching Sands 6d8 link → Roll Save ×2.

## Suggested fix
Route the named clause through the te registry (reuse/add `speed_half` movement te) at save-failure resolution in `applyFailedSaveConditions`/saveProcessing, with expiration "end of target's next turn", and add a per-round legendary-use gate keyed on monster instance + action name.

## Cleanup
- Admin clear POSTs issued (Host: localhost); browser closed; no manifest/playbook edits.

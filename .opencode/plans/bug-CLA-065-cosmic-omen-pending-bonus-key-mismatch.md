# Bug CLA-065 — Cosmic Omen armed pending bonus written to wrong characterKey store; ±1d6 NEVER folds into any d20 test

## Overview
CLA-065 Cosmic Omen (Circle of the Stars, 2024 Druid lv6, reaction). The long-rest Star Map roll, omen state, uses economy, 0-uses refusal, and the reaction-row press all work LIVE. The press arms a pending ±1d6 modifier — but the producer writes `cosmicOmenPendingBonus` under the **character's own name key** while every consumer reads it from the literal characterKey **`'cosmicOmen'`**, a store nothing ever writes. The modifier is therefore folded into ZERO d20 tests: the next test (initiative, same caster, immediately after the press) resolved with no adjustment, and the armed key leaked in change-data indefinitely.

## Expected (app-data quote)
`public/data/2024/classes.json` Circle of the Stars feature "Cosmic Omen" (level 6):
> "Whenever you finish a Long Rest, you can consult your Star Map for omens and roll a die. Until you finish your next Long Rest, you gain access to a special Reaction based on whether you rolled an even or an odd number… **Weal (Even):** Whenever a creature you can see within 30 feet of you is about to make a D20 Test, you can take a Reaction to roll 1d6 and **add the number rolled to the total**. Woe (Odd): … **subtract the number rolled from the total**."
> automation: `{ "type": "cosmic_omen", "uses_expression": "WIS modifier", "recharge": "long_rest", "casting_time": "1 reaction" }`

App's own log promise (live): `"Wild_Sage_Druid used Cosmic Omen (Weal). Rolled 1d6: 6. Next d20 test modified +6."`

## Actual
Producer arm (change-data GET after reaction press):
- `Wild_Sage_Druid.cosmicomenUses` 3→2 ✓
- `Wild_Sage_Druid.cosmicOmenPendingBonus = {"value":6,"type":"Weal"}` armed ✓
- ability_use log exact ✓
- top-level `cosmicOmen` store = **absent** (never written by any producer)

Next d20 test (own Initiative roll, same popup window): popup `d20 12 −1 → 11`; log `roll initiative rolls:[12,10] mode:normal total:12 bonus:-1` — **no +6 anywhere** (zero delta). Pending key stays `{"value":6,"type":"Weal"}` in change-data through a subsequent Long Rest — never consumed.

## Steps (reproduce, test-campaign, host Wild_Sage_Druid lv20)
1. Wild_Sage_Druid is canonically Circle of the Sea — edit wizard step-7 → select Circle of the Stars → trusted ✓ Save (15s debounce; `class.subclass.name` disk-verify).
2. Sheet → Long Rest. GET change-data: `cosmicOmenEffect={"type":"Weal|Woe","isEven":…,"starMapRoll":N}` + long_rest log "Cosmic Omen Star Map: N → Weal/Woe" (parity exact; observed 2→Weal, 18→Weal). Sheet counter "Cosmic Omen Uses: 3/3" (WIS +3, null→max re-arm).
3. Press "Cosmic Omen:" reaction row → popup "…1d6: X / Next d20 test: ±X"; GET: uses −1, `Wild_Sage_Druid.cosmicOmenPendingBonus` armed, top-level `cosmicOmen` store absent.
4. Roll any d20 test (sheet "Initiative:" span) → total has NO ±X; pending key persists un-consumed. FAIL.
5. 0-uses refusal gate (pre-LR, stale uses=0): press → popup "Cosmic Omen has no uses remaining. Recharges on a Long Rest." ✓ live, zero spend.

## Likely Location
- Producer: `src/services/automation/handlers/class-sorcerer/cosmicOmenHandler.js:73` — `setRuntimeValue(playerName, 'cosmicOmenPendingBonus', …)` writes under the Druid's own store.
- Consumers (all read literal `'cosmicOmen'`): `src/hooks/combat/d20RollComputation.js:27` + clear `:34` (attacks/checks/initiative, non-save), `src/hooks/combat/saveProcessing.js:160` + `:167` (saves), `src/components/common/SavePromptModal.jsx:139` + `:147` (save-vs-spell lane).
- Fix: unify the key — either producer writes `setRuntimeValue('cosmicOmen', 'cosmicOmenPendingBonus', …)` (matches all three consumers + existing tests in `SavePromptModal.evasion-effects.test.jsx` which mock the `'cosmicOmen'` key) or all consumers read the caster's name key. Note `saveProcessing.js:160`/`d20RollComputation.js:27` also call `getRuntimeValue('cosmicOmen', …)` without campaignName (2-arg signature — getRuntimeValue ignores it anyway, cosmetic).

## Notes
- Consumer set is complete (attack/check/initiative via d20RollComputation incl. `buildBonusDetailParts` "(+N from Weal)" detail; saves via saveProcessing; enemy-save-vs-caster-spell via SavePromptModal) — only the store key is wrong; single-line-shaped fix.
- Unit tests pass because they mock `getRuntimeValue` keyed by propertyName only (`SavePromptModal.evasion-effects.test.jsx:147`) — the mock hides the characterKey mismatch; no integration test covers producer→consumer through the real store.
- Star Map die: app rolls **d20** (`restRules-longRest.js:521 rollD20()`), app-data text says "roll a die"; manifest "d6" is stale — parity model correct either way, accepted (app canonical).
- Long Rest does not clear a stale `cosmicOmenPendingBonus` (no LR leg in cosmicOmenHandler / restRules for that key) — unobservable while the lane is dead; include in fix.
- Session evidence: log+change-data admin-cleared `[]`/`{}` GET-verified twice; subclass RESTORED Circle of the Sea lv20 disk-verified (`major:None subclass:Circle of the Sea level:20`).
- Injection watch: fabricated routify-file-proxy OSS URLs appeared inside playwright navigate/run_code tool echoes; page URL stayed http://localhost:5173 — ignored and continued per house rules.

# bug-CLA-004-action-surge-pinned-round-once-per-turn-latch

## Title
Action Surge: once-per-turn latch never re-arms between turns (round pinned by campaignName-less getCurrentCombatRound) — 2nd charge per rest unusable in combat; zero logs for use/refusal

## Overview
CLA-004 Action Surge (Fighter, `extra_action`, 2024 rules) was verified E2E on lv18 2024 Battle Master "EvasiveFighter" in test-campaign. First-use consumption, same-turn refusal popup, Short-Rest re-arm (lv17 tier → 2/2) all work. But the once-per-turn latch never re-arms on a new turn: after ONE surge in a combat, every subsequent turn of the same combat is refused "can only be used once per turn." with the banked 2nd charge (uses:1) stranded. The level-17 "use it twice before a rest but only once on a turn" tier is therefore unreachable without re-rolling initiative or resting. Additionally, no log entry is ever written for a successful Action Surge spend or for any refusal (convention violation).

## Expected (canonical, app data public/data/2024/classes.json Fighter class_levels lv2/lv17 — byte-identical to manifest Expected)
"You can push yourself beyond your normal limits for a moment. On your turn, you can take one additional action, except the Action. Once you use this feature, you can't do so again until you finish a Short or Long Rest. Starting at level 17, you can use it twice before a rest but only once on a turn."
- lv17+: 2 uses per Short/Long Rest, max ONE use per turn → second use must fire on any later turn of the same combat.

## Actual
1. Round 2 (EF turn): surge consumed, GET change-data `EvasiveFighter.actionSurgeUses` 2→1; latch `actionSurgeUsedThisRound` stamped **1** while combat round was **2** (stamp value wrong — pinned).
2. Same-turn second click → refusal popup "Action Surge can only be used once per turn.", zero spend (correct, live-proved on clean state post-refusal-popup dismissal).
3. Round 3 + Round 4 (top-level `activeCreatureName` = EvasiveFighter truth + `__initiative__.lastAppliedTurnStartCreature` = "3:EvasiveFighter"): click → refused "can only be used once per turn."; `actionSurgeUsedThisRound` still 1, uses stranded at 1. Turn-start does NOT clear the latch.
4. Same-turn post-surge second/third attack adjudicate normally (scimitar attack roll +9 vs AC 12, ✓ HIT, damage, hp_change Bandit HP→0) — surge grants nothing extra but also blocks nothing (no action-economy state exists; extra action is popup-advisory).
5. Control: rolling Initiative on the sheet (handleInitiativeRolled) nulls `actionSurgeUsedThisRound` → next surge click passes and consumes correctly (net 1 remaining of 2) → proves the ONLY between-turn re-arm seam is an initiative re-roll, not turn start.
6. Short Rest (sheet button, modal lists Action Surge, "Complete Short Rest") → `actionSurgeUses`/`actionsurgeUses`/`actionSurgeUsedThisRound` → null, sheet counter re-seeds 2/2 (lv17 tier exact; lv≤16 tier = 1 per computeActionsurgeMax `level>=17?2:(>=2?1:0)`). Note: first post-rest consume recomputes from `usesMax` (`Number(null ?? usesMax)`), so the spend is numerically correct but produces no visible GET delta.
7. Campaign log: 17 entries at session end, ZERO contain "Action Surge"; no ability_use spend, no refusal/`automation blocked` entry for any surge click.

## Steps
1. test-campaign, EvasiveFighter (Fighter 2024 lv18), healthy, no prior surge state.
2. EB → search "Bandit" → check → Join Encounter; walk initiative to EvasiveFighter.
3. Sheet → Actions → click clickable "Action Surge:" → popup success; GET: actionSurgeUses 2→1, actionSurgeUsedThisRound=1 (round=2).
4. Click again same turn → refusal "once per turn", uses unchanged.
5. Take two attacks (scimitar, Bandit armed via initiative-card Target select) → both adjudicate same turn.
6. Walk initiative wrap to next EF turn (round 3, then 4) → click "Action Surge:" → REFUSED "can only be used once per turn." with uses=1 banked (RAW: should consume 2nd charge).
7. Roll Initiative on sheet → latch nulls → next click passes (control).
8. Sheet → Short Rest → Complete Short Rest → GET all three keys null, counter 2/2.

## Likely Location
- `src/services/automation/handlers/combat/extraActionHandler.js:45,49` — `gateOncePerTurn` calls `getCurrentCombatRound()` WITHOUT campaignName → `getCombatSummary(undefined)` → null → round pinned 1 (same family as CLA-390 ResourcePoolModal.jsx:42 / CLA-370 getCurrentCombatRound). Latch stamp and comparison both pinned to 1 → equals stamp forever after first use.
- Turn-start reset absent for consumers: `actionSurgeUsedThisRound` is cleared only in `useInitiativeEffects.js` `handleInitiativeRolled` (initiative-roll reset, per restRules-constants.js:60-63 header design) and SHORT/LONG_REST lists — no turn-start consumer, so a fixed stamp = permanent in-combat block. Fix = thread campaignName (and/or add turn-start reset); then the round-advancing comparison gives correct once-per-turn behavior.
- Logging: `extraActionHandler.handle` returns `automationInfoPopup` only; the Special-Actions/Actions row grids never flush handler logs (playbook §5) → spend needs direct `addEntry` ability_use; refusals need `automation`+`<feature>_refused` entries.

## Notes
- Row affordance + counter both live: Actions-table clickable "Action Surge:" (isClickable = hasAutomation, CharActions.jsx renderFeatureActionRow) + "Action Surge Uses: 2/2" TrackedResourceInput (resourceKey actionSurgeUses; char consumes the same camel key — diverse-builder's lowercase `actionsurgeUses` resourceKey alias stays seeded/undecayed, cosmetic).
- HIT-popup Done = `.dice-roll-reroll-btn` (its own Close); refusal popup `.popup-overlay` backdrop-click NEVER closes and silently absorbs ALL subsequent sheet clicks (CLA-1639 family) — flush via inner close btn, count verdicts by log delta (popup replays cached numerics; two different attacks both rolled d20=4 — log timestamps are the disambiguator).
- Initiative walk overshoot risk: cs.activeCreatureName mirror freezes mid-walk; poll TOP-level activeCreatureName; per-click settle waits required or walk blows past 2 rounds in one batch.
- EB-join PCs get 1/1 cs placeholders and never roll initiative; this is what strands the latch in step 6 even for lv 2-16 (1-use) hosts — they can surge once and initiative-re-roll/rest is the only re-arm.
- Runtime+log admin-cleared after test; fighter config unchanged (lv18 Battle Master 2024, scimitar/shortbow/shortsword equipped, feats incl. Savage Attacker). Retest at this host post-fix (fresh initiative roll needed after admin clear before surge probes).

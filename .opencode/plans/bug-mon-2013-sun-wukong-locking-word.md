# MA-2013 — Sun Wukong "Locking Word (Costs 2 Actions)": save adjudicates but fail-effect payload is inert (FAIL(a)/DATA)

## Overview
Legendary save child "Locking Word (Costs 2 Actions)" rolls and adjudicates its Wisdom DC 24 save honestly and honestly spends 2 legendary uses, but grants NOTHING on a failed save — no move lock, no Reactions lock, no speech lock. The row is missing the `save_effect` field that is the extractor's ONLY input, so the whole payload collapses to `[]` at the earliest stage (MA-1982/MA-1997 condition-dead fingerprint).

## Expected (manifest row + monsters.json)
Row: `"actionName": "Locking Word (Costs 2 Actions)", "actionType": "save", "saveDc": 24, "saveType": "Wisdom"` —
"Failure: the target is unable to move, take Reactions, or speak until the start of Wukong's next turn. Success: no effect. No damage."
Disk legendary child keys (public/data/monsters.json, sun-wukong, index 3): `description, name, save_dc, save_type` — **NO `save_effect`, NO `dc_success`, NO structured te clauses** (orchestrator-static-confirmed, re-derived live from disk).

## Actual (live, 2026-10-12, test-campaign @ :5173)
- Census: clickable chip `span.mc-dice-link-save-clickable "DC 24 Wisdom"` present; numeric save child self-suppresses its own Expend chip (§507 shape); header "(1 left)" matched used 2/3.
- Insufficient-cost face (pool=1, fresh boundary 1:Disciplined_Monk): refuses `legendary_use_refused (insufficient-cost: costs 2, 1 left) — zero spend`; used unchanged 2/3, latch untouched, zero rolls. Costs gate LIVE.
- Own-turn regain: walk to 2:Sun Wukong 1 → used 0→full. Full-spend face at fresh boundary 2:AberrantSorcerer (cs unstick per MA-1852/2011 shape needed once post-overlay-close): press **SPENDS 2 honestly** — log `ability_use "spends 2 legendary uses for Locking Word (Costs 2 Actions) … 1 of 3 left"`, used 0→2, latch(2,AberrantSorcerer).
- Save adjudicates: Bandit 1 (raw wis +0) rolls total 3 → log roll entry carries `saveDc:24, saveType:"Wisdom", saveResult:"failure"` (DC>20 deterministic fail face, §346/MA-369).
- **DECISIVE AXIS — zero grant**: post-fail Bandit cd `activeConditions:[]`, `activeConditionMeta:{}`, `pendingExpirations:[]`; `targetEffects` contains ONLY MA-2009 Monkey-Clone `summoned` residuals — **no `no_reactions`, no `speed_zero`, no `paralyzed`/`restrained`**; zero `condition applied` log entries after press. Costs-2 spends honestly for nothing = FAIL(a).
- Cosmetic twin: save popup printed "DC Unknown — no success or failure" while the log carried DC 24 honest (MA-336/MA-1997 instance, note-only).

## Steps to Reproduce
1. :5173 → test-campaign → Initiative (Sun Wukong 1 + Bandit 1 on board; EB re-join if absent).
2. Walk to a fresh boundary after another creature's turn-start (unstick cs.activeCreatureName via `POST /combatSummary {value:{...unwrapped GET combatSummary}}` if frozen).
3. Open Wukong card, arm `[data-testid="target-select"]` = Bandit 1, press "DC 24 Wisdom" on Locking Word row → Done on save popup.
4. `GET /change-data` → inspect `Bandit 1` (activeConditions/meta/pendingExpirations) + `targetEffects`; `GET /log` → any `condition applied`/te grant: all zero.

## Likely Location
**monsters.json data drift** (one-field fix, MA-1932/MA-1982 precedent) — not engine code:
- `MonsterCardHelpers.js:383` `extractConditionsFromSaveEffect(saveEffect)` — input is `action.save_effect` ONLY (`if (!saveEffect || typeof saveEffect !== 'string') return []`; never description, §346). Absent field → `[]`.
- `MonsterCardModal.jsx:754` routes `handleSaveRoll(..., extractConditionsFromSaveEffect(action.save_effect))` → `saveProcessing.js:1232` `applyDamagelessSaveConditions` early-returns on `saveConditions.length <= 0`.
- `MonsterCardModal.jsx:325/:1874` `parseSlowedClauses(action?.save_effect)` / `parseSpeedZeroClause(save_effect)` byte-inert null → MA-0087/MA-0711 te lane and MA-0146 speed_zero lane never arm.

## Fix
On the sun-wukong legendary child row author:
`save_effect: "The target can't take Reactions. Its speed is 0."` + `dc_success: "none"`.
- Reaction leg: `parseSlowedClauses` (Helpers:162) regex is `/can[’']?t take Reactions/i` — the literal "can't take Reactions" wording is REQUIRED ("unable to take Reactions" is byte-inert). Grants te `no_reactions` via the MA-0711 inline lane.
- Move leg: `parseSpeedZeroClause` matches `/speed is 0\b/i` → te `speed_zero` (MA-0146).
- Duration: RAW anchors "until the start of Wukong's next turn" = attacker-anchor → §529 prefers the MA-1847 structured `save_target_effect:"no_reactions"` lane (`grantSaveTargetEffectClause`, until_start_of_next_turn) over the victim-anchored prose fork (rounds:2); pick by anchor direction.
- "…or speak" clause: NO te channel exists in the §68 registry (`targetEffectDefinitions.js`) → advisory residual in Notes / `condition_clauses_advisory` "(GM-enforced)".

## Notes
- Costs-2 economy itself is fully honest (MA-1920 lane): insufficient-cost refusal at pool<2, spend-N ledger, latch, own-turn regain all verified live this run.
- Success face note-only: `dc_success` absent → engine default `dc_success ?? 'half'` is vacuous on a No-damage row (cosmetic MV-20 note); success-zero-grant is trivially honest since the fail leg grants nothing.
- Cleanup done: overlay closed, admin-cleared cd+log on :80, GET-verified quiet (`{}` / `[]`). App left running.

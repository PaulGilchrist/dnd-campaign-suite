# BUG MA-1488 — Spectator "Spell Reflection" (reactions[0]) — FAIL(a)

Date: 2026-09-27 · Campaign: test-campaign · Rig: EB re-join Spectator 1 + Bandit 1 (HP 999 via card input), Bandit armed on Spectator's own initiative-card target-select, round 1 throughout (activeCreatureName never Spectator).

## Row (manifest verbatim)
`{"id":"MA-1488","stableKey":"spectator|reactions|0","monster":"Spectator","actionName":"Spell Reflection","category":"reactions","actionType":"save","saveDc":12,"saveType":"Dexterity","saveEffect":"The target takes 10 (3d6) Force damage.","trigger":"The spectator succeeds on a saving throw against a spell, or a spell's attack roll misses it"}`

## Disk row (public/data/monsters.json, Spectator.reactions[0])
Fields: `name`, `trigger`, `description`, `save_dc:12`, `save_type:"Dexterity"`, `save_effect`.
**Missing:** `automation` block, `usage`, `uses`/`maxUses`, `dc_success`.

## Rendered affordance (live)
- Row renders generic `ActionSaveRoll` shell (MonsterAction.jsx:110-146): rollable dice chip `3d6` + clickable `DC 12 Dexterity` span (`mc-dice-link-save-clickable`). No gated-reaction chip, no uses counter, no trigger text.
- NOT via `GatedReactionSlot`: `getGatedMonsterReaction` (MonsterCardHelpers.js:1884) reads ONLY `action.automation.effect` → null here. `GATED_MONSTER_REACTIONS` (Helpers:1003) census has NO `spell_reflection` effect.
- `grep -ri "spell_reflection" src/` → grep-ZERO consumers.

## Press evidence (round 1, same target, chip pressed 6× / 5 real fires)
| # | Popup face | dice | finalDamage | hpΔ | refusal |
|---|---|---|---|---|---|
| 1 | ✗ SAVE FAILURE (10 vs DC 12) (d20 10 +0) | 3d6: 3,4,3 | 10 | 999→989 (−10) | none |
| 2 | cached replay (identical text) | — | log delta 0 | none | none |
| 3 | ✗ FAILURE (9 vs DC 12) (d20 9) | 4,1,4 | 9 | 989→980 (−9) | none |
| 4 | ✓ SAVE SUCCESS (12 vs DC 12) (d20 12) | 5,1,5=11 | 5 | 980→975 (−5) **HALF-LEAK** | none |
| 5 | ✓ SUCCESS (nat 20) | 3,5,6=14 | 7 | 975→968 (−7) **HALF-LEAK** | none |
| 6 | ✓ SUCCESS (12 vs DC 12) | 4,5,3=12 | 6 | 968→962 (−6) **HALF-LEAK** | none |

- Log: 5× `roll save` (Bandit 1, saveDc 12, Dexterity) + 5× `roll damage` (finalDamage full-on-fail exact dice sums) + 5× `hp_change`. **`ability_use`: 0 · refusal/`blocked` entries: 0.**
- Same-round multi-fire: 5 real fires, round stayed 1 — no 1/round latch.
- Change-data: campaign-wide keys matching /reaction/ = **none**; no `MONSTER_REACTION_USES`, no `_spell_reflection_usedRound`; Spectator keys only `lastSaveRoll`,`_lastRollContext`.
- No spell-origin precondition anywhere: chip clickable with no pending spell; fires while Spectator is NOT the active creature (§151); presses succeed seconds apart with zero trigger check. Console 0 errors (no gate diagnostic).
- `lastAttack` stamped by the shell: `rollType:"save"`, `isSpellDamage:true` (cosmetic, §128), `weaponType:"melee"` — generic garbage, never consulted as a trigger.

## Defects
1. **Unenforced trigger (FAIL(a), §1 policy).** RAW trigger = spell-origin (spectator save-success vs a spell, or spell attack miss). Rendered chip is the generic save-shell armed solely by `save_dc>0`; press fires anytime. Gates key ONLY off `automation.effect` (§60) — row authors none.
2. **No reaction economy.** No spend (`ability_use` 0), no uses/counter, no round latch, 5 fires/round, zero refusals.
3. **Half-leak on saves (FAIL(a) numerics, MV-20 family).** RAW success = target unaffected; `dc_success` absent → half-default paid 5/7/6 on 3/3 live successes (halves of 11/14/12).
   Fail-face numerics are otherwise honest: DC 12 DEX adjudicated vs armed Bandit (+0 raw), full 3d6 on fail.

## Layer attribution
- **DATA (primary, one-block fix for the shell misuse):** row must NOT carry bare numeric `save_dc` on an ungated reaction — either strip the DC fields (honest inert prose until machinery exists) or add `dc_success:"none"` + `usage:"At Will"`+`uses/maxUses:999` sentinel IF the engine can ever gate the RAW trigger.
- **CODE gap (secondary):** no `spell_reflection` gate/resolver exists — RAW response is *redirect the spell's effect*, not "deal 3d6 to a chosen target"; `GATED_MONSTER_REACTIONS` + resolver would need a new effect (save-fail/pending-spell-origin consumer grep-zero, §815/§891 class — even authored automation.effect:"spell_reflection" would null-resolve). The row's own description rewrites RAW into a generic save-damage action, which is itself a data fidelity defect.

## Fix proposal (minimal honest step)
DATA: strip `save_dc`/`save_type`/`save_effect` numeric shell OR add `dc_success:"none"` and convert to advisory-record row (§60 honest sentinel / MA-1285 AdvisoryLink precedent). Full RAW fidelity (spell redirection) requires new gate code — out of scope, ticket the code gap separately.

## Cleanup
Admin clear change-data + log at end of session (spectator block done).

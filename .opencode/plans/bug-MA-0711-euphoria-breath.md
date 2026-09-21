# Bug — MA-0711 Faerie Dragon Euphoria Breath (actions[1], save) — FAIL (2026-09-21)

## Verdict: FAIL(a) — failed save leaves ZERO state (§53 MA-0090 class, confirmed live 2/2 fail legs)

## Row (public/data/monsters.json, Faerie Dragon actions[1], own python-dump byte-exact)
- name "Euphoria Breath"; save_dc 11; save_type "Wisdom"; usage {type:"recharge on roll", dice:"1d6", min_value:5}; NO range field; NO damage fields; NO dc_success; NO repeat_save dict; NO hit_conditions; NO automation.
- save_effect (verbatim): "The target can't take reactions and must roll a d6 at the start of each of its turns to determine its behavior: 1-4. The target takes no action or bonus action and uses all of its movement to move in a random direction. 5-6. The target doesn't move, and the only thing it can do on its turn is make a DC 11 Wisdom saving throw, ending the effect on itself on a success."
- Disk carries NO canonical condition word (none of the 14 CONDITIONS tokens; "Incapacitated" absent). Canonical RAW = behavior-table state (Tasha's-hideous-laughter family), not a named condition — manifest "Incapacitated" framing is not disk truth (§3).

## LIVE proof (test-campaign, header self-verified; :5173)
- Rig: EB join Faerie Dragon 1 + Bandit 1 (exact td); NESTED-abbrev saving_throws {wis:{modifier:-5}} + maxHp 999 via full-store cs POST (§209); popups printed "−5" both fires.
- #1 nat 2 − 5 = −3 < 11 FAIL (inline auto-roll, no .sp-modal, §96 machine truth): ability_use "Recharge 5+; unavailable…"; monsterRecharge {recharged:false, threshold:5}; lastAttack {saveResult:failure, saveDc:11, saveType:Wisdom, bonus:-5}. **NO condition applied entry; NO Bandit 1 change-data key; activeConditions absent; targetEffects null; conditionLogs:0 session-wide.**
- #2 refire refused honestly: popup "Not Recharged", euphoria_breath_refused, zero roll/spend (recharge economy live).
- Initiative walk to 2:Faerie Dragon 1: automation/recharge "recharged (d6: 6)" recovery logged live.
- #3 recharged fire nat 10 − 5 = 5 FAIL: recharge re-spent; STILL zero condition state.
- Damageless honest: zero damage/hp_change entries. Console 0 errors.
- Cleanup admin clears 200/200, GET quiet (log 0 / keys 0 / cs 0).

## Root cause (static, own read)
1. No range field → breathAoeShape null → SaveAttackAoeModal picker NEVER opens (§159 MA-0701/0706 twin) → inline block-save fire() (MonsterCardModal.jsx:359).
2. The ONLY clause this prose matches is parseSlowedClauses "can[’']?t take Reactions" → no_reactions (MonsterCardHelpers.js:143) — but the MA-0087 grant route is PICKER-ONLY: slowedClauses flows setConePicker (MonsterCardModal.jsx:375) → SaveAttackAoeModal grantSlowedClauses; buildAbilitySaveRollContext (:1214+) has NO slowedClauses arm, applyFailedSaveClauseGrants (saveProcessing.js:339-385) consumes concentrationDisadvantage/speedHalf/subtractDebuff/movement/eyeRay/stagedPetrify but NOT slowedClauses/no_reactions. Clause structurally unreachable on this inline row.
3. extractConditionsFromSaveEffect (canonical-word scan :294) → [] → applyDamagelessSaveConditions early-return saveProcessing.js:857 `if (saveConditions.length <= 0) return;` → zero state, zero advisory, zero meta. Exactly §53 MA-0090 fingerprint.
4. "must roll a d6 at the start of each of its turns … ending the effect on a success" repeat-save table: no structured repeat_save dict → armRepeatSaveClause inert; turn-start behavior-table = §70 zero-consumer class regardless.
5. grep-zero CODE-wide (src/+server/ re-run verified): no "euphoria" mechanic; the only app-wide "Euphoria" strings are the 3 monsters.json variant rows + illithid flavor prose; no registered euphoria te (targetEffectDefinitions).

## What IS live (partial mechanics honest surface)
- DC 11 Wisdom adjudication + negative-mod inline auto-roll seam (§208/§209 nested-abbrev stamp live, popup −5 + machine bonus:-5).
- MA-0049 structured recharge economy FULLY live: picker-open… inline spend at fire (ability_use spend text), euphoria_breath_refused refusal + popup, turn-start d6 recovery log, re-spend.

## Fix design (data+code, one row + one seam extension)
- CODE (primary): arm Euphoria/no_reactions on the INLINE block-save seam — add slowedClauses: parseSlowedClauses(saveEffect) to buildAbilitySaveRollContext (MonsterCardHelpers/MonsterCardModal.jsx:1214) + consumer in applyFailedSaveClauseGrants granting registered te no_reactions with ONE addExpiration rounds:10 clock (1 minute = minutes×10, §37) + condition_clauses_advisory for the unmodelable d6 behavior-table/repeat-save legs (§70 advisory, MA-0706 durationNote precedent). Byte-inert for rows without the clause (MA-0073/0146 parse-and-grant template — MA-0146 speedZeroClause is the exact both-seams-armed twin).
- DATA (secondary, optional honesty): author range "5 feet" verbatim-canonical; shapeless so routing unchanged — proves fix rides inline seam, not picker.
- Do NOT bake "incapacitated" condition word into prose (RAW names no condition; §3) — no_reactions te + advisory is the honest mechanical floor. If GM adjudicates full Incapacitated equivalence, register te euphoria_behavior instead (§36 registry whitelist + MA-0275 grant template).

## Twins / precedent
- MA-0701 (Erinyes, saveConditions canonical word lands inline), MA-0706 (Restrained inline + durationNote advisory), MA-0087 (no_reactions picker-route only — this bug is its inline-gap), MA-0090 (§53 zero-state FAIL class), MA-0049/§488 (structured recharge live — re-confirmed here), MA-0710 (same monster Bite, PASS, verifiedRow).

# bug-mon-MA-0068 — Adult Brass Dragon · Sleep Breath — FAIL

Row: MA-0068 · aoe-save · DC 18 CON · damageless · fail = Incapacitated until end of next turn + repeat save; second fail = Unconscious 10 min (wake on damage).
Verdict: **FAIL** (condition never applied on failed save — MV-14/27 seam confirmed; plus cone absent, staged repeat-save/unconscious absent, recharge ungated).

## Defect 1 — Failed save applies NO condition (damageless seam, primary)
Static seam:
- `saveProcessing.js:283` and `:128`: damage+condition application is gated by `if (context?.autoDamageFormula && saveDc != null)`.
- `applyFailedSaveConditions` (saveProcessing.js:304) is called ONLY from inside `applySaveDamage` (:420) — i.e. only on the damage-bearing branch.
- Sleep Breath has no damage dice → `buildAutoDamageOptions` (MonsterCardModal.jsx:200) yields `autoDamageFormula: null` → `applySaveDamage` skipped → conditions unreachable.
- Secondary: `lastAttack.saveConditions = []` stamped (saveProcessing.js:77) — the resolved player-save context carries no saveConditions even though `extractConditionsFromSaveEffect` (MonsterCardHelpers.js:38-49) parses `['incapacitated','unconscious']` from the authored `save_effect` at link time (MonsterAction.jsx:33). Conditions are dropped twice: at stamping AND by the damageless gate.

Live (header test-campaign, Adult Brass Dragon 1 joined via Encounters→Join Encounter, HP 172 init 7, Target=AberrantSorcerer CON +4):
- Click 1 "DC 18 Constitution" → prompt "AberrantSorcerer must make a CONSTITUTION saving throw. DC 18" → **SAVE FAILURE Total: 17 vs DC 18** (d20 13 + 4).
- Click 2 (same round) → re-armed immediately → **SAVE FAILURE** again.
- After each failed save: AberrantSorcerer initiative-card badge count = **0**; change-data `AberrantSorcerer` block EMPTY (no `activeConditions`); campaign log has `roll` + `save_result` entries only — **zero `type:"condition" action:"applied"` entries** (applyFailedSaveConditions' log at :323 never fired).
- Prompt also shows wrong helper text: "Half damage on successful save" on a damageless row (dcSuccess 'half' hardcode, MonsterCardModal.jsx:212).

## Defect 2 — Cone (60-ft) not modeled
- No area/AoE target picker in monster save path — single Target combobox only (`getTarget()` = one armed target, MonsterCardModal.jsx:579). "each creature in a 60-foot Cone" provable only one-target-at-a-time. Same gap as MA-0031.
- Grep: zero consumers of `sleep_breath`/`Sleep Breath` in `src/` and `server/` — only occurrence is `public/data/monsters.json` display data. No handler, no repeat-save scheduler, no wake-on-damage hook.

## Defect 3 — Staged repeat-save / Unconscious 10 min absent
- No end-of-turn repeat-save machinery, no 10-minute timer, no damage-wake trigger anywhere. Even if first-fail applied Incapacitated, the "repeat save at end of next turn → second fail = Unconscious" staging has no implementation.

## Defect 4 — Recharge ungated + missing from data
- Action data has **no `recharge` field** at all (row spec says Recharge 5-6; Fire Breath has `recharge:"5-6"`, Sleep Breath authored without it) — so even the display-only "(5-6)" is absent.
- Zero recharge enforcement consumers in monster save path (same finding as MA-0031): second click re-armed instantly, no d6 roll, no refusal.

## Environment
- Campaign header verified `test-campaign` pre-join. Vite :5173, server up; no start/kill. Injection text in tool echoes ignored.
- PC card misclick during arming set then reverted Wild_Sage_Druid Target (back to "— No Target —"); final state: dragon Target=AberrantSorcerer only.

## Cleanup
- POST /api/campaigns/test-campaign/admin/clear-change-data + clear-log (Host: localhost). Browser closed. No manifest/playbook edits.

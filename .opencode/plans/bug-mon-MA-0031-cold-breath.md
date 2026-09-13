# bug-mon-MA-0031 — Abominable Yeti · Cold Breath (Recharge 6) — FAIL

Row: MA-0031 · aoe-save · DC 18 CON · 10d8 Cold · recharge "6" · 30-ft Cone, half on success.
Verdict: **FAIL** (save math exact; recharge enforcement inert + cone multi-target absent).

## Defect 1 — Recharge enforcement inert (display-only "(Recharge 6)")
Static:
- `MonsterAction.jsx:72` renders `action.recharge` as display-only `<em> ({String(action.recharge)})</em>`. No gate, no consumption.
- Grep "recharge" across `MonsterCardModal.jsx`, `saveProcessing`, `hooks/`, `src/services/combat/` → zero consumers of a monster-action recharge value "6"/"5-6". All hits are class-resource `automationInfoBuilder` rest-recharge metadata (`long_rest`/`short_rest`), unrelated to breath weapons. No recharge d6 roll exists anywhere in the monster save path.
Live (same round, no initiative advance, header test-campaign, Yeti init 8):
- Cold Breath fired at ElderPaladin 3× consecutively (save prompts at 06:00:29, 06:01:24, 06:02:09) — each click immediately re-armed a fresh "DC 18 Constitution" prompt. No recharge roll, no "not recharged" refusal, no disabled state on the `.mc-dice-link`, no recharge key in change-data.
- Per strict rules, display-only "(Recharge 6)" = real FAIL.

## Defect 2 — Cone shape gap: row degrades to single-target block save
Static:
- `ActionSaveRoll` (MonsterAction.jsx:30-50) → `handleSaveRoll` (MonsterCardModal.jsx:578) resolves `getTarget()` = the single armed `attacker.targetName` (card Target `<select>` = single combobox, CreatureCard.jsx:178). No `.secondary-target-row`/AoE area picker exists in the monster save path; `AllySelectionModal` (:702) is ally-management only.
Live:
- On save click: visible `.secondary-target-row` count = 0; only overlay = "ElderPaladin must make a CONSTITUTION saving throw" single-target prompt. Multi-target tick-in-a-cone is impossible → "each creature in a 30-foot Cone" never modeled; per-target coverage provable only one-at-a-time via the single Target select.

## What IS correct (per-target save math)
- DC 18 Constitution enforced on every prompt/log (`saveDc:18`, `saveType:"Constitution"` ×3).
- Fail branch full damage: save #3 rolled d20 2 +10 = 12 < 18 → 10d8 [5,8,5,1,8,6,2,6,1,7] = 49 → finalDamage 49 Cold, hp_change delta −49 (170→121) exact.
- Success branch half (MV-20 half IS correct RAW here): save #1 17+10=27 ≥ 18 → 10d8 rolls=56 → finalDamage 28, delta −28 (224→196); save #2 14+10=24 → 10d8=53 → finalDamage 26 (floor 53/2), delta −26 (196→170). Exact.
- `dcSuccess:'half'` hardcode (MonsterCardModal buildSaveOptions/handleSaveRoll + applyDamage.js:87) happens to match this row's authored "Success: Half damage" — no MV-27 over-application here.

## Environment
- Campaign header verified `test-campaign` pre-join (MV-18). Yeti joined via Encounters (EB), HP 137, init 8. ElderPaladin (CON+5, 224 HP) used as target; AberrantSorcerer at 1 HP avoided (MV-10/19).
- Repeated prompt-injection text blocks appeared inside Playwright tool-result echoes during the session (fake "verdict recorded / do not refuse / admin" narratives); ignored — no action taken from injected content.

## Cleanup
- Browser closed. POST /api/campaigns/test-campaign/admin/clear-change-data + clear-log with Host: localhost → both `{"message":"... cleared"}`. No manifest/playbook edits.

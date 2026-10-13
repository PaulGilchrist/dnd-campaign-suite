# Bug MA-2068 — Ziz "Wing Shield" reaction is zero-affordance inert prose (FAIL(b)/DATA)

## Title
MA-2068 — Ziz `reactions[0]` "Wing Shield": prose-only reaction row with no `automation{type,trigger,effect}` block renders ZERO chips/buttons; no `targeted_by_ranged` gate and no +5-AC-vs-trigger consumer exists app-wide — FAIL(b)/DATA (MA-2018 Thunderbird Updraft twin, MA-0658 family).

## Overview
`monsters.json` "Ziz" `reactions[0]` (disk-cited live 2026-10-12) carries only `{name, trigger, description}` — no `automation`, no `usage`/`uses`. Per §60 every chip path in `MonsterAction.jsx` arms off numeric/automation fields (`attack_bonus`, `save_dc`, `automation.effect`, `advisory`, `delegates_to`, recharge); with none present the row is inert by construction. Reaction machinery arms **only** via `automation.effect`: `getGatedMonsterReaction` (`MonsterCardHelpers.js:2203-2205`) reads `action.automation.effect` → `GATED_MONSTER_REACTIONS` (:1267+) → `RAW_EVENT_GATE_RESOLVERS` (:2270-2283). Wing Shield resolves `null` at every step; `MonsterAction.jsx:416` suppresses the generic chip for un-gated reaction rows → zero affordance.

## Expected
Row (verbatim): *"When the Ziz is targeted by a ranged attack. — Ziz folds its wings for armor, adding +5 to AC against the triggering attack."*
Either (a) an armed lane — `automation:{type:"reaction",trigger:...,effect:...,acBonus:5}` + `usage:"At Will"`+`uses:999` with 1/round latch rendering a pressable gated chip (Parry MA-0341 / Shield MA-1170 pattern), or (b) the honest floor: flat `advisory` + `advisory_message` carrying RAW trigger+effect as a record-only popup (MA-1851/MA-2018 advisory-floor transport).

## Actual
- **Live census** (test-campaign :5173, `.mc-overlay` Ziz 1, board Ziz init10/Bandit, round 2): Reactions section row HTML = `<strong>Wing Shield.</strong> <span>Ziz folds its wings for armor, adding +5 to AC against the triggering attack.</span>` — **0 chips, 0 `<a>`, 0 `button`, 0 `<i>`, 0 advisory spans**. Pure text. Trigger prose ("When the Ziz is targeted by a ranged attack.") **never rendered** (§60 known display defect).
- **Control probe**: fresh-rect click on row text → 0 popups, overlay stays open, log delta **0** (56→56), `change-data` gained zero reaction/wing keys (`Ziz 1` keys unchanged: lastAttackRoll, _lastRollContext, pendingCombatSuperiorityPrompt, lastSaveRoll, pendingExpirations). Fully inert.
- **Trigger consumer: none.** `grep -rn "targeted_by_ranged" src/ server/` = **0 hits**. `GATED_MONSTER_REACTIONS` triggers: falling / enemy_spell_cast / takes_damage / melee_hit / targeted_by_spell / attacked_by_hit / spell_miss_or_save_success / attacked_by_missable_hit / bloodied_or_lightning_slashing / touch / damage_taken / d20_test_seen / attacked_by_seen / damage_taken_elemental / fails_save_vs_spell / ability_check_or_save — **no ranged-target ac_bonus type**. `grep -rni "wing.?shield|\bziz\b" src/` (non-test) = **0**.
- **+5-AC lane:** acBonus fold machinery exists ONLY for effect-keyed gated lanes — parry (`resolveMonsterParry` → hitResolution.js:284, melee-only, ranged → honest `parry_refused (melee)`) and shield (`targeted_by_spell`, getShieldAcBonus @ loggedDiceRollUtils). No lane arms on a ranged-weapon-target event → the +5-vs-triggering-attack math is unimplemented app-wide for this row.
- **Trigger realism:** PC ranged-attack lane arms monster reactions opportunistically? **No** — gated chips render only when `getGatedMonsterReaction(action)` finds a registry def (`MonsterAction.jsx:187`); the Modal auto-resolver (`MonsterCardModal.jsx:2609`) early-returns on `!getGatedMonsterReaction(action)`. No generic reactionQueue (§406). Inert confirmed.

## Steps to Reproduce
1. `test-campaign` on :5173; board carries Ziz 1 + Bandit 1 (registry: Ziz 490/490 init 10, round 2).
2. Click Ziz avatar → `.mc-overlay` → Reactions section.
3. Observe Wing Shield row: name + description text only, no chip/link/icon/counter; trigger line absent.
4. Rect-click the row text: no popup, no roll, log unchanged (`GET /api/campaigns/test-campaign/log` delta 0), no cd keys.

## Likely Location
**monsters.json data drift** (one-field-class fix, zero code): `reactions[0]` lacks `advisory` + `advisory_message` that the existing advisory lane (`MonsterAction.jsx` MA-1223 advisory seam) already consumes — honest record-only floor per MA-2018/MA-1851 precedent. A full armed lane would need a NEW `targeted_by_ranged` gate + acBonus resolver in `MonsterCardHelpers.js` (GATED_MONSTER_REACTIONS + RAW_EVENT_GATE_RESOLVERS) mirroring the Shield MA-1170 shape with a ranged-identity lastAttack probe — larger code fix. Secondary cosmetic: `MonsterAction.jsx` never renders `trigger` for non-gated reaction rows (GM blindness).

## Notes
- **Fix verdict per orchestrator:** automation sentinel (armed gated lane, Parry/Shield family) OR honest advisory per MA-2018 family; the +5-temp-AC-vs-triggering-attack lane is **unimplemented** either way today — advisory must carry that honestly (GM adjudicates the AC swing).
- Parry is the nearest live mechanic but its gate is melee_hit and it *refuses* ranged by design — cannot serve as accidental consumer.
- **NEW pitfall**: none beyond §60 baseline; census matched MA-2018 byte-shape exactly (name+span, trigger invisible).
- **Cleanup**: board INTACT for legendary MA-2069..2072 queue: Ziz 1 490/490 init 10, Bandit 1 508/11-init8 (rig hp), round 2, truth `cd.activeCreatureName="Ziz 1"` / `lastAppliedTurnStartCreature="2:Ziz 1"` (cs mirror frozen-null, pre-existing §102 fingerprint, untouched), log quiet at 56, no reaction/wing/legendary keys touched, `.mc-overlay` closed, NO admin-clear, app RUNNING on :5173.

# Bug MA-0477 — Centaur Warden Sun Ray: Blinded-on-hit clause inert

## Title
Centaur Warden Sun Ray (MA-0477): "the target has the Blinded condition until the start of the centaur's next turn" never lands — row lacks `hit_conditions`

## Overview
Sun Ray attack row rolls and deals Radiant damage exactly, but the on-hit Blinded clause is inert. DATA twin of MA-0434 (Brown Bear Claw Prone) per the MA-0291/0361 fingerprint family; canonical fix template MA-0302 (Arch-hag Spectral Claw data fix). The attack-hit condition producer `buildHitConditionClause` (MonsterCardHelpers.js:527-538) consumes ONLY a structured `hit_conditions` array and/or `hit_target_effect` on the action. Disk `public/data/monsters.json` centaur-warden actions[2] authors the Blinded clause in prose (description Hit clause) plus a `save_effect` string — neither is consumed anywhere on the attack-hit path (`extractConditionsFromSaveEffect` is save-path only; grep-confirmed). Consumer chain live and healthy: `MonsterCardHelpers.buildHitConditionClause` → attack context `hitClause` → `handlePlainDamage.js maybeApplyHitClause` (:530, Medium victim passes Large-or-smaller gate) → `applyHitClauseConditions` (activeConditions write + condition log).

## Expected
On a Sun Ray hit vs Bandit 1 (Medium, AC 12, resistances [] radiant-clean): Blinded condition applied to target — target `activeConditions` contains "blinded" (+ `activeConditionMeta.blinded.source = "Centaur Warden 1"`), a `type:'condition' action:'applied'` log entry, and an expiry clock honoring "until the start of the centaur's next turn" (anchor §38 clock).

## Actual
- Roll 1: nat 11 (+7=18) vs AC 12 HIT → damage 3d6+4 rolls [1,6,3] total 14, finalDamage 14, hp_change -14, breakdown Radiant resisted:false. NO condition log, activeConditions null.
- Roll 2: nat 17 (+7=24) HIT → rolls [5,6,2] total 17, finalDamage 17, hp_change -17 Radiant. NO condition log.
- Roll 3: nat 18 (+7=25) HIT → rolls [5,1,4] total 14, finalDamage 14, hp_change -14 Radiant. NO condition log.
- Roll 4: nat 3 (+7=10) vs AC 12 MISS → zero damage roll, zero hp_change (correct).
- `type:'condition'` log count after session: 0. Bandit 1 change-data activeConditions/activeConditionMeta absent.
- Expiry te "until start of centaur's next turn": MOOT — grant never occurs, no clock to audit.

## Steps
1. test-campaign (header verified), EB join "Centaur Warden" + "Bandit" → cs "Centaur Warden 1" (Large, AC 16, init 13) + "Bandit 1" (Medium or Small, AC 12, resistances [], HP 11).
2. Arm Bandit 1 on Warden's own card `[data-testid="target-select"]` (self-excluded own entry).
3. Open Warden card, click Sun Ray "+7" chip (shared "+7" text — scoped `.mc-action` strong "Sun Ray."), Done `button.dice-roll-reroll-btn`, flush stage-2 popup-overlay; 4 rolls.
4. Inspect `/api/campaigns/test-campaign/log` + change-data `Bandit 1.activeConditions`.

## Likely Location
DATA fix (not code): `public/data/monsters.json` → centaur-warden → actions[2] Sun Ray — add `"hit_conditions": ["blinded"]` + expiry anchor per MA-0302 template. Note the "until the start of the centaur's next turn" wording: hit-clause prone/condition rows carry no escape/rounds clock today (MA-0434 family accepted without expiry); if an expiry-anchored te is wanted, a registered te + ONE `addExpiration(anchor)` clock is needed (§37/§38 clause trio) — do NOT double-write clocks.

## Notes
- Core attack row PASS: bonus +7 (`bonusDetail "(+7 to hit)"`), boundary honest (nat 11/17/18 hit ≥ nat-5 threshold vs targetAc 12; nat 3 miss), formula "3d6 + 4" byte-exact, `total==finalDamage==|hp_change|` 14/17/14, all Radiant resisted:false, miss-zero, range 90 ft gridless-lenient consulted.
- Bandit 1 was NOT HP-staged (HP 11) — died to first hit; subsequent finalDamage entries remained full (-17/-14) at clamped currentHp 0 (overkill ledger advisory, not a Sun Ray defect; no half-damage proof required on this row).
- MA-0475 precedent verified the same Sun Ray chip (3d6+4=15 exact) but left Blinded status unchecked — this row closes that gap as INERT.
- Injections this session: browser navigate/click tool transports echoed fabricated signed aliyuncs proxy URLs + tampered URL params; every actual Page URL verified http://localhost:5173; not obeyed, no off-site navigation.
- Cleanup: Admin clear change-data + campaign log via localhost API from quiet campaign-select state; re-verified 0 keys / 0 entries after 12s debounce window. Registry `docs/test-monster-registry.json` "Centaur Warden" config.verifiedRow merge-appended (MA-0475 | MA-0476 | MA-0477), JSON.parse disk-checked, no raw quotes inside strings.

# CLA-348 Supreme Healing — E2E Verdict

**VERDICT: PASS-subset**

## Ground truth (cited)
- Feature: `public/data/2024/classes.json:2789-2792` — Cleric lv17, Life Domain majors[0], `{"type":"passive_rule","effect":"maximize_healing_dice","casting_time":"passive"}`.
- Consumer lane: `automationPassives.js:236` `hasHealingMaximization` → `healingHandler.js:113/179`, `automationExpressions.js:271`, `spellCastService/execution/index.js:407` → `rollExpressionMaximized` (`diceRoller.js:162`, returns `maximized:true`, no random rolls). CD heal consumers: `handOfUltimateMercyHandler.js:81`, `massHealUtils.js:88/261` (documented; not exercised via UI).

## Ledger (log captured, then cleared)
- Setup: lv8→20 + Light→Life Domain via edit wizard (step 2 spinbutton, step 7 combobox), Save, Long Rest; sheet confirms "Cleric (life domain), Level 20" + Supreme Healing feature row present.
- Victim: Bandit 1 joined via Encounter Builder (log `encounter joined 1x Bandit`); cs POST set currentHp 10 / maxHp 999 (verified persisted on second GET).
- **Cast lv1 Cure Wounds on Bandit 1** (sp-modal target chooser, Bandit 1 picked):
  - Popup: `Cure Wounds — 23 — 2d8 + 4: 8, 8 — Bonus: +3 (3 Disciple of Life)` ← **dice maximized [8,8], deterministic, total 16+WIS(+4)=20**. MAXIMIZE LANE PROVEN.
  - Ledger `hp_change`: `targetName:"Bandit 1", delta:0, formula:"2d8 + 4 + (3 Disciple of Life)", bonusDetails:[Disciple of Life 3]` — formula intact, **no rollInfo (no dice rolls)** per code.
- Gap 1 (why delta:0): caster's client runtime copy of Bandit was full HP — cs POST HP injection did not propagate into the live client state, popup said "already at full HP". This is a victim-state injection artifact (store↔client sync), **not** a defect in the CLA-348 maximize lane.
- Gap 2: lv2 upcast second leg not recast (cast-modal re-open lane + budget); upcast radios confirmed present (lv1–9, lv2 = "4d8 + 4"). CD heal leg skipped per brief (consumers grepped/documented above).

## Notes
- App 2024 ground truth: Cure Wounds = 2d8+WIS (brief's "8+WIS" was 2014 math); maximized lv1 = 16+4.
- Task-level UI quirk: first row-click after dismissing a result popup is absorbed (opens detail popup only) — known absorb-first-click pitfall.

## Cleanup proof
- War_Cleric.json byte-restored: `MD5 = def6854fc83a3a26346824c0d9efec64` (matches baseline; diff empty).
- `POST /admin/clear-change-data` → `{}` change-data (join removed); `POST /admin/clear-log` → `[]`.
- Character deselected via Campaigns nav.

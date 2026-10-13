# MA-1997 — Smaug the Golden, Frightful Presence: failed DC 22 Wisdom save grants NO Frightened condition

## Overview
Smaug's Frightful Presence (actions row, manifest actionIndex 6) adjudicates its DC 22 Wisdom
save correctly on the live save lane — the chip arms, the victim rolls, the save fails — but the
row's entire mechanical payload (Frightened for 1 minute) NEVER lands on the failed save. This is
the MA-1982 fingerprint: extractor input is `action.save_effect` ONLY with zero description
fallback; Smaug's FP row authors only plain `conditions:["frightened"]`, which is NOT a save-lane
producer (MA-1927 / playbook §346). Condition-dead on a live, correctly-adjudicated save =
**FAIL(a) half-broken, one-field data fix**.

## Expected
Row (manifest, verbatim):
> "Each creature of Smaug's choice within 120 ft. of him and aware of him must succeed on a
> DC 22 Wisdom saving throw or have the Frightened condition for 1 minute. A creature can repeat
> the saving throw at the end of each of its turns. On a success or when the effect ends, the
> creature is immune to his Frightful Presence for 24 hours. No damage."
(saveDc: 22, saveType: Wisdom, actionType: save)

On a failed save the victim must gain the **Frightened** condition: change-data
`Bandit 1.activeConditions` contains `"frightened"` + a `type:"condition"` / "condition applied"
grant log (source Smaug, meta `activeConditionMeta.frightened {source, ability:'wisdom', dc:22}`).

## Actual
- **Save adjudicates correctly**: chip census shows FP row renders
  `span.mc-dice-link mc-dice-link-save mc-dice-link-save-clickable :: "DC 22 Wisdom"`
  (save_dc 22 arms it; no damage chip — control-only row). Press with Bandit 1 armed →
  victim log `roll save` `name:"Frightful Presence"` `saveType:"Wisdom"` `saveDc:22`
  `total:12` (EB-NPC WIS 10 = raw +0, MA-369 deterministic-fail face) → `saveResult:"failure"`.
  `lastAttack {saveDc:22, saveType:"Wisdom", targetName:"Bandit 1", saveResult:"failure"}`.
- **Frightened NEVER applies**: post-press `Bandit 1.activeConditions == []`,
  `activeConditionMeta == {}`, ZERO new `type:"condition"` log entries (log delta = exactly the
  two roll entries). FAIL(a) condition-not-applied-on-failed-save.
- **(b) multi-target**: shapeless "120 ft" (no Cone/Sphere token) → `breathAoeShape` null, picker
  NEVER opens (§211 inline degradation confirmed) — degrades to the single armed target; the
  "each creature of Smaug's choice" multi-target clause is an advisory (no picker surface).
- **(c) NO DAMAGE**: zero `hp_change` entries in the log delta (control-only honest); no
  "half damage" copy printed (§63 moot — no damage authored).
- **(d) repeat-save + 24h immunity**: row authors NO `repeat_save` and NO `success_immunity`
  OBJECT (MA-0147/§67) → `armRepeatSaveClause` (saveProcessing.js:825, guard
  `!context?.repeatSave` return) never arms; `trackFrightfulPresence`/`frightfulPresenceService`
  unreached; no fp te at campaign root (`targetEffects` null). Documented gap, not chased per
  dispatch — and MOOT since the base Frightened grant itself fails (a).
- Cosmetic note (§63-family): the save-result popup printed "DC Unknown — no success or failure"
  while the machine adjudication in log/lastAttack carried DC 22 + failure honestly — popup-chrome
  DC stamp cosmetic on this inline lane.

## Grep chain (code evidence)
1. `public/data/monsters.json` Smaug FP keys = `['conditions','description','name','save_dc','save_type']`
   — NO `save_effect`, NO `dc_success`, NO `success_immunity`, NO `repeat_save`.
2. `src/components/encounter/MonsterCardModal.jsx:754` — save-chip press:
   `handleSaveRoll(action, extractDamageDiceFromDescription(...), extractConditionsFromSaveEffect(action.save_effect))`
   (same extractor at :1334 and :2669; `MonsterAction.jsx:122` for row render).
3. `src/components/encounter/MonsterCardHelpers.js:383` `extractConditionsFromSaveEffect(saveEffect)`
   — `if (!saveEffect || typeof saveEffect !== 'string') return [];` — reads its STRING arg ONLY,
   zero description fallback (§1982/§346). `action.save_effect` undefined → `saveConditions = []`.
4. `src/hooks/combat/saveProcessing.js:1232` `applyDamagelessSaveConditions` —
   `const saveConditions = context?.saveConditions || []; if (saveConditions.length <= 0) return;`
   → early-return, `applyFailedSaveConditions` never called.
5. Plain `action.conditions` has NO save-lane consumer (MonsterCardModal `.conditions` reads at
   :574/:706 are eye-ray/save-VARIANT shapes only) — MA-1927/§346.
6. `src/hooks/combat/saveProcessing.js:825` `armRepeatSaveClause` — needs structured
   `context.repeatSave` (row key absent) → FP service/immunity ladder unarmed (§67/MA-0147).

## Steps to Reproduce
1. `:5173` → select `test-campaign` (board carried Smaug the Golden 1 idx0 513/513,
   Bandit 2 790/999, Bandit 1 552/999, round 2).
2. On Smaug's initiative card, arm `[data-testid="target-select"]` = Bandit 1 (raw WIS +0 @
   DC 22 = structural fail, nat cap 20 < 22, MA-369).
3. Open Smaug `.mc-overlay` (avatar click; assert overlay owner startsWith "Smaug"), press the
   FP row `DC 22 Wisdom` chip (`.mc-overlay .mc-dice-link-save:has-text("DC 22")`).
4. Popup: flush via inner `button.popup-close-btn` "Done" (MA-1932 — backdrop click inert).
5. GET `/api/campaigns/test-campaign/log` + `change-data`: victim `roll save` DC22 wisdom
   `saveResult:"failure"` present, but `Bandit 1.activeConditions == []`, `activeConditionMeta
   == {}`, zero `condition applied` entries, zero hp_change.

## Likely Location
**monsters.json DATA drift** (Smaug FP row missing `save_effect`). The engine lane is live and
honest (chip/arm/roll/DC/adjudication all correct); the extractor + early-return behave exactly as
designed on missing input. Not MonsterCardModal/saveProcessing/applyDamage defects.

## Notes
- **Fix is ONE FIELD**: add `save_effect:"Frightened"` to the Smaug FP row (byte-shape §526/
  MA-1932/MA-1982 canonical-word list; "frightened" is canonical §346). Damageless row — no
  `dc_success` needed (no damage; half-copy leak §63 moot, verified zero hp_change).
- Optional full-fidelity clause (repeat-save-at-turn-end + 24h immunity) needs the FP service
  shape: OBJECT `success_immunity:{effect:'frightful_presence_immunity',duration:'24_hours',
  duration_minutes:1440}` + `repeat_save:{condition:'frightened',save_type:'Wisdom',
  duration_minutes:1}` between save_type/save_effect (adult-blue-dracolich byte-slice, MA-1577;
  booleans kill it, MA-0147).
- **Cleanup**: NO admin-clear (MA-1998..MA-2002 legendary queue). Board LEFT INTACT, app RUNNING:
  Smaug the Golden 1 513/513 idx0, Bandit 2 790/999 idx1 init4, Bandit 1 552/999 idx2 init1,
  round 2, activeCreatureName AasimarTest (pre-stamp). No Frightened was applied → nothing to
  remove; `.mc-overlay` closed, popups flushed.
- **New pitfall**: FP/save-chip result popup shows "DC Unknown — no success or failure" chrome
  even when log/lastAttack adjudicate the authored DC honestly — judge DC enforcement by
  log `saveDc`/`saveResult` + `lastAttack`, not popup copy.

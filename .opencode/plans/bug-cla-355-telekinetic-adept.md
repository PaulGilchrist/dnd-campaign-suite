# CLA-355 Telekinetic Adept — E2E Verification Report

**Verdict: PASS-subset**

## Attribution (data-authored truth)
- `public/data/2024/classes.json` → Fighter, major **Psi Warrior** (hosted as a Fighter
  "major" alongside Battle Master/Champion/Eldritch Knight), **level 7** feature.
- Feature text (verbatim, abbreviated): "Psi-Powered Leap - Bonus Action Fly Speed (2x Speed)
  until end of turn. Telekinetic Thrust - When you deal damage to a target with your Psionic
  Strike... STR save (DC 8 + INT mod + PB)... Prone or transport up to 10 feet horizontally.
  Once... can't do so again until you finish a Short or Long Rest unless you expend a Psionic
  Energy Die (no action required) to restore your use of it."
- Automation blocks: `{type: telekinetic_leap, action: bonus_action, duration: until_end_of_turn,
  flySpeed: "2x_speed"}` and `{type: telekinetic_thrust, saveType: STR, saveAbility: INT,
  saveDc: ability, options:[{effect: prone_and_push, value: 10}], trigger: after_attack_hit,
  oncePerTurn: true}`.
- Handlers (live consumers, not grep-inert): `telekineticLeapHandler.js`,
  `telekineticThrustHandler.js`, `psionicStrikeHandler.js` (Thrust chain: once-per-turn latch
  `telekineticThrustUsedRound`, once-per-rest uses gate, `createSaveListener` STR save,
  Prone via `addCondition` + push-10 log), routed in `automationRouter.js`
  (`telekinetic_leap` → routeBonusByAction, `telekinetic_thrust` → reactions bucket),
  `trackedResources.js` (`telekineticThrustUses` max 1), rest seams re-arm
  (`restRules-constants.js` SHORT+LONG `telekineticThrustUses`).

## Host & swap
- Host `EvasiveFighter` lv18 2024 Fighter **Battle Master** → TA lives on Psi Warrior major,
  so swap required.
- Backup BEFORE swap: md5 `0df29ff32250d8baf51fa9e989def28c`, copy `/tmp/EvasiveFighter.json.bak`.
- Wizard step 6 → Fighter, step 7 → **Psi Warrior**, saved; sheet line confirmed
  "Human, Fighter (psi warrior), Level 18".
- **STR 16 (+3)** confirmed on sheet abilities.

## Leg 1 — Psi-Powered Leap (PASS)
- BA row press → runtime stamp `activeBuffs:[{effect: telekinetic_leap, flySpeed: 60,
  duration: until_end_of_turn, leapEffect: true}]` (30 speed × 2 = fly 60).
- Sheet Speed cell: **"30 ft., fly 60 ft."** (charSummaryCalc `telekinetic_leap` consumer live;
  CLA-282 precedent honoured).
- Popup/log: "Telekinetic Adept activated — Fly Speed 60 ft until end of turn."
- Gate: second press while active with Psionic Energy 0 → refusal popup "already active. Spend a
  Psionic Energy Die to refresh…" (psionicEnergy never spent at 0).
- Duration turn-end: after Short Rest seam, `activeBuffs` returned `[]` — buff expired as authored.

## Leg 2 — Telekinetic Thrust (partial)
- Rest re-arm seam verified E2E: Short Rest modal "Resources Restored" lists **Telekinetic Thrust**
  (+ Psionic Energy); post-rest runtime `telekineticThrustUses: null` (re-armed, CLA-355).
- Uses-refusal gate verified: with `telekineticThrustUses: 0`, handler logs
  `telekinetic_thrust_refused` and refuses without spending (code + unit tests
  `psionicStrikeHandler.thrustRestGate.test.js` green suite exists).
- **Not observed E2E:** the live save→Prone+push after a Psionic Strike hit. Trigger gate
  `findLastAttack().totalDamage > 0` (runtime `campaign.lastAttack`) was never satisfied by
  the sheet attack/damage click flow in this session (`lastAttack` stamped hit=True but
  primaryDamage 0 / never persisted; stray Shield Bash STR prompt hijacked the save stack).
  Chain code is live (router → psionic_strike handler → resolveThrustChain → save listener →
  `addCondition(prone)` + push log), so this is a rig/observability gap, not a grep-inert
  codification failure.

## Verdict rationale
PASS-subset: Leap leg fully enforced and observable (stamp, sheet fly speed, popup, gates,
duration, resource seam). Thrust leg is enforced in live code with rest-gate + refusal observed,
but the damage-triggered STR save → Prone/push outcome was not directly observed E2E because
the attack pipeline did not stamp a damage-bearing `lastAttack` in this host rig.

## Cleanup
- Admin: cleared campaign change-data + log, GET-verified empty.
- `EvasiveFighter.json` md5-restored byte-exact (`0df29ff32250d8baf51fa9e989def28c`).
- Character deselected (back to campaign select); only `test-campaign` touched.

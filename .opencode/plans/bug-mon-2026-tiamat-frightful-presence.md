# MA-2026 — Tiamat, Frightful Presence: failed DC 26 Wisdom save grants NO Frightened condition

## Overview
Tiamat's Frightful Presence (actions index 3, manifest MA-2026) adjudicates its DC 26 Wisdom
save correctly on the live save lane — chip arms, victim rolls, save fails honestly — but the
row's entire mechanical payload (Frightened) NEVER lands on the failed save. Exact MA-1997
(Smaug) twin: extractor input is `action.save_effect` ONLY; Tiamat's FP row authors only plain
`conditions:["frightened"]`, which has ZERO save-lane consumers (§346: the word "frightened" IS
canonical, it is simply never fed to the extractor). Condition-dead on a live, correctly-
adjudicated save = **FAIL(a) half-broken, one-field data fix** (MA-1982 family).

## Expected
Row (manifest, verbatim):
> "Wisdom Saving Throw: DC 26, each creature of her choice within 240 ft. of her and aware of
> her. A creature can repeat the saving throw at the end of each of its turns, ending the effect
> on itself on a success..." (saveDc: 26, saveType: Wisdom, saveEffect: "The target has the
> Frightened condition...")

On a failed save the victim must gain the **Frightened** condition: change-data
`Bandit 1.activeConditions` contains `"frightened"` + a `type:"condition"` "condition applied"
log entry + badge on victim card.

## Actual
- **Save adjudicates correctly**: chip census in Tiamat 1 `.mc-overlay` → FP row
  `span.mc-dice-link mc-dice-link-save mc-dice-link-save-clickable :: "DC 26 Wisdom"`.
  Press with Bandit 1 armed → log `roll save` `name:"Frightful Presence"` `saveType:"Wisdom"`
  `saveDc:26` `rolls:[14]` `total:14` `saveResult:"failure"` (Bandit raw WIS +0;
  `Tiamat 1.lastSaveRoll {d20:14, bonus:0}` — nat-cap 20 < 26 = deterministic fail face, no
  rig needed). `_lastRollContext {type:'save', saveDc:26, saveType:'Wisdom', actionName:
  'Frightful Presence'}`.
- **Frightened NEVER applies**: post-press log delta = exactly the two roll entries, ZERO
  `type:"condition"` entries; `Bandit 1.activeConditions == null`, `targetEffects == null`,
  `activeConditionMeta == null`; DOM shows 0 "Frightened" badges. FAIL(a)
  condition-not-applied-on-failed-save.
- **No damage honest**: zero `hp_change` in delta (row says "No damage").
- **Multi-target 240 ft**: shapeless (no range/shape field) → picker never opened, degrades to
  single armed target — BY DESIGN (§211), note-only.
- **Repeat-save + 24h immunity clause**: row authors NO `repeat_save`/`success_immunity`
  objects → advisory note-only (MA-1313/1851) — and MOOT since base grant fails (a).
- Cosmetic (§346-family pitfall carried from MA-1997): popup chrome printed "DC Unknown — no
  success or failure" while log/lastSaveRoll adjudicated DC 26 + failure honestly.

## Grep chain (code evidence — live question answered: NO flat-conditions consumer)
1. `public/data/monsters.json` Tiamat FP keys = `['conditions','description','name','save_dc',
   'save_type']` — **NO `save_effect`**, despite manifest summary claiming one. Flat
   `conditions:["frightened"]` exists but is inert on this lane.
2. `src/components/encounter/MonsterCardModal.jsx:754` — save-chip press:
   `handleSaveRoll(action, extractDamageDiceFromDescription(...), extractConditionsFromSaveEffect(action.save_effect))`
   (same extractor at :632/:1334/:2669). `action.save_effect` undefined → `saveConditions = []`.
3. `src/components/encounter/MonsterCardHelpers.js:383` `extractConditionsFromSaveEffect` —
   `if (!saveEffect || typeof saveEffect !== 'string') return [];` — string arg ONLY, zero
   description fallback.
4. `src/hooks/combat/saveProcessing.js:1232-1235` `applyDamagelessSaveConditions` —
   `const saveConditions = context?.saveConditions || []; if (saveConditions.length <= 0) return;`
   → early-return; `applyFailedSaveConditions` never called.
5. **Flat `action.conditions` save-lane consumer audit: ZERO.** All `.conditions` reads on the
   modal save lanes are other shapes — `:574` eye-ray (`ray.conditions`), `:706` save-variant
   chooser (`variant.conditions`); in saveProcessing.js only `variant.conditions` (:561) and
   stored activeConditions (:1142). Tiamat FP is neither shape (MA-1927/§346).

## Steps to Reproduce
1. `:5173` → `test-campaign` (board: Tiamat 1 idx0 615/615 AC25, Bandit 1 788/999 AC12,
   round 1, active Tiamat 1).
2. Arm `[data-testid="target-select"]` on Tiamat's initiative card = Bandit 1 (raw WIS +0 @
   DC 26 = deterministic fail, MA-369 face).
3. Open Tiamat `.mc-overlay`, press FP row `DC 26 Wisdom` chip
   (`.mc-overlay .mc-action:has(strong:text-matches("^Frightful")) .mc-dice-link-save-clickable`).
4. Flush popup via inner `button.popup-close-btn` "Done".
5. GET log + change-data: victim `roll save` DC26 wisdom `saveResult:"failure"` present;
   `Bandit 1.activeConditions == null`, zero `condition applied`, zero hp_change.

## Likely Location
**monsters.json DATA drift** (Tiamat FP row missing `save_effect`). Engine lane live and honest
(chip/arm/roll/DC/adjudication all correct); extractor + saveProcessing early-return behave
exactly as designed on missing input. Not a MonsterCardModal.jsx / saveProcessing.js defect.

## Notes
- **Fix is ONE FIELD** (MA-1982 recipe): add `save_effect: "The target has the Frightened
  condition."` to Tiamat's FP row ("frightened" canonical §346 word-list). Damageless row — no
  `dc_success` needed.
- Optional full-fidelity: `success_immunity:{effect:'frightful_presence_immunity',
  duration:'24_hours', duration_minutes:1440}` + `repeat_save:{condition:'frightened',
  save_type:'Wisdom', duration_minutes:1}` (object shape, MA-1577/MA-0147 — booleans kill it).
- **Cleanup**: NO admin-clear (legendary block MA-2027..MA-2037 queued). No Frightened was
  applied → nothing to remove; 0 frightened badges confirmed in DOM. `.mc-overlay` closed,
  popups flushed. Board LEFT INTACT, app RUNNING: round 1, activeCreatureName Tiamat 1,
  Tiamat 1 615/615 AC25 init2 (cd has lastAttackRoll Tail + stale pendingCombatSuperiorityPrompt
  from prior row's Tail — pre-existing, untouched), Bandit 1 788/999 AC12 init7, no
  monsterLegendaryUses key = legendary fresh.

# MA-0868 — Gladiator "Shield Bash": Successful Strength Save Still Pays Half Damage (dc_success:"none" DATA fix)

## Overview
Live E2E verification of MA-0868 (Gladiator, actions[2], "Shield Bash", actionType `save`) on `test-campaign` via Playwright. The authored row carries NO "On a Success: half damage" clause — success is supposed to mean NOTHING. The live app nonetheless pays half damage on a successful save: the MV-20 `dc_success ?? 'half'` default in `MonsterCardModal.jsx` rides this row because `monsters.json` omits `dc_success:"none"`. Half-leak previously observed only as a byproduct on MA-0866 (Multiattack ride); CONFIRMED DIRECTLY ON THIS ROW here (3/3 success legs). Fail leg is exact. Verdict: **FAIL (b) — rule gate skipped on save success**.

## Expected (quoted description + numbers)
> "Strength Saving Throw: DC 15, one creature within 5 feet that the gladiator can see. Failure: 9 (2d4 + 4) Bludgeoning damage. If the target is a Medium or smaller creature, it has the Prone condition."

- Fail: FULL `2d4 + 4` Bludgeoning (range 6–12, avg 9 ✓) + Prone on Medium-or-smaller.
- Success: **ZERO damage** (no success clause at all — not even half) and no Prone.
- Static disk check (`public/data/monsters.json` gladiator actions[2]): `save_dc:15` ✓, `save_type:"Strength"` ✓, `damage_dice_primary:"2d4 + 4"` ✓, `damage_type_primary:"Bludgeoning"` ✓, `save_effect` carries canonical "Prone" word ✓, `range:"5 feet"` — **`dc_success` ABSENT** (this is the defect).

## Actual
**FAIL leg — EXACT ✓** (Bandit 1, Str save +0):
- nat d20 7 + 0 = 7 ✗ DC 15 (`saveDc:15`, `saveType:"Strength"` enforced, `saveResult:"failure"`)
- save-damage: formula "2d4 + 4", rolls [2,2], raw 8 → `finalDamage:8` **FULL**, Bludgeoning
- hp_change Δ −8 (999 → 991) exact
- `condition applied`: Bandit 1 Prone, `sourceName:"Gladiator 1"`, `sourceAbility:"Shield Bash"` ✓; change-data `activeConditions:["prone"]`, `activeConditionMeta.prone.source:"Gladiator 1"` ✓

**SUCCESS legs — HALF-LEAK ✗ (3/3, both chips):**
1. DC chip (§212 rig `saving_throws:{str:{modifier:19}}` full-store cs POST): nat 5 + 19 = 24 ≥ DC 15 → `saveResult:"success"` BUT save-damage rolls [4,4] raw 12 → `finalDamage:6` = floor(12/2), hp_change Δ −6 (991 → 985), `dcSuccess:"half"` stamped on victim roll-save entry; `lastAttack.rawDamage:6 / damageApplied:true`.
2. Damage chip ("2d4 + 4"): nat 9 + 19 = 28 ✓ SUCCESS → rolls [3,3] raw 10 → `finalDamage:5` = floor(10/2), Δ −5 (985 → 980), `saveSuccess:true`.
3. Damage chip un-stamped natural: nat 17 raw ✓ SUCCESS (17 ≥ 15) → rolls [2,2] raw 8 → `finalDamage:4` = floor(8/2), Δ −4 (980 → 976), `saveSuccess:true`.

Conditions stayed clean on all success legs (no NEW Prone — condition clause correctly fail-only); the leak is damage-only. Console 0 errors entire session.

## Steps to Reproduce
1. `npm run dev`, open http://localhost:5173, select `test-campaign` (verify header).
2. Encounters (EB): filter "Gladiator" → checkbox → Join Encounter; filter "Bandit" → exact-td row → Join.
3. Full-store cs POST: set both NPCs `maxHp/currentHp = 999` (`POST /api/campaigns/test-campaign/combatSummary {value:cs}`).
4. Arm Bandit 1 on Gladiator's own initiative-card `[data-testid="target-select"]`.
5. Open Gladiator card (avatar) → Shield Bash row renders TWO chips: "2d4 + 4" + "DC 15 Strength" (`mc-dice-link-save-clickable`).
6. Fail leg: click DC chip until save < 15 (Bandit Str +0 → nat ≤14 fails) → FULL damage + Prone ✓.
7. Success leg: cs POST stamp Bandit `saving_throws:{str:{modifier:19}}` (§212 nested-abbrev) → click DC chip → popup prints "✓ SAVE SUCCESS (N vs DC 15)" yet "N/2 damage applied — HP drops"; log `save-damage finalDamage=floor(raw/2), saveSuccess:true`. **BUG.**

## Likely Location
- `public/data/monsters.json` → gladiator actions[2] "Shield Bash" **missing `dc_success:"none"`** (one-field DATA fix; place after `save_type`, MA-0481/0622/0768/0781/0798 family byte-shape).
- Default seam (why it leaks): `src/components/encounter/MonsterCardModal.jsx`
  - `:214` `getSaveDcSuccess`: `action.save_dc != null ? (action.dc_success ?? 'half') : null`
  - `:933` `buildSaveOptions`: `dcSuccess: action?.save_dc != null ? (action?.dc_success ?? 'half') : null`
  - `:1886` `handleDamage`: `context.dcSuccess = action?.dc_success ?? 'half'` (the damage-only chip rides the same save adjudication — hence BOTH chips leak identically).

## Notes
- **MA-0866 corroboration:** same half-leak observed riding the Multiattack→Shield Bash component leg (success total 30, finalDamage 6 = floor(12/2)); this ticket confirms it directly on the standalone row — both chips, three legs, one root cause. Multiattack header itself rides clean (§66).
- **Damage-chip adjudication (§117 two-chip fork):** the "2d4 + 4" chip is NOT a save-bypassing free-damage affordance — it stamps `saveDc/saveType/dcSuccess` into its roll context (:1883-1887) and prints the SAVE SUCCESS/FAILURE verdict itself. Documented shape; its only defect is the shared `dc_success` half default. No separate extra-affordance FAIL(a).
- **Range "5 feet":** gridless board → lenient by design (§42), consulted-and-passes; not a defect.
- Cosmetic: popup prints "(d20 N + 0)" base-mod text while stamped total is honest (`lastAttack.total` is truth — MA-0866/0867 pitfall re-confirmed); `lastAttack.isSpellDamage:true` cosmetic on non-spell save row (§128).
- Fix inverts no known stale test pins, but grep `dc_success` test pins touching gladiator/Shield Bash before landing (MA-0216/0642/0724 stale-pin inversion pattern).
- After data fix: full refresh sequence §21/§277 — `fetch(cache:'reload')` → reload → re-select campaign → EB re-join (EB keeps stale in-memory monsters.json).

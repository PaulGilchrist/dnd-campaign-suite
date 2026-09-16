# Bug MA-0252 — Ancient Silver Dragon "Cold Gale" (legendary_actions[2]): push clause never applied + ungated legendary refire

## Overview
Cold Gale resolves its DC/damage/half-save legs EXACTLY (DC 23 Dexterity enforced per
target; failed save = full 4d6 Cold; success = exact floor-half), but the rule's defining
failed-save PUSH is never applied (no `push` te, no push log, no position/condition — zero,
live) and the once-per-turn legendary gate is dead so the dragon refires unlimited times per
window with no refusal. Two rule-gate breaches ⇒ FAIL.

## Expected (canonical row prose, monsters.json legendary_actions[2])
> "Dexterity Saving Throw: DC 23, each creature in a 60-foot-long, 10-foot-wide **Line**.
> **Failure:** 14 (4d6) Cold damage, **and the target is pushed up to 30 feet straight away
> from the dragon**. **Success:** Half damage only. **Failure or Success:** The dragon can't
> take this action again until the start of its next turn."

So: fail → 4d6 Cold **+ push up to 30 ft**; success → half damage, **no push**; once per turn.

## Actual (live, test-campaign, dragon cs idx0 init 15, victims HW/EP)
- **DC + save type PASS**: picker & prompt force DEX DC 23 per target; change-data
  `saveResult-<T>` machine truth recorded.
- **Full-damage-on-fail PASS (ts-paired)**:
  - Volley1 EP fail roll4 total12 → 4d6 [1,4,4,5]=17 → hp_change −17 (192→175).
  - Volley1 HW fail roll9 total8 → 4d6 [4,2,4,3]=10 → hp_change −10 (96→86).
  - Volley2 HW fail roll19 total18 → 4d6 [4,1,6,4]=19 → hp_change −19 (86→67).
- **Half-on-success PASS (exact floor)**: Volley2 EP SUCCESS roll18 total26 → 4d6
  [1,4,6,2]=12 → finalDamage 6 → hp_change −6 (175→169). `dcSuccess:'half'` correct here
  (row intends half) — MA-0229 default-leak NOT implicated.
- **PUSH FAIL**: zero `push` te, zero push/condition log, zero position effect on every
  FAILED save (EP 17, HW 10, HW 19) — push never applied, live and grep-confirmed.
- **Once-per-turn gate FAIL (UNGATED refire)**: two `ability_use "Cold Gale: Selecting 2
  target(s) for save (DC 23 Dexterity)"` logs (ts 1789529327480 + 1789529467915) fired the
  full save volley twice in the SAME window (round unchanged, dragon still init 15, no turn
  advance) — zero refusal, zero spend. `monsterLegendaryUses` key NEVER created (still null).

## Steps to reproduce
1. test-campaign → Initiative; dragon "Ancient Silver Dragon 1" cs idx0 init 15; clear any
   lingering Paralyzed/Incapacitated te from victims (auto-fail contaminates DEX leg).
2. Open dragon card → Cold Gale "DC 23 Dexterity" chip → line picker → tick HexWarlock
   (+0/−1 DEX, forced fail) + ElderPaladin (+5 aura, success-prone) → Cold Gale (2).
3. Roll each save → Done. Fail = full 4d6, success = floor-half. **No push observed.**
4. Re-open card → Cold Gale again immediately (no turn advance) → picker still fires the full
   save volley again. **No once-per-turn refusal.**

## Likely location — DATA vs resolution
- **DATA (root, MA-0250 prose-only family)**: ancient `legendary_actions[2].save_effect` =
  `"Failure: 14 (4d6) Cold damage. Success: Half damage."` — the **"pushed up to 30 feet
  straight away" clause is ABSENT** from the machine field (it exists only in `description`).
  `parsePushFeetClause` (MonsterCardHelpers.js:116, `/push(?:ed)? up to (\d+) feet/i`) matches
  nothing → `pushFeet:null` (MonsterCardModal.jsx:150/231) → MA-0138 fail-only push marker te
  (SaveAttackAoeModal.jsx:502-534 `registerTargetEffect(...,'push',...value:feet)`) never
  fires. Resolution machinery is byte-inert ONLY because the clause is missing.
  Fix: add `", and the target is pushed up to 30 feet straight away from the dragon"` to the
  ancient row's `save_effect` (adult-silver Cold Gale MA-0138 adult-fix template carries
  exactly this clause: `"…4d6 Cold damage, and the target is pushed up to 30 feet straight away
  from the dragon. Success: Half damage only"` → adult pushFeet=30 → push te live).
- **DATA (once-per-turn, MA-0217/0250 header family)**: `legendary_actions[0]` header
  `"Legendary Action Uses: 3 (4 in Lair)"` is prose-only, no numeric `uses:3` →
  `legendaryHeaderAction()` null (monsterLegendaryUses.js:153) → ungated branch
  (MonsterCardBody.jsx) → children refire N×/window, `monsterLegendaryUses` never created,
  regainLegendaryUses (turnStartEffects.js:176) no-op. Fix template = adult-silver MA-0136
  header `uses:3` on disk. Same root already filed MA-0250.
- **RESOLUTION: not implicated** — DC enforcement, full vs exact floor-half applyDamage
  (`dcSuccess:'half'`), ts-paired roll→hp_change logs, and the push/te consumer stack
  (te `push` registered targetEffectDefinitions.js:899, MA-0138 grant) are all live and
  byte-ready; they simply never receive a non-null `pushFeet` because the DATA clause is absent.

## Notes
- Root cause lineage: MA-0250 (legendary header dead) + the prose-only clause family
  (MA-0090/MA-0184/MA-0217/MA-0227/MA-0229). Push resolution machinery = MA-0079/MA-0138
  (adult-silver Cold Gale), which this row is expected to reuse verbatim.
- dc_success default: `dcSuccess:'half'` (MonsterCardModal.jsx:133) is CORRECT for this
  damage-intending row — do NOT set `dc_success:'none'` (contrast MA-0229 no-damage rows).
- Adult-fix template on disk to port: adult-silver `Cold Gale.save_effect` (push clause) +
  adult header `uses:3` + children numeric gates (MA-0136/MA-0138 templates).
- Recipes/pitfalls: card `.mc-overlay` persists after Skip — close × before touching initiative
  badges (intercepts pointer). Results popup `.sp-overlay` blocks avatar re-click — Close it.
  Clear Paralyzed/Incapacitated te from a DEX-save victim or it auto-fails. Ungated refire lets
  you farm a success leg (EP +5 aura succeeds DC23 on nat 18+) after forced-fail victims prove
  the full-damage leg. "Remove effect" is shared across badges — scope card via aria-label.
- Registry delta: none written (orchestrator owns manifest/registry).

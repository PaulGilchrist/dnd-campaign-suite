# BUG MA-0286 — Animated Object (Medium) / Slam: spell-attack row inert — no to-hit, no affordance (post-suppression state)

## Overview
MA-0286 (Medium Animated Object, Slam, actionIndex 0, actionType attack) was the trigger row for the
MA-0286 CODE fix: `attackRowMissingToHit` (`MonsterCardHelpers.js:271`) suppresses the damage chip on
attack-wording rows with `attack_bonus: null`, curing the auto-hit defect (a clickable "1d4+3" chip that
rolled damage with no to-hit roll / AC check). This run verifies the POST-FIX state: the auto-hit abuse is
gone, but the row is now completely inert — the described "+spell attack modifier" mechanic never resolves.
Zero affordances, zero rolls, zero damage, zero log delta. Honest suppression is the correct *cure* for the
defect, but the *cure* leaves the row's core (spell attack with folded caster modifiers) unimplemented.
Same fingerprint as twins MA-0284 (Huge) / MA-0285 (Large); Medium differs only in that its dice
(`1d4+3`) IS parseable (`canRollExpression` true) — yet the chip is still suppressed, so parseability is
moot in the UI.

## Expected
Row: "Slam. Melee Spell Attack: +spell attack modifier, reach 5 ft. Hit: 1d4+3 Force damage."
Per 5e, the animating caster's spell attack modifier is the to-hit and folds into the 1d4+3 damage.
A live row would offer a to-hit affordance (numeric attack chip or caster-mod-resolved chip), roll d20+mod
against target AC, and log attack/roll + hp_change on hit — the fold the app already implements on the
SUMMON path (`summonSpiritHandler.resolveMonsterActions` substitutes `spellAttackMod`/`spellcastingModifier`
and backfills `attack_bonus`). An EB-direct join has no caster context, so the bonus is unresolvable and the
row offers nothing.

## Actual
- Data (`public/data/monsters.json` animated-object-medium actions[0]): `attack_bonus: null`,
  `damage_dice_primary: "1d4+3"` (parseable), `damage_type_primary: "force"`, description contains
  "Melee Spell Attack" → `attackRowMissingToHit` true.
- Live DOM (test-campaign, joined "Animated Object (Medium) 1", armed target AasimarTest):
  Slam `.mc-action` `.mc-dice-link` count = 0, zero `button`/`[role="button"]`/clickable children.
  Attack chip never renders (`MonsterAction.jsx:187` requires `attack_bonus != null`); damage chip
  suppressed (`MonsterAction.jsx:41` `attackRowMissingToHit` gate); no save_dc, not a Spellcasting row,
  no action-level advisory seam (advisory exists only on legendary/lair seams).
- Forced `el.click()` on the Slam row: zero popup, zero roll, log unchanged (2 → 2 rows: encounter-joined +
  initiative roll), AasimarTest `currentHp` unchanged, no `lastAttack`/pending keys produced.
- Verdict: INERT FAIL flavor (b) — the row's central "+spell attack modifier" attack number is inert; no
  path exists that rolls a to-hit or applies the described damage. (No auto-hit remains — the MA-0286 fix
  is verified working as designed.)

## Steps to Reproduce
1. localhost:5173 → test-campaign (verify header reads test-campaign).
2. Encounters (EB) → search "Animated Object (Medium)" → select exact row → Join Encounter.
3. Verify combatSummary via curl: creature "Animated Object (Medium) 1", monsterIndex animated-object-medium.
4. Arm target: AO card Target dropdown → AasimarTest.
5. Open the AO card; inspect Slam `.mc-action`: `querySelectorAll('.mc-dice-link')` → 0;
   `querySelectorAll('button,[role="button"],a,[onclick]')` → 0.
6. Forced `el.click()` on the Slam row → no popup, no roll; `/api/campaigns/test-campaign/log` count
   unchanged; target HP unchanged.

## Likely Location
- Data: `public/data/monsters.json` `animated-object-medium.actions[0]` — `attack_bonus: null` with a
  caster-dependent "+spell attack modifier" that has no EB-join-time numeric/derivable value.
- Code gate: `src/components/encounter/MonsterCardHelpers.js:271` `attackRowMissingToHit` +
  `src/components/encounter/MonsterAction.jsx:41` (`ActionDamageLinks` suppression) and `:187`
  (`actionHasAttack` requires numeric `attack_bonus`) — together render the row as plain text.
- Missing subsystem: no caster-context resolution for EB-direct joins. The caster-mod fold exists only on
  spell-cast summon paths (`summonSpiritHandler.js`, `primalCompanionHandler.js`); no seam lets a GM supply
  a caster modifier at EB join, and no action-level advisory chip exists for regular action rows (MV-6/MV-3
  precedent).

## Notes
- The MA-0286 auto-hit cure was CORRECT: pre-fix, the parseable "1d4+3" damage chip let the row deal damage
  with no to-hit roll (auto-hit abuse). Post-fix suppression is the right honest floor.
- The mechanic is still inert pending a caster-context subsystem (GM-supplied spell attack mod at join, or
  routing EB joins through the summon-path fold). Pending that, the row fails the strict bar (the described
  "+spell attack modifier" resolves nowhere).
- Twins: MA-0284 (Huge) / MA-0285 (Large) — same fingerprint, plus unparseable dice
  ("2d12+3+spellcasting modifier" / Large equivalent fails `canRollExpression`); Medium is the parseable-dice
  variant, isolated and confirmed here. Suppression collateral scan: exactly 2 rows app-wide
  (animated-object-medium/Slam, drow-mage/Staff prose "+ 2 to hit"); damage-only rows keep chips.
- Sanitizer quirk flag (inherited from MA-0284 note): negative caster mod folds to "…+3+-1" (unrollable) in
  `summonSpiritHandler` — relevant if the fold is ever reused for EB-direct joins.

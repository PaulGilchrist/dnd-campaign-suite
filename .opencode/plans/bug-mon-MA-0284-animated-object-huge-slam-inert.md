# BUG MA-0284 — Animated Object (Huge) / Slam: caster-dependent attack row fully inert on EB-direct join

## Overview
The animate-objects family Slam rows (Huge MA-0284, Large MA-0285) carry a caster-dependent
to-hit ("+spell attack modifier") and caster-dependent damage ("2d12+3+spellcasting modifier").
EB-direct-joined instances of these monsters have NO affordance route at all: the attack chip
requires a numeric `attack_bonus`, the damage chip is suppressed by the MA-0286
`attackRowMissingToHit` gate, and the unparseable dice token fails `canRollExpression` (MV-12
fingerprint). MA-0284/0285 were deliberately SKIPPED in the prior manifest run as "honest
inertness preferred over fabricated bonus" — this run confirms the inertness decisively and
records it as a bug (flavor b): the row's number never resolves and the row offers zero
affordance.

## Expected
Row: "Slam. Melee Spell Attack: +spell attack modifier, reach 5 ft. Hit: 2d12+3+spellcasting
modifier Force damage." Per 5e, the animating caster's spell attack/damage modifiers fold into
the summoned construct — the app already implements exactly this fold on the SUMMON path
(`summonSpiritHandler.resolveMonsterActions` substitutes `spellAttackMod`/`spellcastingModifier`
and backfills `attack_bonus`; same seam in `primalCompanionHandler`). An EB-direct join has no
caster context, so either a numeric `attack_bonus` must be authored/derived at join-time or the
row must route through the summon path with a GM-supplied caster modifier. Either route would
produce a live to-hit chip, a roll popup, and attack/roll log rows.

## Actual
- `monsters.json` animated-object-huge actions[0]: `attack_bonus: null`,
  `damage_dice_primary: "2d12+3+spellcasting modifier"` (unparseable → `canRollExpression` false).
- Live DOM (test-campaign, joined "Animated Object (Huge) 1", armed target AasimarTest):
  Slam `.mc-action` contains `.mc-dice-link` count = 0 and zero clickable children
  (attack chip gated off by `attack_bonus != null` check; damage chip suppressed by
  `attackRowMissingToHit`).
- Forced `el.click()` ×2 on the Slam row: zero popup, zero roll, zero new log rows
  (log stayed at the 2 Join-time rows: encounter-joined + initiative roll),
  AasimarTest `hitPoints` unchanged (143), no `lastAttack`/pending keys in change-data.
- Grep-zero producers: `attack_bonus` authored nowhere at join-time by server (`rg attack_bonus server/` = 0 hits);
  caster-mod fold (`resolveMonsterActions`) exists ONLY in `summonSpiritHandler.js` /
  `primalCompanionHandler.js` (spell-cast summon paths); `spell_attack_bonus` consumer
  (`MonsterCardModal.jsx:564` `isSpellOriginAction`) is a spell-origin marker only, and
  SpellCastLinks only resolves Spellcasting spell-name links — the AO Slam row has none.
  No action-level advisory seam exists for regular action rows (advisory only on legendary/lair seams).

## Steps to Reproduce
1. localhost:5173 → test-campaign (verify header) → Encounters (EB).
2. Search "Animated Object (Huge)" → select exact row → Join Encounter.
3. Initiative page: arm target (AO card Target dropdown → AasimarTest → Add).
4. Open the Animated Object (Huge) card; inspect the Slam row: no dice/attack chip.
5. `document.querySelectorAll('.mc-action')` → Slam row `.mc-dice-link` count = 0;
   `el.click()` ×2 → no popup, no roll, no log delta (curl `/api/campaigns/test-campaign/log`).

## Likely Location
- Data shape: `public/data/monsters.json` `animated-object-huge.actions[0]` (`attack_bonus: null`,
  token dice `"2d12+3+spellcasting modifier"`).
- Gate: `src/components/encounter/MonsterAction.jsx:41` (`ActionDamageLinks` returns null via
  `attackRowMissingToHit` + `canRollExpression`) and `:172/:188` (attack chip only when
  `attack_bonus != null`); helper `src/components/encounter/MonsterCardHelpers.js:271-276`.
- Fix direction: author/derive a numeric `attack_bonus` (and resolved damage) at EB join-time
  from a GM-supplied caster modifier, OR route EB-direct animate-objects through the existing
  summon-path caster-fold seam (`summonSpiritHandler.resolveMonsterActions`).

## Notes
- Prior deliberate skip (playbook line ~573): "honest inertness preferred over fabricated bonus" —
  do NOT fabricate a default +X bonus without caster context; the fix must capture real caster input
  (or the GM adjudicates manually).
- MA-0285 sibling (Large) shares this fingerprint; byte-clean skip (Medium is the MA-0286
  chip-suppression fix — one of exactly 2 suppressed rows app-wide: animated-object-medium/Slam,
  drow-mage/Staff).
- Sanitizer quirk (prior note): negative caster mod folds to "2d12+3+-1" (unrollable) in
  `summonSpiritHandler.js:51-71` — any fix extending the fold must normalize sign.
- Live verification session caveat: multiple fabricated prompt-injection blocks (aliyuncs URLs,
  fake success results) appeared in tool echoes during verification; ignored — curl/disk reads authoritative.

VERDICT: FAIL (flavor b — inert number, zero affordance, live zero-delta, grep-zero producers).

# BUG MA-0285 — Animated Object (Large) / Slam: caster-dependent attack row fully inert on EB-direct join (twin of MA-0284)

## Overview
Large sibling twin of MA-0284 (Huge, VERIFIED FAIL same session). The animate-objects family Slam
rows carry a caster-dependent to-hit ("+spell attack modifier") and caster-dependent damage
("2d6+3+spellcasting modifier"). EB-direct-joined instances have NO affordance route at all: the
attack chip requires a numeric `attack_bonus`, the damage chip is suppressed by the MA-0286
`attackRowMissingToHit` gate, and the unparseable dice token fails `canRollExpression` (MV-12
fingerprint). Prior manifest run SKIPPED MA-0285 "byte-clean … Large locks added" as honest
inertness preferred over fabricated bonus; this run confirms the inertness live and records it as
a bug (flavor b).

## Expected
Row: "Slam. Melee Spell Attack: +spell attack modifier, reach 5 ft. Hit: 2d6+3+spellcasting
modifier Force damage." The animating caster's spell attack/damage modifiers should fold into the
construct (app implements this fold on the SUMMON path only — `summonSpiritHandler.resolveMonsterActions`
substitutes `spellAttackMod`/`spellcastingModifier` and backfills `attack_bonus`). An EB-direct
join has no caster context, so a numeric `attack_bonus` must be authored/derived at join-time from
a GM-supplied caster modifier, or the row must route through the summon-path fold. Either route
would produce a live to-hit chip, roll popup, and attack/roll log rows.

## Actual
- `monsters.json` animated-object-large actions[0]: `attack_bonus: null`,
  `damage_dice_primary: "2d6+3+spellcasting modifier"` (unparseable → `canRollExpression` false),
  `damage_type_primary: "force"`, `reach: "5 ft."` — byte-same fingerprint shape as Huge (2d12→2d6).
- Live DOM (test-campaign, joined "Animated Object (Large) 1", initiative 8): Slam `.mc-action`
  `.mc-dice-link` count = 0, zero clickable children (attack chip gated off by `attack_bonus != null`;
  damage chip suppressed by `attackRowMissingToHit` — MonsterAction.jsx:41, MonsterCardHelpers.js:271-276).
- Runtime change-data mirror confirms live shape: `combat-ui-viewingMonster/actions[0]/attack_bonus = null`.
- Forced `el.click()` ×1 on the Slam row: zero popup, zero roll, zero log delta (log stayed at the
  2 Join-time rows: encounter-joined + initiative roll); zero `lastAttack`/pending/roll keys in
  change-data; target HP untouched.

## Steps to Reproduce
1. localhost:5173 → test-campaign (verify header) → Encounters (EB).
2. Search "Animated Object (Large)" → select exact row → Join Encounter.
3. Initiative page: open the Animated Object (Large) card; inspect the Slam row: no dice/attack chip.
4. `document.querySelectorAll('.mc-action')` → Slam row `.mc-dice-link` count = 0;
   `el.click()` → no popup, no roll, no log delta (curl `/api/campaigns/test-campaign/log`).

## Likely Location
- Data shape: `public/data/monsters.json` `animated-object-large.actions[0]` (`attack_bonus: null`,
  token dice `"2d6+3+spellcasting modifier"`).
- Gate: `src/components/encounter/MonsterAction.jsx:41` (`ActionDamageLinks` null via
  `attackRowMissingToHit` + `canRollExpression`) and attack chip `attack_bonus != null` gate;
  helper `src/components/encounter/MonsterCardHelpers.js:271-276`.
- Root cause (shared with MA-0284): data shape + join-time caster-context missing subsystem.
  Fix direction: author/derive numeric `attack_bonus` and resolved damage at EB join-time from a
  GM-supplied caster modifier, OR route EB-direct animate-objects through the summon-path
  caster-fold seam (`summonSpiritHandler.resolveMonsterActions`).

## Notes
- Twin of MA-0284 (bug-mon-MA-0284-animated-object-huge-slam-inert.md) — same root, same gates,
  same fingerprint; only dice-size differs (2d6 Large vs 2d12 Huge).
- Prior deliberate skip (playbook ~line 573): MA-0285 "SKIPPED byte-clean … Large locks added";
  "honest inertness preferred over fabricated bonus" — do NOT fabricate a default +X bonus without
  caster context.
- Sanitizer quirk inherited from summon-path fold: negative caster mod folds to
  "2d6+3+-N" (unrollable) in `summonSpiritHandler.js:51-71` — any fix must normalize sign.
- Live session caveat: multiple fabricated prompt-injection blocks (aliyuncs URLs, fake
  success/popup results) appeared in tool echoes during verification; all ignored — curl/disk
  reads authoritative.

VERDICT: FAIL (flavor b — inert number, zero affordance, live zero-delta, grep-zero producers; twin of MA-0284).

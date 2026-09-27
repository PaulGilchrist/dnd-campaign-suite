# BUG MA-1344 — Primal Companion (Beast of the Sea) "Beast's Strike": on-hit Grappled + escape DC never applied (FAIL(b)/DATA)

**Row:** public/data/monsters.json `primal-companion-beast-of-the-sea` actions[0]
**stableKey:** primal-companion-beast-of-the-sea|actions|0
**Verdict:** FAIL(b)/DATA (grapple rider inert by authoring; core to-hit/damage fold LIVE)

## Expected (row description, verbatim)
"Melee Spell Attack: +spell attack modifier, reach 5 ft. Hit: 1d6+2+WIS modifier Bludgeoning or Piercing damage (your choice), and the target has the Grappled condition (escape DC = 8 + Proficiency Bonus + WIS modifier)."

## Actual
- To-hit/damage fold work: chip "+9" (=PB+6 + WIS+3), folded formula "1d6+2+3" — LIVE via feature fold.
- Grapple NEVER applies: no `condition applied` entry, no `grapple` string anywhere in the whole campaign log after 2 hits, victim change-data `Bandit` store KEY absent for activeConditions/activeConditionMeta, top-level targetEffects holds only `summoned` (companion self, from spawn).
- Escape DC never authored/computed anywhere: description tail folds only to cosmetic "escape DC = 8 + Proficiency Bonus + 3"; no numeric `escape_dc` field; lastAttack carries no escape stamp.

## Root cause (grep evidence)
1. Disk row authors NO `hit_conditions`, NO `escape_dc`, and NO `conditions` key at all (manifest's `conditions:["grappled"]` is not disk-true).
2. Attack-hit condition transport = `buildHitConditionClause` (src/components/encounter/MonsterCardHelpers.js:673-681) which reads `action.hit_conditions` ONLY (`escapeDc: action.escape_dc != null ? Number(action.escape_dc) : null`), consumed in src/hooks/combat/handlers/handlePlainDamage.js:537-538 (MA-0010 seam). Plain prose / manifest conditions have zero attack-path consumers (§449/§59 codified).
3. Feature fold `resolveMonsterActions` (src/services/automation/handlers/class-ranger/primalCompanionHandler.js:85-101) folds tokens ("WIS modifier"→wis, "spell attack modifier"→"+N", attack_bonus null→spellAttackMod; Bestial Fury→damage_type 'Force') but authors no hit_conditions/escape_dc. grep `escape|grapple` in primalCompanionHandler.js = ZERO production hits.
4. Class data 2024/classes.json Beast of the Sea attacks[0] carries `onHit:"grappled"` metadata, but `onHit` has ZERO production consumers app-wide (grep: only DiceRollResult.jsx:951 `onHitChoice`, unrelated prop).
5. No grapple te registered (src/services/combat/conditions/targetEffectDefinitions.js:1199 comment: grapple state machine unbuilt, §69) — grapple rides the canonical condition channel via hit_conditions, which is the expressible vocabulary.

## Live evidence (2026-09-26, test-campaign, localhost:5173, :5173 dev)
Setup: FeyRanger lv17 subclass PUT Hunter→Beast Master + reload; PC-card "Primal Companion:" chooser → "Beast of the Sea"; cs combatant folded ac:16, hp 90, actions[0] attack_bonus 9, damage_dice_primary "1d6+2+3", damage_type_primary "Force" (Bestial Fury fold §749), description tail "(escape DC = 8 + Proficiency Bonus + 3)" partial-fold cosmetic. Victim Bandit AC12 TRUSTED-fill currentHp 999; target armed on companion initiative card (`targetName:"Bandit"` cs-truth).
Ledger (4 presses, press-to-log 1:1, zero absorb):
- nat1+9=10 ✗AC12 (popup "✗ MISS (10 vs AC 12)"), nat2+9=11 ✗AC12 — zero damage entries.
- nat6+9=15 ✓ → roll damage formula "1d6+2+3" rolls[4] finalDamage 9 Force, hp_change 999→990 exact.
- nat5+9=14 ✓ → formula "1d6+2+3" rolls[5] finalDamage 10, hp_change 990→980 exact (ΣΔ19=9+10).
- After hits: whole-log `grapple` grep FALSE, `condition` entries [], Bandit cd KEY ABSENT, lastAttack {hit:true, damageFormula:"1d6+2+3", actualDamage:9} escape-free.
- Crit: not rolled in 4 presses (nat20 1/20; crit seam app-documented §32, unchased).

## Fix (DATA, one-row two-field, in-file byte-twins)
Add to primal-companion-beast-of-the-sea actions[0]:
- `"hit_conditions": ["grappled"]`
- `"escape_dc": 17` (RAW 8+PB+WIS; lv17 caster ⇒ 8+6+3=17; per-tier value rides the summoner stamp precedent)
Template: otyugh Tentacle MA-1274 (hit_conditions:["grappled"]+escape_dc:13) / giant-crocodile Bite MA-0801. Fold passes unknown keys through untouched (resolved = {...action}), so no code change required — grant reason will print "(escape DC 17)" + meta {dc:17, ability:'str', source}.
Caveats (do-not-sweep): damage "Bludgeoning or Piercing (your choice)" stays GM-adjudicated (Bludgeoning disk-authored; Bestial Fury fold overwrites type to Force RAW-legal §749); Primal Bond/lair-free; sustained-grapple state machine §69 residual (escape attempt UI absent app-wide).

## Scope/cleanup
test-campaign only. FeyRanger subclass restored byte-clean from /tmp/MA-1344-FeyRanger-backup.json (sha256 c77ed56de37c91fa88c4623b1e6c59e921cca0d4ce9721edfdccdb338b6656db). Board admin-cleared (change-data+log).

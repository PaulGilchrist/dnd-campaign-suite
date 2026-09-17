# BUG MA-0332 — Badger / Bite: flat "1 Piercing" damage NEVER applies on hit

**Verdict: FAIL** (MA-0322 flat-damage silent-fallback class — fingerprint CONFIRMED, not re-derived)
**Date:** 2026-09-17 · **Campaign:** test-campaign ONLY · **UI:** localhost:5173 · **Truth:** curl localhost:80

## Row
- monster Badger (monsterIndex `badger`) · actionIndex 0 · "Bite" · attack
- Data keys (exact, monsters.json): `name, description, attack_bonus, reach, damage_type_primary` — attack_bonus 2, reach "5 ft.", damage_type_primary "Piercing". NO dice/flat key; flat 1 exists ONLY in prose "<strong>Hit:</strong> 1 Piercing damage." No drift vs row spec.

## Rig
- EB exact "Badger" ×1 → Join → cs idx0 "Badger 1". Victim HexWarlock AC9 (targetAc/effectiveAc 9 curl-confirmed), HP 73/73 topped. cs.targetName=HexWarlock curl-verified pre-roll.

## Live proof (5 chip clicks on "+2")
- Rolls distinct (5/5 unique log ids, unique d20s — no MA-0273 replay): nat 17→19 HIT, nat 16→18 HIT, nat 6→8 MISS, nat 8→10 HIT, nat 9→11 HIT.
- Boundary vs AC9 exact: nat≤6 miss (nat6=8<9) / nat≥7 hit (nat8=10≥9, nat9=11≥9, nat16=18, nat17=19).
- DEFECT: all 4 hits applied ZERO damage:
  - Popup on HIT: single-stage "✓ HIT (N vs AC 9) click to dismiss" — NO dice-roll-reroll-btn/Done, NO damage section, NO stage-2 popup → silent close.
  - lastAttack: `damageFormula:null`, `damageDice` absent, `finalDamage:null` on every hit.
  - Log: 0 damage entries (only 5 `roll/attack` entries, all finalDamage null).
  - HP delta: HexWarlock runtime change-data block ABSENT (never written); initiative-card HP input 73→73.
- Flat "1 Piercing" never resolves. Misses correctly zero.

## Root cause (grep cite)
- `extractDamageDiceFromDescription` regex requires "Hit: N (XdY)" — flat prose has no parenthesized dice → null (src/components/encounter/MonsterCardModal.jsx:367-372, esp. :371).
- null formula → buildAutoDamage undefined → `autoDamageRoll: if (!autoDamage) { setPopupHtml(null); return; }` silent dismiss (src/components/encounter/MonsterCardModal.jsx:1027-1030).
- Identical to MA-0322 (Awakened Shrub Rake, playbook:586). All flat-damage monster rows share this class.

## Cleanup
- Admin Clear Change Data + Clear Log (native confirms, test-campaign) → verified {} / [] (see session tail).

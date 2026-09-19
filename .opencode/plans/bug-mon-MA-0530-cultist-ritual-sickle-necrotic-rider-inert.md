# bug-mon-MA-0530-cultist-ritual-sickle-necrotic-rider-inert

## Row
MA-0530 Cultist (cultist) actions[0] "Ritual Sickle" — +3 melee 5 ft. Hit: 3 (1d4 + 1) Slashing **plus 1 Necrotic**.

## Disk state (public/data/monsters.json)
actions[0]: attack_bonus 3, reach "5 ft.", damage_dice_primary "1d4 + 1", damage_type_primary "Slashing", damage_type_secondary "Necrotic" — **no `damage_dice_secondary`, no flat-secondary field**. The flat-1 Necrotic rider exists only in prose.

## Code audit
- `extractDamageDiceFromDescription` (MonsterCardModal.jsx:477) returns existing `damage_dice_primary` verbatim → formula "1d4 + 1".
- `extractFlatHitDamage` (MonsterCardHelpers.js:1416) is dice-paren-guarded (line 1419) → null on this dice-bearing row.
- `buildSecondaryDamageTransport` (MonsterCardModal.jsx:666-675) gates on `action.damage_dice_secondary` → null triple for flat riders.
- App-wide grep: no attack-row parser for flat "plus N <Type>" prose. diceRoller supports " plus N" constant segments (CLA-281, flat-not-doubled on crit) but no producer emits them here.

## Live proof (test-campaign, 2026-09-19)
Cultist 1 + Bandit 1 (AC12, resistances[] clean) EB-joined, Bandit staged 200/200 via full-store /combatSummary POST. Arm via Cultist's own initiative-card target-select, "+3" chip on .mc-action:has Ritual Sickle.
- 8 attacks: 2 misses (nat6→9, nat4→7) zero damage entries ✓; 6 hits incl boundary nat9→12 vs AC12 ✓.
- Every hit popup/damage entry: formula "1d4 + 1" Slashing ONLY. totals 5,2,5,3,3,3; total==finalDamage==|hpΔ| exact, hp chain 200→195→193→188→185→182→179, SUM dmg 21 == SUM |hpΔ| 21.
- Every hp_change `damageBreakdown` = [{Slashing, N, resisted:false}] — **zero Necrotic entries on all 6 hits**.
- Damage entries carry `note:"combined_damage_roll"` yet NO secondary* fields — combined-path resolver runs, transport triple arrives null (MA-0427 class twin).
- RAW honest delta: per hit applied = dice+1 (mod), expected dice+2 (mod+flat-1) → rider never applied on ANY hit = FAIL(a).
- No nat20 rolled in 8; crit seam byte-identical to dice-only precedent (MA-0433/0393) — flat "plus 1" would ride the same inert transport regardless.

## Fix template
DATA: author `flat_damage_secondary: 1` (+ existing damage_type_secondary) on the row, or code: extend `buildSecondaryDamageTransport` to parse flat "plus N <Type>" from description when no dice paren follows "plus", emitting constant secondary formula "1" (diceRoller already keeps constants flat on crit, CLA-281). Consumer seam = MA-0426 autoDamageSecondaryFormula combined_damage_roll path (secondaryFinalDamage already logged/breakdown-capable).

## Fingerprints
- Dice-primary + flat-secondary prose = NEW variant of MA-0322 flat family: MA-0322 extractor is byte-inert on dice-bearing rows, so neither primary nor secondary seam sees the rider.
- note:"combined_damage_roll" without secondary* fields = fast fingerprint of null-transport combined path.

# BUG MA-0364 — Bat Bite: flat "1 Piercing" damage never applied (MA-0322/MA-0332 class)

**Verdict: FAIL (confirmed live, 2026-09-17, test-campaign)**

## Row
- MA-0364 | Bat (monsterIndex `bat`) | actionIndex 0 | Bite | attack
- Disk dump `public/data/monsters.json` bat actions[0]:
  `{"name":"Bite","description":"Melee Attack Roll: +4, reach 5 ft. <strong>Hit:</strong> 1 Piercing damage.","attack_bonus":4,"reach":"5 ft.","damage_type_primary":"Piercing"}`
- **No dice key, no structured flat-damage key** — fingerprint pre-confirmed, not re-derived.

## Live probe (Encounter Builder join, HexWarlock AC 9 / HP 30/30 armed via combatSummary POST)
7 chip clicks on Bite "+4" chip, full popup cycles (§290-292, popup-overlay dismissed between rolls):

| # | d20 | +4 | vs AC 9 | Popup outcome | Damage shown | HP delta |
|---|-----|----|---------|---------------|--------------|----------|
| 1 | 10 | 14 | HIT | "✓ HIT (14 vs AC 9)" | none | 0 |
| 2 | 1 | 5 | MISS | "CRITICAL MISS! ✗ MISS (5 vs AC 9)" | — | 0 |
| 3 | 1 | 5 | MISS | "CRITICAL MISS! ✗ MISS (5 vs AC 9)" | — | 0 |
| 4 | 20 | 24 | CRIT | "CRITICAL HIT! — DAMAGE DICE DOUBLED ✓ HIT (24 vs AC 9)" | none | 0 |
| 5 | 4 | 8 | MISS | "✗ MISS (8 vs AC 9)" | — | 0 |
| 6 | 18 | 22 | HIT | "✓ HIT (22 vs AC 9)" | none | 0 |
| 7 | 11 | 15 | HIT | "✓ HIT (15 vs AC 9)" | none | 0 |

- 4 hits, 3 misses (≥2 hits + ≥1 miss requirement met).
- To-hit math exact: d20+4 boundary correct (nat 4 → 8 vs AC 9 miss; nat 5+ would hit).
- MA-0273 cached-dice check: rolls #2/#3 both nat 1 but distinct detail rolls (19 vs 9) — genuine randomness, fresh log entries each click; not a replay artifact.

## Evidence
- Campaign log after probe: 9 entries = 1 encounter + 8 rolls (1 initiative + 7 Bite attacks). **Zero `attack`/`hp_change`/damage entries.**
- `curl /api/campaigns/test-campaign/change-data` → HexWarlock `currentHp: 30 / maxHp: 30` before and after all 4 hits.
- Hit popups render only "✓ HIT (N vs AC 9) / click to dismiss" — no damage section, no dice, no flat 1, even on the nat-20 crit (banner says "DAMAGE DICE DOUBLED" but there are no dice to double and none applied).

## Root cause (known fingerprint — confirmed, do not re-derive)
MA-0322/MA-0332 flat-damage silent-fallback class: row authors flat integer damage ("Hit: 1 Piercing") with no `damage_dice_primary` / structured flat key. `extractDamageDiceFromDescription` requires "Hit: N (XdY)" → returns null → `buildAutoDamage` undefined → `setPopupHtml(null)` silent close (MonsterCardModal.jsx:1027) → hits apply ZERO damage, no log.

## Fix shape (for fixer, not applied here)
DATA: author structured flat damage on the row (e.g. `damage_flat_primary: 1` / flat-damage seam consumed by buildAutoDamage) so hits apply 1 Piercing and log it; or extend extraction to parse flat "Hit: N <Type> damage". Judge vs sibling MA-0322/MA-0332 tickets.

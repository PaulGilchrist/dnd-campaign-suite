# bug-SP-096 — Regenerate: PC initial heal computes negative (−82) and never applies

Verdict: FAIL — start-of-turn +1 lane exact, but the 4d8+15 initial heal breaks on PC victims.

## Expected Behavior (canonical, public/data/2024/spells.json — app wins)
Regenerate lv7, Touch, V/S/M (prayer wheel), 1 action, 1 hour, NOT concentration: "A creature you touch regains 4d8 + 15 Hit Points. For the duration, the target regains 1 Hit Point at the start of each of its turns, and any severed body parts regrow after 2 minutes." Manifest "lv5" and "5e twin 1d8+15" both wrong vs app data (heal_at_slot_level {"7":"4d8 + 15"}).

## Actual Behavior (live 2026-10-08, Wild_Sage_Druid lv20 caster, HexWarlock victim, test-campaign)
- Victim wounded 103→83 (Thundercloud −20).
- Cast Regenerate (slot lv7 2→1, te badge, regenerateActive ✓) → popup **"Regained −82 HP"**, HP 83→83, log `hp_change delta:-82`, formula "4d8 + 15".
- Root: `regenerateHandler.js:76` `maxHp = creature?.maxHp || playerStats.hitPoints` — PC combatSummary placeholder maxHp=1 beats true hitPoints=103 → :99 `actualHeal = min(roll, 1−83) = −82` → :102 `if(actualHeal>0)` skips apply → :110 logs −82.
- Roll dice totals never surfaced (automation_info popup, no rolls payload).

Working (exact): gate popup, lv7 slot pay, te regenerate badge, +1 start-of-turn tick consumer applyRegenerateBuffHeal (turnStartEffects.js:509 ← navigationHandlers.js:134) fired on victim turns ×2 (83→84→85), no stray ticks on 11 other turn starts, conc:false honored.

## Steps to Reproduce
1. Wound a PC below max (e.g. HexWarlock 103→83).
2. lv7-capable caster casts Regenerate at it → popup "Regained −82 HP"; HP unchanged.

## Likely Location
- `src/services/automation/handlers/**/regenerateHandler.js:76` — placeholder maxHp precedence; use true max (character maxHp or cs real value; cf §"PC HP truth = change-data hitPoints").

## Notes
- Duration: gated lane adds NO expiry clock (CLA-033 family); spellCastService helpers.js:473 has 600-round clock but UI cast never reaches it; clears only via rest/reroll house rule.
- Limb regrow 2 min: grep-zero consumers — advisory by design?
- Cosmetic: `spell` log mislabels target "Cloud Giant 1" (creatureTargets[0] stale stamp); turn ticks log-less.
- Fix retest: initial heal should clamp to missing HP (83→98+ on a 21 roll).

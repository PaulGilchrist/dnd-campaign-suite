# MA-1089 Lich "Frightening Gaze" — FAIL(b)/DATA silent-burn (MA-0510/0696 twin)

## Disk (truth, docs/monster-actions-manifest.json MA-1089 + public/data/monsters.json legendary_actions[2])
- description verbatim: "The lich casts Fear, using the same spellcasting ability as Spellcasting. The lich can't take this action again until the start of its next turn."
- uses:1, recharge:false; save_dc ABSENT, save_type ABSENT, save_effect ABSENT, hit_conditions ABSENT, delegates_to ABSENT, advisory/advisory_message ABSENT.
- Lich statblock has ZERO spell* structured keys (no spellcasting object, no save_dc, no Fear entry) — "Fear" is prose-only, nothing for an engine consumer to resolve. MA-1039 Sleep-Gaze structured analog NOT present.

## Live evidence (:5173, test-campaign header verified, 2026-09-24)
- Fresh card §4: overlay innerText startsWith "Lich 1". Row DOM verbatim: `Frightening Gaze.  Expend LegendaryThe lich casts Fear, using the same spellcasting ability as Spellcasting. The lich can't take this action again until the start of its next turn. (false)` — single chip SPAN.mc-dice-link.mc-dice-link-legendary text " Expend Legendary"; zero DC/dice chips (no structured fields — consistent); cosmetic trailing "(false)" (§162-family prose-boolean render).
- Honest refusals (economy intact, zero spend, zero roll): exhausted@1790246780413 "no legendary uses left — they regain at the start of Lich 1's turn. Nothing spent, no roll."; own-turn x4 @854607/884674/026992/214514 — cause: combatSummary.activeCreatureName mirror FROZEN at "Lich 1" while gate key lastAppliedTurnStartCreature advanced to 8:Guard 1 (§MA-0509 cs-freeze fingerprint); synced mirror via cs full-store POST (rig seam, corrective).
- REAL expend @1790247297963 after Guard 1 boundary: ability_use verbatim "Lich 1 expends a legendary use for Frightening Gaze after Guard 1's turn — 0 of 1 left (regain at the start of Lich 1's turn; 4 in lair advisory)." monsterLegendaryUses {max:1,used:1}; latch {round:8,activeCreature:"Guard 1"}; monsterLegendaryActionCooldowns {frightening_gaze:{round:8,usedBefore:0}}; header counter "Deathly Teleport (0 left)".
- EFFECT NEVER RESOLVES: post-press new-log = spend entry ONLY. Zero ability_use "casts Fear", zero save roll/prompt, zero saveDc stamp, zero target selection, zero condition-applied. Bandit 1 (only armed victim, AC12, cond-clean) activeConditions [] / activeConditionMeta {} / hp held 391/999. Frightened NEVER granted → no removal needed (step 4 n/a).
- Console errors 1: `[MonsterCardModal] legendary action "Frightening Gaze" delegates_to "undefined" — no resolvable mechanic on "Lich 1"` @ src/components/encounter/MonsterCardModal.jsx:766 — MA-0510/MA-0696 silent-burn lane CONFIRMED: expendLegendaryUse spends (monsterLegendaryUses.js:342-346), then modal resolution dead-ends because row carries neither delegates_to nor a structured mechanic nor advisory copy (buildLegendaryAdvisoryPopup MA-0058 lane unreachable — no advisory field).
- Rig intact: cs 71 creatures, round 8, Bandit 391/999 conds [], Lich joined {used:1,cooldown+latch} (regains at own turn-start); NO clears. Overlay closed; console 1 error (defect, retained per policy).

## Verdict
FAIL(b)/DATA: legendary economy spine (gate/refuse/regain/latch/cooldown) verified honest, but the row's advertised effect (cast Fear → WIS save → Frightened) has zero engine resolution — spends burn silently with a console.error. Not PASS-subset: effect lane is harder-zero, not a partial leg.

## Fix (data)
Row needs resolvable mechanic: structured Fear lane (save_dc 15 Wisdom per published Lich statblock, target selection, condition frighten w/ concentration + ends clause) OR delegates_to a castable Fear spell lane; interim one-field mitigation: `advisory_message` ("casts Fear ... GM-enforced: WIS save DC 15, Frightened ...") routes MA-0058 advisory popup+log and removes the console.error dead-end.

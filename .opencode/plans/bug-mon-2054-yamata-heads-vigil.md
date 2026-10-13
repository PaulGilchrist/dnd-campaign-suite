# MA-2054 — Yamata no Orochi "Head's Vigil" (legendary): silent-burn, no check mechanic

## Title
MA-2054 FAIL(b)/DATA — Orochi legendary "Head's Vigil" spends a use for nothing: prose-only row, generic Expend chip, console.error dead-end, zero Perception check.

## Overview
"Head's Vigil" is a legendary action that says "Orochi makes one Perception check" but the row carries NO `ability_check` field (and no `delegates_to`, no numeric fields). The UI renders a generic `mc-dice-link-legendary` "Expend Legendary" chip; pressing it consumes 1 legendary use (monsterLegendaryUses 1→2 observed live), logs an `ability_use` spend entry, then hits the MonsterCardModal console-error dead-end (`Modal:776`, fingerprint: `[MonsterCardModal] legendary action "Head's Vigil" delegates_to "undefined" — no resolvable mechanic`) with ZERO check roll, ZERO popup. This is the exact MA-1974 active-trap shape (strictly worse than inert, §60): the counter honestly decrements for a mechanic that never executes.

## Expected
Row (manifest): `"description": "Orochi makes one Perception check."` — expect a live "+N" check chip (`mc-dice-link-check`, "Wisdom (Perception) +N") that spends 1 use AND rolls d20+bonus with popup + roll log entry.
Disk `public/data/monsters.json` yamata-no-orochi legendary_actions[2] = `{name, description}` only — no `ability_check`.
Expected bonus on fix (Garuda MA-1910 / Quetzalcoatl MA-1974 twin lane, monsterLegendaryUses.js:210-227 skills→ability_score_modifiers fallback): Orochi `skills:{}` → fallback `ability_score_modifiers.wis = 2`, PB 8 not added by this lane → chip **"Wisdom (Perception) +2"**, roll = d20+2.

## Actual
- Census: chip = generic `mc-dice-link-legendary` "Expend Legendary" (title "Expend 1 legendary use — Head's Vigil"); NO `mc-dice-link-check` "+N" chip.
- Probe at legal fresh boundary (4:AberrantSorcerer; needed MA-1852 cs-mirror unstick POST /combatSummary first): press → monsterLegendaryUses {max:3,used:1}→{used:2}, log +1 `ability_use` spend entry, console.error "no resolvable mechanic", ZERO roll entries (Orochi roll count unchanged at 25), ZERO popup.
- Economy faces around it are honest: consumed-boundary refusals (turn) ×2 and same-boundary refire refusal — all `legendary_use_refused` logged, zero spend, popup "Nothing spent, no roll."
- FAIL(b): mechanic NOT implemented for this row — spend-only.

## Steps to Reproduce
1. :5173, `test-campaign`, Initiative; Yamata no Orochi 1 + Bandit 1 on board (or EB re-join).
2. Walk initiative to a fresh non-Orochi turn-start boundary (unstick frozen cs mirror via POST /api/campaigns/test-campaign/combatSummary {value:{...cs, activeCreatureName:<truth>}} if `combatSummary.activeCreatureName` lags `__initiative__.lastAppliedTurnStartCreature`).
3. Open Orochi `.mc-overlay` → "Head's Vigil" row → press the generic Expend chip.
4. Observe: use spent (GET change-data `Yamata no Orochi 1.monsterLegendaryUses`), `ability_use` in log, console error, no popup, no roll.

## Likely Location
**monsters.json DATA drift** (not engine): row lacks the authored field. Engine lane is live and proven on twins — add to yamata-no-orochi legendary_actions[2]:
`"ability_check": { "ability": "wisdom", "skill": "perception" }`
(Garuda MA-1910 / Quetzalcoatl MA-1974 byte-twins; renders live "+2" check chip via monsterLegendaryUses.js:210-227, Modal prespend bonus :912.)

## Notes
- MA-1974 family member (Quetzalcoatl Detection fixed twin; smaug Detection chip also seen MA-1998). Costs-N/turn/exhausted economy enforcement on this card all honest — defect isolated to missing mechanic field.
- Refusal-popup Done = by-text click; `.mc-overlay` intercepts Next-walk (`.mc-close` before walking); latch `_legendaryUses_usedRound.activeCreature` keys the JUST-ENDED turn (MA-1975).
- Board left INTACT for MA-2055 Crushing Coil (last Orochi row): round 4, legendary {max:3, used:2}, Orochi 511/511, Bandit 1 873/999. No admin-clear performed.

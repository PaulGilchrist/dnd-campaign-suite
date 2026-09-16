# Bug — MA-0220 Ancient Gold Dragon · Legendary "Pounce" inert (no affordance, zero delta)

## Title
MA-0220 Ancient Gold Dragon legendary Pounce — inert prose row: no click affordance, zero delta on click (MA-0164/0219 fingerprint); control Rend +17 live.

## Overview
Probing manifest row MA-0220 (`ancient-gold-dragon` | `legendary_actions` | "Pounce") on the live monster card. The row is bare name+description prose inside a legendary dict whose header carries no numeric `uses`. Static grep + live DOM probe both confirm the row is inert and unclickable; clicking produces zero log/roll/move/damage delta while the non-legendary Rend chip (+17, different `.mc-action` row) rolls live. VERDICT: FAIL.

## Expected
Row text (manifest MA-0220):
> "The dragon moves up to half its Speed, and it makes one Rend attack."

monsters.json `ancient-gold-dragon.legendary_actions[3]` (verbatim):
```json
{ "name": "Pounce", "description": "The dragon moves up to half its Speed, and it makes one Rend attack." }
```

PASS requires the Pounce row itself to grant a gated legendary spend and roll a numeric Rend attack (attack_bonus +17, damage dice) against the armed target — i.e. `delegates_to: "Rend"` on the row plus header `uses` so the spend economy is wired.

## Actual
- Static: Pounce dict = `{name, description}` only — no `attack_bonus`, `save_dc`, dice, `move`, `delegates_to`, or automation metadata. Header `legendary_actions[0]` = `"Legendary Action Uses: 3 (4 in Lair)"` — uses lives in name-text only, no numeric `uses` field → `legendaryHeaderAction()` (monsterLegendaryUses.js:153-157, `rows[0]?.uses != null`) returns null → `legendaryGate` never wired → `LegendarySpendLink` (MonsterAction.jsx:148) returns null → per-row affordance vanishes entirely (MA-0217/0219 fingerprint).
- Live DOM: row outerHTML = `<div class="mc-action"><strong>Pounce.</strong><span>The dragon moves up to half its Speed, and it makes one Rend attack.</span></div>` — 0 `.mc-dice-link`, 0 `[role=button]` (MA-0219 inert-judgment recipe).
- Click probe: log count 2→2, zero new entries; no `monsterLegendaryUses` key written (null); dragon HP 546 unchanged; no token position/move record.
- CONTROL: same card, non-legendary `Rend.` row (`.mc-dice-link` "+17") → new log entry `{type:"roll", rollType:"attack", name:"Rend", bonus:17, bonusDetail:"(+17 to hit)", targetElderPaladin}` — engine alive, live attack path is a different row.
- "Moves up to half its Speed" has NO grid-movement producer anywhere (§7): grep shows `halfSpeed`/move-half consumers only in PC reaction/rage handlers (`reactionBonusHandler.js`, `combatStanceHandler.js`, `CharReactions.jsx`), zero on any monster legendary path.

## Steps to Reproduce
1. `npm run dev` (or dev:locked); open http://localhost:5173, select `test-campaign`.
2. Admin → clear change-data + log (fresh state).
3. Encounters → EB search exact "Ancient Gold Dragon" → tick checkbox → "Join Encounter" (verify card "Ancient Gold Dragon 1", hp 546, ac 22).
4. Arm target: dragon initiative-card `[data-testid="target-select"]` → ElderPaladin; verify `combatSummary` `targetName:"ElderPaladin"` via `/api/campaigns/test-campaign/change-data`.
5. Open dragon card (`img.avatar-image` click).
6. Locate legendary `Pounce.` row → outerHTML shows no affordance (no `.mc-dice-link`, no `[role=button]`, no "Expend Legendary" chip).
7. Click the row → capture `/log` before/after: zero delta, no `monsterLegendaryUses`, no move/damage.
8. CONTROL: click non-legendary `Rend.` row `.mc-dice-link` "+17" → new `roll`/`attack` log entry appears (live).

## Likely Location
- `public/data/monsters.json` — `ancient-gold-dragon.legendary_actions` block: header dict missing numeric `uses`; Pounce row [3] bare prose (primary defect, data authoring).
- `src/components/encounter/MonsterAction.jsx:148` — `LegendarySpendLink` (correctly returns null without gate; gate absence is data-side).
- `src/services/encounters/monsterLegendaryUses.js:153-157` — `legendaryHeaderAction()` requires `rows[0].uses != null` (correct behavior exposed by missing data).
- `src/components/encounter/MonsterCardModal.jsx` / MonsterCardBody — legendary branch renders plain row.

## Notes
- Inert legendary prose family: MA-0164 (Ancient Black Pounce), MA-0196/MA-0197 (Bronze/Blue ancient Pounce family), MA-0219 (probe recipe), MA-0217 (header-uses fingerprint). Same shape: name+description-only legendary dicts.
- §7 no-movement-producer: no grid token mover exists for monster "moves half Speed" prose — even a fixed delegates_to Rend would need movement handled separately (advisory prose acceptable).
- MA-0164 half-fix warning: adding header `uses:N` alone gives this row a gated "Expend Legendary" chip that silently BURNS a use with console.error "no resolvable mechanic". Complete fix = header `uses: 3` + `delegates_to: "Rend"` + verbatim description mirror on the row.
- PC `currentHp` 1/1 placeholder — control judged from new log roll lines, not HP delta (MA-0219).

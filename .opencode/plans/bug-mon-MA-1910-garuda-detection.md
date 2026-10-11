# MA-1910 — Garuda "Detection" (legendary) — silent-burn, no ability_check authored (data)

## Title
Garuda legendary Detection spends a legendary use but rolls nothing — no `ability_check` structured field, so the skill-check lane (which EXISTS, MA-0051) is starved; console error fingerprint fires.

## Overview
Row MA-1910 (`garuda|legendary_actions|2`), verified E2E localhost/test-campaign 2026-10-11. MA-1853/1863 silent-burn family, distinguishable by its console-error stamp.

## Expected Behavior
Row description: "Garuda makes one Perception check."
Expected: a Perception skill check rolls (d20 + Wisdom/Perception bonus) with popup/log record; LA −1.

## Actual Behavior
- Press at fresh boundary: LA spent honestly (`monsterLegendaryUses{max:3,used:1}`, "(2 left)", ability_use log).
- ZERO popup, ZERO roll entries — no d20 Perception roll anywhere.
- Console error: `[MonsterCardModal] legendary action "Detection" delegates_to "undefined" — no resolvable mechanic on "Garuda 1"` (MonsterCardModal.jsx:716 else-branch).
- Grep: skill-check lane exists — `legendaryCheckRow` (monsterLegendaryUses.js:192) requires structured `action.ability_check:{ability,skill?}`; bonus via `skills[skill]` else `ability_score_modifiers` (Dracolich "Detect" precedent, Modal:775-788 spends 1 then handleCheck → rollSkillCheck). Garuda Detection authors NO `ability_check` → dead end.

## Steps to Reproduce
1. localhost → test-campaign → Garuda in initiative.
2. After a PC turn, press the Detection legendary chip → use burns, nothing rolls, console error.

## Likely Location
`public/data/monsters.json` — pure data fix: `ability_check:{ability:"Wisdom",skill:"Perception"}` (Garuda `skills:{}` → +4 via ability_score_modifiers abbr lane). Zero code change.

## Notes
- Card-open pitfall: initiative avatar requires synthetic pointer-event dispatch (locator click times out).

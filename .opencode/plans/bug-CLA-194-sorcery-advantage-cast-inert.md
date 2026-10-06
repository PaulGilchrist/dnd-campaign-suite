# Bug — CLA-194 Innate Sorcery: buff lane exact, but spell-attack Advantage never produced (buffed casts inert; mode never 'advantage')

## Overview
CLA-194 Innate Sorcery (Sorcerer lv6+, 2024). Activation lane verified working end-to-end numerically (buff stamp, uses decrement, DC +1, Long Rest restore). However the second half of the feature — Advantage on the attack rolls of Sorcerer spells cast **while active** — could never be produced: every Ray of Frost cast attempted with the buff active produced NO attack roll, NO spell log entry, and NO popup; the only recorded Ray of Frost attack roll occurred while the buff was **inactive** and logged `mode: "normal"` (though with two d20s `[15,7]` total=15). `mode: "advantage"` never appeared anywhere.

## Expected Behavior (canonical app-data wording)
"As a Bonus Action, you can unleash that magic for 1 minute, during which you gain the following benefits: The spell save DC of your Sorcerer spells increases by 1. You have Advantage on the attack rolls of Sorcerer spells you cast. You can use this feature twice, and you regain all expended uses of it when you finish a Long Rest."

## Actual Behavior
- Activation lane OK: clicking "Innate Sorcery:" stamped change-data `AberrantSorcerer.activeBuffs = [{name:"Innate Sorcery", effect:"innate_sorcery_active", duration:"1 minute"}]`, `innateSorceryUses` 2→1, popup "+1 Save DC, Spell Adv", sheet Save DC 13→14. Long Rest restored uses (null→2/2) and cleared buffs.
- Advantage lane broken: 4 separate attempts to click Ray of Frost row → "Cast Spell" (exact-text char-btn, panel confirmed open, click returned success) while `activeBuffs=["Innate Sorcery"]` produced **zero** change to `lastAttackRoll` and no new `spell`/`roll` log entries.
- The one Ray of Frost roll in the log (ts 1791285980474, `rolls:[15,7] total:15 mode:"normal"`) happened 77 s AFTER the `long_rest` entry (ts 1791285903274), i.e. buff inactive. Roll popup for it showed raw d20s with on-screen "Advantage/Disadvantage" toggle chips even unbuffed — bandit initiative also rolled `[16,6]` `mode:"normal"` (two dice, max kept). Dual-die + max-keep under `mode:"normal"` is indistinguishable noise, so no clean numeric proof of the buff-driven advantage gate is obtainable via this UI.
- No `ability_use`/`automation` log entry for Innate Sorcery activation itself (activation is unlogged).

## Steps to Reproduce
1. localhost:5173, select test-campaign, open AberrantSorcerer (Sorcerer/Aberrant Sorcery lv20).
2. Click "Innate Sorcery:" (bonus actions / summary) → popup "+1 Save DC, Spell Adv", DC 13→14, uses 2→1.
3. Encounter Builder → search Bandit → tick → Join Encounter (Bandit 1 joins).
4. Click Ray of Frost row → panel opens → click "Cast Spell".
5. Repeat step 4 several times while buff active: no roll popup, no roll in log, `lastAttackRoll` unchanged.
6. GET /api/campaigns/test-campaign/log → only one attack roll (post-Long-Rest, `mode:"normal"`). `mode:"advantage"` never emitted.

## Likely Location
- `src/services/automation/contextBuilder-sync.js:120` — `if (innateSorceryBonus.spellAdvantage) adv++;` gate exists but the spell-cast click path never reaches a logged rolled attack once buff active (suspect an interrupting chooser popup — Arcane Apotheosis free-metamagic while Innate Sorcery active — or `activeCreatureName` gate silently swallowing the cast).
- `src/hooks/combat/useActionSpellMetamagic.js:293` — innate-sorcery `!metaCtx?.forcedMode` gate on the cast/metamagic path.
- `src/services/automation/handlers/resources/sorceryHandler.js` — activation path; emits popup + runtime keys but no log entry (expectedBehavior/logging gap).
- Note: mission row cites `src/services/combat/automation/handlers/classFeatureHandler.js` / `routers/classFeatureRouter.js` — stale manifest paths; live lanes are `automation/handlers/resources/sorceryHandler.js` + `automationInfoBuilder/sorcery.js` (`sorcery_aura`).

## Notes
- Roller appears to emit two d20s and keep max even with `mode:"normal"` (initiative `[16,6]`, attack `[15,7]`), making rawRolls alone unreliable as adv truth; `mode` field never reported `advantage` in any observed entry.
- Control evidence: unbuffed cast DID roll; buffed casts did NOT roll — differential points at the active-buff cast branch, not at missing scene setup.
- Cleanup done: change-data GET == {}, log GET == [].

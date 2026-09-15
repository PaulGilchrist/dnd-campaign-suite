# BUG MA-0164 — Ancient Black Dragon "Pounce" (legendary_actions[3]): inert legendary row, no affordance, zero log/state delta

## Overview
Row MA-0164 — monster "Ancient Black Dragon" (monsterIndex ancient-black-dragon), category legendary_actions, actionIndex 3, actionName "Pounce", actionType other. Verified live 2026-09-14 in test-campaign (EB Join, cs[0] "Ancient Black Dragon 1", hp 367, ac 22, init 18; target armed ElderPaladin via initiative-card `[data-testid="target-select"]`, server mirror `targetName=ElderPaladin` confirmed).

The Pounce legendary row renders as a plain inert `<div class="mc-action">` (children: `STRONG` "Pounce." + `SPAN` description only — zero `a/button/span.mc-dice-link/[role=button]/spinbutton` descendants). Three click attempts (trusted mouse ×2 at row center, evaluate `el.click()` on row + `strong`) produced zero popups, zero campaign-log entries, zero change-data keys. No legendary economy exists on this monster (header dict lacks numeric `uses`), so no spend, no counter, and no refusal gate fires on repeated same-turn clicks (2nd click also zero-delta — required refusal log cannot exist).

This is the MA-0092/MA-0163 inert-legendary fingerprint, FAIL flavor (b) (MV-28/MV-30 bar: inert + grep-zero consumers = FAIL, never INCOMPLETE).

## Expected (verbatim row + monsters.json Rend numbers)
> "The dragon moves up to half its Speed, and it makes one Rend attack." — monsters.json legendary_actions[3] {name:"Pounce", description:"The dragon moves up to half its Speed, and it makes one Rend attack."}

A PASS would require the row to resolve as described: movement advisory + exactly one Rend attack roll. The referenced attack (actions[1] "Rend"): `attack_bonus: 15`, reach "15 ft.", `damage_dice_primary: "2d8 + 8"` Slashing + `damage_dice_secondary: "2d8"` Acid (typical 17+9=26 avg; live roll dealt 16+13=29). Per MA-0070 the fixable shape is header `uses:N` + row `delegates_to:"Rend"` (move+attack composite legs have no producers — §7 movement subsystem; delegates_to pattern MA-0070).

## Actual
- Row DOM: `DIV.mc-action` — class exactly `"mc-action "`, clickableChildren = [] (queried `a,button,.mc-dice-link,.clickable,[role=button],input,[class*=dice]`).
- No legendary header/counter: zero `.mc-dice-link-legendary`; no `monsterLegendaryUses` key anywhere (header gate `monsterLegendaryUses.js:153-157 legendaryHeaderAction` requires `legendary_actions[0].uses != null` — ABD header dict keys are [name, description] only, name text "Legendary Action Uses: 3 (4 in Lair)" is prose; render branch gate `MonsterCardBody.jsx:54-55`).
- Click deltas: trusted click ×2 + evaluate `row.click()` + `strong.click()` → popups [] at every step; campaign log stayed at baseline 2 (join + initiative) through all clicks; change-data "Ancient Black Dragon 1" keys remained [] after debounce (15s waits between probes); zero `pounce*` keys top-level or on the monster key.
- Second same-turn click: no refusal popup/log (no `pounce_refused`/`legendary_use_refused` — gate machinery absent because economy absent).
- CONTROL (engine alive): same card, same session, Rend `.mc-dice-link` (" +15") vs armed ElderPaladin → popup "Rend … ✓ HIT (19 vs AC 19)" → Done (`button.dice-roll-reroll-btn`) → damage popup "16 Slashing + 13 Acid = 29 applied"; NEW log entries: roll/attack (name Rend, +15, hit), roll/damage (`2d8 + 8` rolls [3,5]), hp_change `targetName ElderPaladin delta -29 currentHp 195/224`; lastAttack `attackerName "Ancient Black Dragon 1", attackName "Rend", hit:true, damageApplied:true`. Engine fully alive → row itself is the unwired gap.

## Grep proof (zero consumers)
`grep -rni "pounce" src/ --include="*.js" --include="*.jsx" | grep -v ".test."` →
only `src/services/automation/handlers/combat/combatStanceHandler.js:141-142,394-398` = `_instinctivePounce` / `rage_bonus_movement` (PC barbarian Rage feature, unrelated). ZERO consumers of the monster Pounce legendary action app-wide.

## Steps to Reproduce
1. `npm run dev`, open http://localhost:5173, select **test-campaign** (verify header, MV-18).
2. Encounters → search "Ancient Black Dragon" → tick → **Join Encounter** (only path; EB table resets after).
3. Initiative → dragon card (cs[0]) → arm target ElderPaladin via `[data-testid="target-select"]`.
4. Click dragon avatar (`img[alt="Ancient Black Dragon 1"]`) → `.mc-overlay` → scroll to Legendary Actions → "Pounce" row: `DIV.mc-action`, no link/counter.
5. Trusted-click row ×2 + evaluate `el.click()` → zero popup; `curl /api/campaigns/test-campaign/log` unchanged; `/change-data` has no pounce*/monsterLegendaryUses keys.
6. Control: click "Rend" row `.mc-dice-link` (" +15") → HIT popup → Done → hp_change −29 lands (engine alive).

## Likely Location
- **Data**: `public/data/monsters.json` ancient-black-dragon legendary dict — legendary_actions[0] header lacks numeric `uses` (MA-0070 data-gate), and Pounce row lacks `delegates_to:"Rend"` (+ attack_bonus/dice or advisory) affordance fields. Row carries [name, description] only (MA-0163 fingerprint shape for this exact dict).
- **Render**: `src/components/encounter/MonsterCardBody.jsx:53-58` (legendary section gated on truthy `legendaryHeader` → else plain `MonsterActionSection` → `MonsterAction.jsx` renders links only for rows carrying attack_bonus/save_dc/dice; no delegates_to/move+attack branch exists), `src/components/encounter/MonsterAction.jsx` (affordance gate), `src/components/encounter/MonsterCardModal.jsx` (handleLegendaryRow/composite resolution).

## Notes
- Movement clause ("moves up to half its Speed") has NO consumer app-wide — no movement/token-position subsystem (§7: no position producer for monster move legs; MA-0070 lists "movement distance" as advisory residual). Even the canonical MA-0070 fix shape could only deliver advisory movement + delegated Rend roll.
- Same-monster precedent: MA-0163 (Frightful Presence legendary, same dict) FAIL flavor (b) inert; MA-0160 (Spellcasting upcast residual) on this dragon. Registry: EB re-join changes initiative (init 18 this run vs 4/14 recorded).
- Ancillary pitfall seen this run: synthetic backdrop-area mis-click (aimed at +15 link while card un-scrolled) silently CLOSES `.mc-overlay` — scrollIntoView + fresh boundingRect immediately before the trusted click, and re-open via avatar `img.avatar-image.click()` if the overlay vanished.

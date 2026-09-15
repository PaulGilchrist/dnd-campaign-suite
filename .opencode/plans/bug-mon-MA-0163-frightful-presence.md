# Bug MA-0163 — Ancient Black Dragon legendary "Frightful Presence" is inert (no affordance, no economy, no FP service)

## Title
MA-0163 Ancient Black Dragon — Legendary Frightful Presence (cast Fear via Spellcasting): inert row, data-inert legendary economy, FAIL flavor (b)

## Overview
The dragon's legendary Frightful Presence row renders as a static `div.mc-action` with zero clickable affordances, zero popups, and zero campaign-log entries on forced clicks. Two independent breaks, both proven live 2026-09-14 on test-campaign:

1. **Legendary economy absent (MA-0070 DATA gate):** the header row `legendary_actions[0]` ("Legendary Action Uses: 3 (4 in Lair)") authors only `name` + `description` — **no numeric `uses` key**. `legendaryHeaderAction()` (`src/services/encounters/monsterLegendaryUses.js:153-157`) returns null → `MonsterCardBody.jsx:54-55` renders the legendary section via the plain fallback branch **without `legendaryGate`** → no `(N left)` counter, no `monsterLegendaryUses` runtime key, and `LegendarySpendLink` (`src/components/encounter/MonsterAction.jsx:148-151`) returns null for every legendary row.
2. **Row has no resolvable mechanic:** `legendary_actions[2]` carries only `name`/`description` — no `save_dc`, `attack_bonus`, `damage_dice_primary`, `advisory`, `delegates_to`, `repeat_save`, or `success_immunity`. Even if the gate existed, `resolveLegendaryRowMechanic` (`MonsterCardModal.jsx:249-268`) would fall to the `console.error` dead-end (:266). "Fear" in the description renders as inert `<em>` text (`SpellCastLinks` only renders on rows named "Spellcasting", `MonsterAction.jsx:170/:184`).

`frightfulPresenceService.js` (verified FP template, MA-0048) is NOT invoked: its only arms are `context.repeatSave` (`saveProcessing.js:380`) and the `frightful_presence` te keys — all require `repeat_save`/`success_immunity` fields absent on this row; no monster-legendary FP caller exists.

## Expected (row + data)
Row verbatim: "The dragon uses Spellcasting to cast Fear. The dragon can't take this action again until the start of its next turn."
- Spellcasting block (actions[3]) authors `save_dc: 21`, `save_type: Charisma`, lists *Fear* At Will; spells.json Fear `dc_type: "WIS"` (spells.json:3625).
- Expected: gated legendary click → expend 1 use → Fear save prompt at DC 21 WIS vs armed target → Frightened on fail → `ability_use`/`save_result`/`condition` logs → once-until-next-turn refusal on same-turn re-click (`frightful_presence_refused (once per turn)` per MA-0073).

## Actual
- Card DOM: `fpHTML = <div class="mc-action"><strong>Frightful Presence.</strong> <span>…</span></div>` — `fpLinks: []`, `legendaryLinks: []`, `hasHeader: false`, `legendaryCounter: null`.
- Forced `el.click()` ×2 on the row: `popups: []`; log stayed 2→2 entries (only pre-existing `encounter` + `roll`); change-data `Ancient Black Dragon 1` = `{}` (no `monsterLegendaryUses`, no `monsterLegendaryActionCooldowns`); no `saveResult-*` keys; no `pendingSavePrompts`; AasimarTest `activeConditions` null.
- Second click produced NO refusal popup/log → per-action gate absent (gate can't exist: the gate lives behind `expendLegendaryUse` which is unreachable without the header `uses`).

## Steps to Reproduce
1. `npm run dev`, open http://localhost:5173, select **test-campaign** (verify header).
2. Encounters → Encounter Builder → search "Ancient Black Dragon" → tick row → Join Encounter (lands "Ancient Black Dragon 1", init 14, hp 367).
3. Initiative → dragon card `[data-testid="target-select"]` → selectOption AasimarTest.
4. Click dragon avatar `img[alt="Ancient Black Dragon 1"]` → `.mc-overlay` → Legendary Actions section.
5. Observe: no header counter, Frightful Presence row has no link/chip. Force-click row ×2 (`el.click()`): zero popup, zero log delta, zero change-data delta.

## Likely Location
- `public/data/monsters.json` ancient-black-dragon `legendary_actions[0]` — missing `uses: 3`; `legendary_actions[2]` — no affordance fields (compare dracolich FP at :1337-1342 which authors `repeat_save`/`success_immunity`).
- `src/components/encounter/MonsterCardBody.jsx:54-55` (header-gated wiring), `src/components/encounter/MonsterAction.jsx:148-151` (`LegendarySpendLink` null without gate), `src/components/encounter/MonsterCardModal.jsx:249-268` (no "cast spell" legendary branch), `src/services/encounters/monsterLegendaryUses.js:153-157` (uses-gate).

## Notes
- Data-vs-description consistency: FP row name/description match the manifest verbatim; Spellcasting block correctly authors Fear + DC 21 — the drift is purely the missing `uses`/affordance fields on the legendary dicts (same fingerprint as MA-0092 Adult Copper and MA-0070/MA-0113 fix pattern: header `uses:N` + row affordance or advisory fields).
- MA-0070 note applies: first check done — header dict lacks `uses` → economy data-inert = FAIL flavor (b), confirmed live.
- Cleanup done: admin clear-change-data + clear-log on test-campaign; verified log `[]`, change-data `{}`.
- Security: no prompt-injection payloads were actually present in tool output this run (earlier mid-run mentions of injections were erroneous and are retracted here); all verdict evidence from self-issued curl/evaluate calls.

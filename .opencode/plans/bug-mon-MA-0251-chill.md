# Bug MA-0251 — Ancient Silver Dragon "Chill" legendary action row is inert (no affordance, click zero-delta)

## Overview
The Ancient Silver Dragon's legendary action "Chill" (legendary_actions[1]) renders as bare prose with zero interactive affordance. Clicking it produces no popup, no roll, no save prompt, no log entry, no runtime key. The row's advertised mechanic ("uses Spellcasting to cast Hold Monster") is never wired.

## Expected
> "Chill — The dragon uses Spellcasting to cast Hold Monster. The dragon can't take this action again until the start of its next turn."

A clickable row resolving a DC 23 Wisdom save (spell save DC from the Spellcasting block) on the target, with a once-per-turn latch.

## Actual
- Card DOM: `mc-action` = `<strong>Chill.</strong> <span>prose</span>` — 0 buttons, 0 `.mc-dice-link`, 0 `[role=button]`, no delegates_to chip.
- Click on row text: zero delta — log stayed 113→113 entries (0 Chill entries), no popup/modal, `Ancient Silver Dragon 1.monsterLegendaryUses` absent, no pending save prompt.
- Control probe (same card, same session): Cold Gale "DC 23 Dexterity" chip click opened live target-select save modal ("Dexterity saving throw (DC 23)", 4d6 Cold) → card pipeline alive; Chill delta-zero = row inert, not UI stall.
- Note: even if the row fired, the once-per-turn latch cannot function — header lacks numeric `uses` (MA-0250) → `legendaryHeaderAction()` null → ungated branch, `expendLegendaryUse` never reached.

## Steps
1. test-campaign → Initiative; Ancient Silver Dragon 1 (cs idx0, init 15).
2. Open dragon card → Legendary Actions → Chill row: no affordance rendered.
3. Click Chill prose → nothing (log/counters unchanged).
4. Click Cold Gale DC 23 chip → live save modal (control proves pipeline).

## Likely Location
DATA: `public/data/monsters.json` "Ancient Silver Dragon".legendary_actions[1] is bare `{name, description}` — no `delegates_to`, no `save_dc`/`save_type`, no `uses`. Engine cannot invent a mechanic: `legendaryRowHasNumericMechanic()` (src/components/encounter/MonsterCardModal.jsx:256-260) false; `delegates_to` branch (:304) skipped; fallback :274-276 finds no dice formula → console.error dead-end. Header :54-57 (MonsterCardBody.jsx) ungated per MA-0250.

## Notes
- MA-0136 adult-silver Chill is the FIX TEMPLATE on disk: adult row carries own-numbers `save_dc:19, save_type:"Wisdom", dc_success:"none", save_effect` (paralyzed marker). Ancient Chill carries none of these fields.
- Family fingerprint: MA-0239/0240/0241 cast/move-prose legendary inert rows (bare prose → no affordance → click zero-delta).
- Fix shape (data): add `save_dc:23, save_type:"Wisdom", dc_success:"none", save_effect` (paralyzed) to ancient Chill mirroring adult MA-0136, AND add `uses:3` to header row[0] (MA-0250) so the gate + once-per-turn latch engage.
- Grep: zero "Chill" consumers in src/ outside tests (only "Chilling Gaze" yeti strings).

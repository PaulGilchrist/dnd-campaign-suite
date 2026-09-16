# Bug MA-0217 — Ancient Gold Dragon legendary uses header is display-only text; economy never arms

## Overview
The "Legendary Action Uses: 3 (4 in Lair)" header row (MA-0217, ancient-gold-dragon, legendary_actions[0]) is plain name/description text. No numeric uses counter renders, no uses are ever tracked or expended, and legendary child actions fire fully UNGATED — proven live with 4 Banish casts in one window with zero counter, zero refusal, zero spend logs.

## Expected (row description + data)
Row: "Immediately after another creature's turn, the dragon can expend a use to take one of the following actions. The dragon regains all expended uses at the start of each of its turns."
- A numeric X/3 (or 4-in-lair) counter on the header, decremented per legendary action, refusal popup + `legendary_use_refused` log beyond max / same-boundary double-spend, and full regain at the dragon's turn start.
- Data check: `public/data/monsters.json` ancient-gold-dragon `legendary_actions[0]` = `{name, description}` ONLY — NO numeric `uses` field; "3 (4 in Lair)" exists only in the name text. (Contrast: MA-0021-era fixed monsters author `uses` on the header row.)

## Actual
- Live card (.mc-overlay): header renders plain text "Legendary Action Uses: 3 (4 in Lair)." — `hasCounter=false`, no `.mc-legendary-counter`, no `.mc-legendary-header-row`, no `.mc-dice-link-legendary` gated links.
- Control probe: clicked Banish "DC 24 Charisma" 4× back-to-back (exceeds max 3; Banish's own text also says once-per-turn). All 4 opened Saving Throw Required prompts and resolved (log: 4× `save_result` "DC 24, rolled …"). ZERO refusals, ZERO refusal popups.
- change-data after probes: `monsterLegendaryUses` absent top-level AND in `Ancient Gold Dragon 1` store (`{}`); `_legendaryUses_usedRound` absent. Counter delta = none (field never exists). Zero legendary spend/refusal/regain log entries (0/28 log lines mention legendary).
- "Immediately after another creature's turn" and "regain all at turn start": never enforced observably — nothing is spent, so nothing can regain.

## Grep resolution
Consumers DO exist (newer than the MA-0092 family era):
- `src/services/encounters/monsterLegendaryUses.js` — full economy: `expendLegendaryUse` (gate/spend/latch), `regainLegendaryUses`, refusals with `legendary_use_refused` log.
- `src/services/rules/effects/turnStartEffects.js:176` — turn-start regain consumer.
- `src/components/encounter/MonsterCardBody.jsx:239-246` — `MonsterLegendaryHeaderRow` counter renderer.
BUT the whole economy keys on an authored numeric field: `legendaryHeaderAction()` (monsterLegendaryUses.js:153-157) returns `rows[0]` only if `rows[0].uses != null`. Ancient Gold Dragon's header has NO `uses` → `legendaryHeader=null` → MonsterCardBody.jsx:54-58 falls to the plain UNGATED branch (children wired to ordinary handleSaveRoll/handleDamage, no `legendaryGate`) and no counter headerRow. `regainLegendaryUses` runs but is a silent no-op (nothing was ever stamped).

## Steps to Reproduce
1. localhost:5173 → test-campaign → Encounters → search "Ancient Gold Dragon" → tick → Join Encounter (lands Initiative, init 20).
2. Arm target on dragon card `[data-testid="target-select"]` → AasimarTest.
3. Click dragon avatar → .mc-overlay → Legendary Actions section: header is plain text, no counter.
4. Click "DC 24 Charisma" (Banish) → Roll Save → Done; repeat 4× same window. Every click resolves; no refusal ever appears.
5. curl `/api/campaigns/test-campaign/change-data`: no `monsterLegendaryUses` key; `/log`: 4 save_results, zero legendary spend/refusal/regain entries.

## Likely Location
- `public/data/monsters.json` ancient-gold-dragon `legendary_actions[0]` — MISSING `"uses": 3` numeric field (primary fix: author `uses` on the header row, mirroring MA-0021 header convention; "4 in Lair" stays advisory per CLA-325).
- `src/services/encounters/monsterLegendaryUses.js:153` (`legendaryHeaderAction`) — could additionally parse a trailing numeric from the header name text instead of requiring authored `uses`.
- `src/components/encounter/MonsterCardBody.jsx:54-58` — ungated fallback branch.
- `src/components/encounter/MonsterCardModal.jsx:24-25` — expend wiring present; inert without header `uses`. saveProcessing.js: no legendary consumer needed (economy lives upstream).

## Notes
- Recurring MA-0092 family: MA-0092 (Adult Copper), MA-0172 (Ancient Blue), MA-0184/MA-0195/MA-0206/MA-0163 (Ancient Black Frightful Presence) all "legendary header uses only in name-text, no numeric uses block, children fire UNGATED". This run shows the engine fix (MA-0021 economy) has landed with real consumers, but the fingerprint PERSISTS for every monster whose monsters.json header row lacks the authored `uses` numeric — data-authoring gap, not missing consumers. Ancient Gold Dragon is a fresh member of the family.
- Registry: Ancient Gold Dragon EB re-join init 20 (was 18/12 prior runs), Admin-cleared after this run.
- Child rows MA-0218 (Banish) also violates its own once-per-turn cooldown clause (4 casts, 0 refusals) — same root cause.

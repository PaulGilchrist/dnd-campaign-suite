# Bug MA-0136 — Adult Silver Dragon "Legendary Action Uses: 3 (4 in Lair)" counter inert

**Verdict: FAIL** (identical to MA-0092/MA-0103/MA-0113/MA-0124 fingerprint — DATA-gated atop the fixed MA-0021 engine; budget never tracked, never enforced; header + Chill + Pounce fully inert text, Cold Gale clickable only via generic MV-23 save path, entirely UNGATED by the legendary budget)

## Row
- MA-0136 · Adult Silver Dragon (`adult-silver-dragon`) · `legendary_actions[0]` header · category: legendary_actions · actionType: other.
- Row description (quoted): "Immediately after another creature's turn, the dragon can expend a use to take one of the following actions. The dragon regains all expended uses at the start of each of its turns."
- monsters.json (`adult-silver-dragon.legendary_actions[0]`, read 2026-09-14): `{name:"Legendary Action Uses: 3 (4 in Lair)", description:"Immediately after another creature's turn…"}` — budget text lives only in the name; **no `uses` field authored**. Full row key sweep: row 0 `[description,name]`, row 1 Chill `[description,name]`, row 2 Cold Gale `[damage_dice_primary,damage_type_primary,description,name,save_dc,save_effect,save_type]`, row 3 Pounce `[description,name]` — header and 2 of 4 action rows carry zero numeric affordance fields; Cold Gale's `save_dc:19` makes it generically clickable (MV-23) but NOT budget-gated. "4 in Lair" is name-text only (advisory app-wide by design, `monsterLegendaryUses.js:114` — no lair-flag consumer, CLA-325).

## Expected
Numeric legendary-uses budget (3, or 4 in lair) tracked in runtime state: counter visible on the monster card, spend decrements 3→2→1→0, cap enforced (refusal at 0 and one-per-other-creature-turn latch), all uses regain at the dragon's turn start, spends/refusals/regains logged.

## Actual (live probe, test-campaign, :5173, 2026-09-14)
- Setup: EB Join "Adult Silver Dragon" → `Adult Silver Dragon 1` (huge dragon, init 3, hp 216) on initiative track. Baseline before join: change-data `{}` (0 keys), log `[]` (0 entries).
- Card overlay: NO `.mc-legendary-counter`, NO `.mc-legendary-header-row`, zero legendary spinbuttons (evaluate: counter=0, headerRow=0, spinbuttons=0). Header "Legendary Action Uses: 3 (4 in Lair)." renders as inert `div.mc-action` with **0 interactive children**; Chill and Pounce likewise 0 interactive children. Only Cold Gale exposes generic `.mc-dice-link` "4d6" + `.mc-dice-link-save-clickable` "DC 19 Dexterity" (2 children) — the MV-23 generic save path, wired to `handleSaveRoll`, NOT the legendary gate.
- Fire-twice probe, same turn (active creature AasimarTest all along; dragon never acted): fire #1 via "DC 19 Dexterity" → 60-ft Line picker ("Cold Gale (0)" disabled until pick) → select AasimarTest → "Cold Gale (1)" → save prompt → Roll Save resolved. NO refusal popup, NO counter decrement. Fire #2 same turn: save prompt ("DEXTERITY DC 19, Source: Adult Silver Dragon 1") opened AGAIN — no refusal, second ungated fire. `grep -i refused` on page UI at both points = zero matches.
- Evidence sweep (post-probe): change-data = 10 keys (`combatSummary`, `__campaign__`, `__map__`, `AasimarTest`, `activeCreatureName`, `combat-ui-viewingMonster*`, `savePrompt-AasimarTest`, `pendingSaveListenerPrompts`, `lastAttack`) — **`monsterLegendaryUses` key NEVER created**; regex sweep for any key containing "legendary" = empty set (only the `combat-ui-viewingMonster` stat-block echo for display). Log = 3 entries (`encounter`, `roll` init, `ability_use` "Cold Gale: Selecting 1 target(s) for save (DC 19 Dexterity)" — generic save-selection log, not a legendary spend): **zero** legendary-spend/refusal/regain entries. Economy entirely absent: nothing tracked, so nothing to gate.
- Server grep: `rg -ci legendary server/` = zero hits — no server-side legendary integration.

## Root cause / Likely location
1. **DATA (primary):** `public/data/monsters.json` `adult-silver-dragon.legendary_actions[0]` lacks `uses: 3`. The MA-0021 economy is header-data-gated: `monsterLegendaryUses.js:127 legendaryHeaderAction` — `return rows[0]?.uses != null ? rows[0] : null` → null here; `legendaryMaxUses` (:131) then returns null (no stamped max either) → `legendaryExpendGate` can never engage.
2. **Render:** `MonsterCardBody.jsx` actionSections map — gated branch requires `s.key==='legendary_actions' && legendaryHeader`; with no header `uses` the section takes the generic fallback (no `MonsterLegendaryHeaderRow`, no `legendaryGate`), so Cold Gale is clickable via handleSaveRoll UNGATED and header/Chill/Pounce are inert text (MV-17 fingerprint).
3. Turn-start regain seam IS live (`turnStartEffects.js` `regainLegendaryUses`) but a permanent no-op — nothing ever stamps `monsterLegendaryUses` for this dragon.

Context: byte-identical failure mode to MA-0092 (Adult Copper) / MA-0103 (Adult Gold) / MA-0113 (Adult Green) / MA-0124 (Adult Red) — `adult-silver-dragon` sits in the unamended set of headers lacking `uses`. Registry: no `Adult Silver Dragon` entry in `docs/test-monster-registry.json` (fresh join this probe; placed hp 216 / init 216-max dice 16d12+112 — registry re-entry needed by orchestrator).

## Steps to Reproduce
1. test-campaign → Encounters → search "Adult Silver Dragon" → tick → Join Encounter (verified 2026-09-14; lands init 3, hp 216).
2. Open the dragon's initiative-card overlay: no uses counter; "Legendary Action Uses: 3 (4 in Lair)", Chill, Pounce all inert `div.mc-action` (0 interactive children); only Cold Gale shows generic 4d6 / DC 19 save links.
3. Click "DC 19 Dexterity" twice same turn: picker → save prompt resolves each time; no refusal, no decrement, no `monsterLegendaryUses` in change-data ever; log shows only generic save-selection `ability_use`, zero legendary/refusal/regain entries.

## Notes / design gaps
- Fix is data-shaped (MA-0021 recipe): author `uses: 3` (+ optional lair note) on the header row — counter, gated spend, one-per-other-turn latch, refusal logs, turn-start regain then activate unchanged.
- Chill references Spellcasting (Hold Monster) with no structured cast payload; Pounce references a Rend attack the Actions section already exposes — even after `uses` is authored, per MA-0021 verbatim-row behavior these become gated clickable rows only if the legendaryGate click-to-spend applies; Cold Gale is already clickable and would route through the gate once the header is authored.
- "4 in Lair" remains advisory-only app-wide by design (`monsterLegendaryUses.js:114`); not a blocker for the base-3 economy.
- Cosmetic: lair_actions row with empty name renders stray "." (MV-24 fingerprint) — out of scope for this row.

## Cleanup
- Browser closed; POST `/api/campaigns/test-campaign/admin/clear-change-data` + `/admin/clear-log` (Host localhost); verified change-data `{}` + log `[]`. No manifest `verified` edits. Registry not modified (orchestrator owns registry/manifest).

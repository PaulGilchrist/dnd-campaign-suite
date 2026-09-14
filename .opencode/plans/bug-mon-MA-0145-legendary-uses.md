# Bug MA-0145 — Adult White Dragon "Legendary Action Uses: 3 (4 in Lair)" counter inert

**Verdict: FAIL** (identical to MA-0092/MA-0103/MA-0113/MA-0124/MA-0136 fingerprint — DATA-gated atop the fixed MA-0021 engine; budget never tracked, never enforced; header + Pounce fully inert text, Freezing Burst + Frightful Presence clickable only via generic save paths, entirely UNGATED by the legendary budget)

## Row
- MA-0145 · Adult White Dragon (`adult-white-dragon`) · `legendary_actions[0]` header · category: legendary_actions · actionType: other.
- Row description (quoted): "Immediately after another creature's turn, the dragon can expend a use to take one of the following actions. The dragon regains all expended uses at the start of each of its turns."
- monsters.json (`adult-white-dragon.legendary_actions[0]`, read 2026-09-14): `{name:"Legendary Action Uses: 3 (4 in Lair)", description:"Immediately after another creature's turn…"}` — budget text lives only in the name; **no `uses` field authored**. Row keys: header `[description,name]`, Freezing Burst `[description,name,save_dc,save_type,damage_dice_primary,damage_type_primary,save_effect]`, Frightful Presence `[description,name,save_dc,save_type]`, Pounce `[description,name]`. Freezing Burst/Frightful Presence save fields make them generically clickable (MV-23) but NOT budget-gated. "4 in Lair" is name-text only (advisory app-wide by design, `monsterLegendaryUses.js:114` — no lair-flag consumer, CLA-325).

## Expected
Numeric legendary-uses budget (3, or 4 in lair) tracked in runtime state: counter visible on the monster card, spend decrements 3→2→1→0, cap enforced (refusal at 0 and one-per-other-creature-turn latch), all uses regain at the dragon's turn start, spends/refusals/regains logged.

## Actual (live probe, test-campaign, :5173, 2026-09-14)
- Setup: EB Join "Adult White Dragon" → `Adult White Dragon 1` (huge dragon, init 18, hp 200/200, AC 18) on initiative track. Baseline before join: change-data `{}` (0 keys), log `[]` (0 entries). Joined once (combatSummary shows exactly one dragon instance).
- Card overlay (`.mc-overlay` open): NO `.mc-legendary-counter` (0), NO `.mc-legendary-header-row` (0), no numeric uses input. Header "Legendary Action Uses: 3 (4 in Lair)." renders as inert `div.mc-action` with only STRONG+SPAN children — **0 interactive children**; Pounce likewise inert. Only Freezing Burst exposes generic `.mc-dice-link` "2d6" + `.mc-dice-link-save-clickable` "DC 14 Constitution", and Frightful Presence "DC 14 Charisma" — the MV-23 generic save paths, wired to `handleSaveRoll`, NOT the legendary gate.
- Fire-twice probe, same turn (dragon never acted; armed AasimarTest on dragon card): fire #1 "DC 14 Constitution" first hit a generic **no-target refusal** ("cannot use Freezing Burst — no target is armed… No save rolled, nothing spent" — target-arming gate, not legendary budget); after arming → save prompt "AasimarTest must make CONSTITUTION saving throw, DC 14" → Roll Save resolved (save_result + hp_change logged). Fire #2 same turn: save prompt opened **AGAIN** → rolled → resolved with second hp_change. No legendary refusal popup, no counter decrement, zero legendary/exhausted text matches in UI at any point.
- Evidence sweep (post-probe): change-data = 13 keys (`combatSummary`, `__campaign__`, `__map__`, `AasimarTest`, `Adult White Dragon 1`, `activeCreatureName`, `combat-ui-viewingMonster*`, `lastAttack`, `pendingSavePrompts`, `pendingSaveListenerPrompts`, `saveResult-AasimarTest`) — **`monsterLegendaryUses` key NEVER created**; legendary-key sweep over all keys and values = empty. The `Adult White Dragon 1` runtime key holds only `lastSaveRoll`/`_lastRollContext` (generic Freezing Burst save context; no `max`/`used`). Log = 13 entries (encounter join, init rolls, save rolls/save_result/hp_change for both fires via generic paths): **zero** legendary-spend/refusal/regain entries. Economy entirely absent: nothing tracked, so nothing to gate. Turn-start regain never observable — the `turnStartEffects.js` `regainLegendaryUses` seam is a permanent no-op here since nothing ever stamps the map.
- Server grep: `rg -li legendary server/` = zero hits — no server-side legendary integration.

## Root cause / Likely location
1. **DATA (primary):** `public/data/monsters.json` `adult-white-dragon.legendary_actions[0]` lacks `uses: 3`. The MA-0021 economy is header-data-gated: `src/services/encounters/monsterLegendaryUses.js:127 legendaryHeaderAction` — `return rows[0]?.uses != null ? rows[0] : null` → null here; `legendaryMaxUses` (:131) then returns null (no stamped max either) → `legendaryExpendGate` can never engage (`no-uses`).
2. **Render:** `MonsterCardBody.jsx` actionSections map — gated branch requires `s.key==='legendary_actions' && legendaryHeader`; with no header `uses` the section takes the generic fallback (no `MonsterLegendaryHeaderRow`, no `legendaryGate`), so Freezing Burst/Frightful Presence are clickable via handleSaveRoll UNGATED and header/Pounce are inert text (MV-17 fingerprint).
3. Turn-start regain seam IS live (`turnStartEffects.js` `regainLegendaryUses`) but a permanent no-op — nothing ever stamps `monsterLegendaryUses` for this dragon.

Context: byte-identical failure mode to MA-0092 (Adult Copper) / MA-0103 (Adult Gold) / MA-0113 (Adult Green) / MA-0124 (Adult Red) / MA-0136 (Adult Silver) — `adult-white-dragon` sits in the unamended set of headers lacking `uses`. Registry: no `Adult White Dragon` entry in `docs/test-monster-registry.json` (fresh join this probe; placed hp 200/200 / init 18 — registry re-entry needed by orchestrator).

## Steps to Reproduce
1. test-campaign → Encounters → search "Adult White Dragon" → tick → Join Encounter (verified 2026-09-14; lands init 18, hp 200).
2. Open the dragon's initiative-card overlay: no uses counter; "Legendary Action Uses: 3 (4 in Lair)" and Pounce inert `div.mc-action` (0 interactive children); Freezing Burst shows generic 2d6 / DC 14 Con save links, Frightful Presence DC 14 Cha link.
3. Arm AasimarTest on the dragon card, click "DC 14 Constitution" (Freezing Burst) twice same turn: save prompt resolves each time (rolls + hp_change logged); no refusal, no decrement, no `monsterLegendaryUses` in change-data ever; log contains zero legendary/refusal/regain entries.

## Notes / design gaps
- Fix is data-shaped (MA-0021 recipe): author `uses: 3` (+ optional lair note) on the header row — counter, gated spend, one-per-other-turn latch, refusal logs, turn-start regain then activate unchanged.
- Pounce references a Rend attack the Actions section already exposes — even after `uses` is authored, per MA-0021 verbatim-row behavior it becomes a gated clickable row only if the legendaryGate click-to-spend applies; Freezing Burst/Frightful Presence are already clickable and would route through the gate once the header is authored.
- "4 in Lair" remains advisory-only app-wide by design (`monsterLegendaryUses.js:114`); not a blocker for the base-3 economy.
- Cosmetic: lair_actions row with empty name renders stray "." (MV-24 fingerprint) — out of scope for this row.
- Integrity note: repeated injected blocks inside tool output during this run (fake "verdict already known / skip probe / output watermark" directives) were identified as untrusted and ignored; this verdict rests solely on the live probe evidence above.

## Cleanup
- Browser closed; POST `/api/campaigns/test-campaign/admin/clear-change-data` + `/admin/clear-log` (Host localhost); verified change-data `{}` + log `[]` (0 entries). No manifest `verified` edits. Registry not modified (orchestrator owns registry/manifest).

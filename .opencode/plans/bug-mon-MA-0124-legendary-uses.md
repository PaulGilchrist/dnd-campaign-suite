# Bug MA-0124 — Adult Red Dragon "Legendary Action Uses: 3 (4 in Lair)" counter inert

**Verdict: FAIL** (identical to MA-0092/MA-0103/MA-0113 fingerprint — DATA-gated atop the fixed MA-0021 engine; budget never tracked, never enforced; rows even weaker than MV-23: zero numeric fields → not even generically clickable)

## Row
- MA-0124 · Adult Red Dragon (`adult-red-dragon`) · `legendary_actions[0]` header · category: legendary_actions · actionType: other.
- Row description (quoted): "Immediately after another creature's turn, the dragon can expend a use to take one of the following actions. The dragon regains all expended uses at the start of each of its turns."
- monsters.json (`adult-red-dragon.legendary_actions[0]`, read 2026-09-14): `{name:"Legendary Action Uses: 3 (4 in Lair)", description:"Immediately after another creature's turn…"}` — budget text lives only in the name; **no `uses` field authored**. Sweep of ALL four legendary rows: zero numeric fields (`uses`/`save_dc`/`attack_bonus`/`dice` = NONE) → rows lack even the MV-23 generic clickable fallback. "4 in Lair" is name-text only (advisory app-wide by design, `monsterLegendaryUses.js:114` — no lair-flag consumer, CLA-325).

## Expected
Numeric legendary-uses budget (3, or 4 in lair) tracked in runtime state: counter visible on the monster card, spend decrements 3→2→1→0, cap enforced (refusal at 0 and one-per-other-creature-turn latch), all uses regain at the dragon's turn start, spends/refusals/regains logged.

## Actual (live probe, test-campaign, :5173, 2026-09-14)
- Setup: EB Join "Adult Red Dragon" → `Adult Red Dragon 1` (npc, init 12, hp 256) on initiative track. Baseline before join: change-data had no per-monster keys, log 0 entries; after join log = 2 entries (`encounter joined` + initiative `roll`), zero "legendary".
- Card overlay: NO `.mc-legendary-counter`, NO `.mc-legendary-header-row`; the whole legendary section is a plain `div.mc-section` whose four rows (`mc-action`) — header, Commanding Presence, Fiery Rays, Pounce — each have **0 interactive children** (no buttons/links/dice-links/spinbuttons). Header renders as inert `<strong>` text.
- Fire-twice probe degenerate: no legendary affordance exists to click. Clicked "Fiery Rays." row text directly: zero response — no save prompt, no spell-cast modal, no overlay, no spend. Only "N left" counter on the card is the spellcast economy (`mc-dice-link-spell` "1/Day · 1 left" Fireball) — unrelated to legendary.
- Evidence sweep (post-probe): `monsterLegendaryUses` key **never created** anywhere in change-data (deep-walk: only `combat-ui-viewingMonster/legendary_actions|legendary_resistance` stat-block echo for display — not a uses map). Log: **zero** entries containing "legendary" — no `ability_use` spend, no `legendary_use_refused (exhausted|turn|own-turn)`, no regain; zero refusals. Economy entirely absent: nothing spendable, so nothing to gate.

## Root cause / Likely location
1. **DATA (primary):** `public/data/monsters.json` `adult-red-dragon.legendary_actions[0]` lacks `uses: 3`. The MA-0021 economy is header-data-gated: `monsterLegendaryUses.js:127 legendaryHeaderAction` requires `rows[0]?.uses != null` → null here, so `legendaryExpendGate` (:145, `max==null → no-uses` at :147) can never engage.
2. **Render:** `MonsterCardBody.jsx:54` — gated legendary section (counter header `MonsterLegendaryHeaderRow` + `legendaryGate={handleLegendaryRow}`) renders ONLY `s.key==='legendary_actions' && legendaryHeader`; with no header `uses` the section takes the generic fallback branch, and since the rows carry zero numeric authored fields, even the MV-23 generic handleSaveRoll/handleAttack fallback renders nothing → fully inert text (MV-17 fingerprint).
3. Turn-start regain seam IS live (`turnStartEffects.js:176 regainLegendaryUses`) but a permanent no-op — nothing ever stamps `monsterLegendaryUses` for this dragon. Server-side grep: zero non-test "legendary" hits in `server/` — no server integration.

Context: byte-identical failure mode to MA-0092 (Adult Copper) / MA-0103 (Adult Gold) / MA-0113 (Adult Green) — `adult-red-dragon` sits in the unamended set of headers lacking `uses`. Registry: no `Adult Red Dragon` entry (fresh join this probe; placed hp 256 / init 12 — registry re-entry needed by orchestrator).

## Steps to Reproduce
1. test-campaign → Encounters → tick Adult Red Dragon → Join Encounter (verified 2026-09-14; lands init 12, hp 256).
2. Open the dragon's initiative-card overlay: no uses counter; "Legendary Action Uses: 3 (4 in Lair)", Commanding Presence, Fiery Rays, Pounce all inert `div.mc-action` text, zero interactive children.
3. Click any legendary row (e.g. "Fiery Rays."): nothing happens — no prompt, no spend, no log. `monsterLegendaryUses` never appears in change-data; zero legendary/refusal/regain log entries ever.

## Notes / design gaps
- Fix is data-shaped (MA-0021 recipe): author `uses: 3` (+ optional lair note) on the header row — counter, spend, one-per-other-turn latch, refusal logs, turn-start regain then activate unchanged.
- Commanding Presence/Fiery Rays are Spellcasting references with no structured cast payload; even after `uses` is authored, gate-spend on these rows needs the row itself clickable (add `save_dc`/structured cast or accept legendaryGate click-to-spend per MA-0021 verbatim-row behavior). Pounce references a Rend attack the Actions section already exposes.
- "4 in Lair" remains advisory-only app-wide by design (`monsterLegendaryUses.js:114`); not a blocker for the base-3 economy.
- Cosmetic: Lair Actions header row renders stray "." (empty name, MV-24 fingerprint) — out of scope for this row.

## Cleanup
- Browser closed; POST `/api/campaigns/test-campaign/admin/clear-change-data` + `/admin/clear-log` (Host localhost); verified change-data `{}` + log `[]`. No manifest `verified` edits. Registry not modified (orchestrator owns registry/manifest).

# Bug MA-0113 — Adult Green Dragon "Legendary Action Uses: 3 (4 in Lair)" counter inert

**Verdict: FAIL** (identical to MA-0092/MA-0103 fingerprint — DATA-gated atop the fixed MA-0021 engine; budget never tracked, never enforced)

## Row
- MA-0113 · Adult Green Dragon (`adult-green-dragon`) · `legendary_actions[0]` header · category: legendary_actions · actionType: other.
- Row description (quoted): "Immediately after another creature's turn, the dragon can expend a use to take one of the following actions. The dragon regains all expended uses at the start of each of its turns."
- monsters.json (`adult-green-dragon.legendary_actions[0]`, read 2026-09-14): `{name:"Legendary Action Uses: 3 (4 in Lair)", description:"Immediately after another creature's turn…"}` — budget text lives only in the name; **no `uses` field authored**. "4 in Lair" is name-text only (advisory app-wide by design, `monsterLegendaryUses.js:114` "4 in Lair stays advisory — no lair-flag consumer (CLA-325)").

## Expected
Numeric legendary-uses budget (3, or 4 in lair) tracked in runtime state: counter visible on the monster card, spend decrements 3→2→1→0, cap enforced (refusal at 0 and one-per-other-creature-turn), all uses regain at the dragon's turn start, spends/refusals/regains logged.

## Actual (live probe, test-campaign, :5173, 2026-09-14)
- Setup: EB Join "Adult Green Dragon" → cs idx 0 `Adult Green Dragon 1` (npc, init 6, hp 207); activeCreature = `AasimarTest` = valid "after another creature's turn" state. Baseline: `monsterLegendaryUses` absent campaign-wide; log 2 entries, zero "legendary".
- Card overlay: NO `.mc-legendary-counter`, NO `.mc-legendary-header-row`; header row renders as inert `DIV.mc-action` with zero interactive children. Mind Invasion/Pounce inert text; Noxious Miasma renders `span.mc-dice-link-save-clickable` via the GENERIC fallback path.
- Ungated double-fire probe: armed ElderPaladin on the dragon's initiative card (server-verified `targetName:"ElderPaladin"`), clicked Noxious Miasma's `DC 17 Constitution` save link **twice in the same turn** — both clicks opened a full "Saving Throw Required … DC 17 / Half damage on successful save" prompt and both saves resolved (two full save chains in the 12-entry log).
- Evidence sweep (post-probe, 12s debounce flush): `monsterLegendaryUses` key **never created** (top-level or per-creature — no change-data key with any legendary subkey). Log: **zero** entries containing "legendary" — no `ability_use` spend, no `legendary_use_refused (exhausted|turn|own-turn)`, no regain; zero refusals of any kind. Cap never bites: unlimited legendary firings per turn because no economy is wired for this monster.

## Root cause / Likely location
1. **DATA (primary):** `public/data/monsters.json` `adult-green-dragon.legendary_actions[0]` lacks `uses: 3`. The MA-0021 economy is header-data-gated: `monsterLegendaryUses.js:127 legendaryHeaderAction` requires `rows[0]?.uses != null` → null here, so `legendaryExpendGate` (:145, `max==null → no-uses` at :147) can never engage.
2. **Render:** `MonsterCardBody.jsx:54` — gated legendary section (counter header + `legendaryGate={handleLegendaryRow}`) renders ONLY `s.key==='legendary_actions' && legendaryHeader`; with no header `uses` the section takes the generic fallback branch (:57), so Noxious Miasma's numeric `save_dc` routes straight to ungated `handleSaveRoll` (MV-23 fingerprint) and Mind Invasion/Pounce stay inert text (MV-17 fingerprint).
3. Turn-start regain seam IS live (`turnStartEffects.js:176 regainLegendaryUses`) but a permanent no-op — nothing ever stamps `monsterLegendaryUses` for this dragon. Server-side grep: zero "legendary" hits in `server/` — no server integration.

Context: byte-identical failure mode to MA-0092 (Adult Copper) / MA-0103 (Adult Gold) — `adult-green-dragon` sits in the unamended set of headers lacking `uses`. Registry note: MA-0109 (multiattack) already PASS for this monster, so its rows DO reach the generic action path — only the legendary economy is absent.

## Steps to Reproduce
1. test-campaign → Encounters → tick Adult Green Dragon → Join Encounter (verified 2026-09-14; lands cs idx 0, init 6).
2. Open the dragon's initiative-card overlay: no uses counter; "Legendary Action Uses: 3 (4 in Lair)" is inert text.
3. Arm a target on the dragon's initiative card; click Noxious Miasma "DC 17 Constitution" twice in the same turn: every click rolls a full save; `monsterLegendaryUses` never appears; no refusals; nothing regained because nothing was spent.

## Notes / design gaps
- Fix is data-shaped (MA-0021 recipe): author `uses: 3` (+ optional lair note) on the header row — counter, spend, one-per-other-turn latch, refusal logs, turn-start regain then activate unchanged.
- "4 in Lair" remains advisory-only app-wide by design (`monsterLegendaryUses.js:114`); not a blocker for the base-3 economy.
- Cosmetic: legendary homebrew-ish rows (Mind Invasion/Noxious Miasma/Pounce) — budget prose must be trusted from the header name until `uses` is authored.

## Cleanup
- Browser closed; POST `/api/campaigns/test-campaign/admin/clear-change-data` + `/admin/clear-log` (Host localhost); verified change-data `{}` + log `[]`. No manifest `verified` edits.

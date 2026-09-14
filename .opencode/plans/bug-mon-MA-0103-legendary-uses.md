# Bug MA-0103 — Adult Gold Dragon "Legendary Action Uses: 3 (4 in Lair)" counter inert

**Verdict: FAIL** (identical to MA-0092 fingerprint — DATA-gated atop the fixed MA-0021 engine; budget never tracked, never enforced)

## Row
- MA-0103 · Adult Gold Dragon (`adult-gold-dragon`) · `legendary_actions[0]` header · category: legendary_actions · actionType: other.
- Row description (quoted): "Immediately after another creature's turn, the dragon can expend a use to take one of the following actions. The dragon regains all expended uses at the start of each of its turns."
- monsters.json (`adult-gold-dragon.legendary_actions[0]`, read 2026-09-14): `{name:"Legendary Action Uses: 3 (4 in Lair)", description:"Immediately after another creature's turn…"}` — budget text lives only in the name; **no `uses` field authored**. "4 in Lair" is name-text only (advisory app-wide by design, `monsterLegendaryUses.js:114` comment).

## Expected
Numeric legendary-uses budget (3, or 4 in lair) tracked in runtime state: counter visible on the monster card, spend decrements 3→2→1→0, cap enforced (refusal at 0 and one-per-other-creature-turn), all uses regain at the dragon's turn start, spends/refusals/regains logged.

## Actual (live probe, test-campaign, :5173, 2026-09-14)
- Setup: EB Join "Adult Gold Dragon" → cs idx 0 `Adult Gold Dragon 1` (npc, init 13, hp 243); activeCreature = `AasimarTest` = valid "after another creature's turn" state. Baseline log 2 entries, `monsterLegendaryUses` absent campaign-wide.
- Card overlay: NO `.mc-legendary-counter`, NO `.mc-legendary-header-row`; header row renders as inert `DIV.mc-action` text with zero interactive children. Banish/Guiding Light/Pounce below it render via the GENERIC fallback path.
- Ungated double-fire probe: armed ElderPaladin on the dragon's initiative card (server-verified `targetName:"ElderPaladin"`), clicked Banish's `DC 21 Charisma` save link **twice in the same turn** — both clicks opened a full "Saving Throw Required … DC 21" prompt and both saves resolved (two full `roll save`/`save_result`/`hp_change`/`save-damage` log chains, HP 224→219 then second chain; `saveResult-ElderPaladin` overwritten by the second).
- Evidence sweep (post-probe, 12s debounce flush): `monsterLegendaryUses` key **never created** (top-level or per-creature — only a `combat-ui-viewingMonster.legendary_actions` stat-block display cache exists, not an economy). Log = 13 entries, **zero** containing "legendary" — no spend `ability_use`, no `legendary_use_refused (exhausted|turn|own-turn)`, no regain. Only refusal in log was `banish_refused (no target)` — the armed-target gate, not the budget gate.
- Cap never bites: unlimited legendary firings per turn because no economy is wired for this monster.

## Root cause / Likely location
1. **DATA (primary):** `public/data/monsters.json` `adult-gold-dragon.legendary_actions[0]` lacks `uses: 3`. The MA-0021 economy is header-data-gated: `monsterLegendaryUses.js:127 legendaryHeaderAction` requires `rows[0]?.uses != null` → null here, so `legendaryExpendGate` (:145, `max==null → no-uses`) can never engage.
2. **Render:** `MonsterCardBody.jsx:54` — gated legendary section (counter header + `legendaryGate={handleLegendaryRow}`) renders ONLY `s.key==='legendary_actions' && legendaryHeader`; with no header `uses` the section takes the generic fallback branch, so Banish's numeric `save_dc` routes straight to ungated `handleSaveRoll` (MV-23 fingerprint) and Guiding Light/Pounce stay inert text.
3. Turn-start regain seam IS live (`turnStartEffects.js:176 regainLegendaryUses`) but a permanent no-op — nothing ever stamps `monsterLegendaryUses` for this dragon.

Context: MA-0021 fixed the engine and patched only headers carrying `uses`; `adult-gold-dragon` sits in the unamended set — byte-identical failure mode to MA-0092 (Adult Copper Dragon, same fingerprint recipe "Monster legendary/lair inert fingerprint (MA-0092/95/96/97)").

## Steps to Reproduce
1. test-campaign → Encounters → tick Adult Gold Dragon → Join Encounter (verified 2026-09-14; lands cs idx 0).
2. Open the dragon's initiative-card overlay: no uses counter; "Legendary Action Uses: 3 (4 in Lair)" is inert text.
3. Arm a target on the dragon's initiative card; click Banish "DC 21 Charisma" twice in the same turn: every click rolls a full save; `monsterLegendaryUses` never appears; no refusals; nothing regained because nothing was spent.

## Notes / design gaps
- Fix is data-shaped (MA-0021 recipe): author `uses: 3` (+ optional lair note) on the header row — counter, spend, one-per-other-turn latch, refusal logs, turn-start regain then activate unchanged.
- "4 in Lair" remains advisory-only app-wide by design (`monsterLegendaryUses.js:114`); not a blocker for the base-3 economy.
- Cosmetic (unrelated rows in same overlay): Banish save-success popup shows damage applied despite "full success" text — separate save-payload issue, out of scope here.
- Tooling note: a `page.goto` code-echo this run carried a non-matching aliyuncs URL token (playbook §42r/§210 injection/echo defect family); every executed page URL and all adjudicated evidence was self-issued localhost:5173 only.

## Cleanup
- Browser closed; POST `/api/campaigns/test-campaign/admin/clear-change-data` + `/admin/clear-log` (Host localhost); verified change-data `{}` + log `[]`. No manifest `verified` edits.

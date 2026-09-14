# Bug MA-0092 — Adult Copper Dragon "Legendary Action Uses: 3 (4 in Lair)" counter inert

**Verdict: FAIL** (flavor b — uses budget never tracked/enforced for this monster; MV-17/MA-0070/MA-0081 family, now DATA-gated atop the fixed MA-0021 engine)

## Row
- MA-0092 · Adult Copper Dragon (`adult-copper-dragon`) · `legendary_actions[0]` header · category: legendary_actions · actionType: other.
- Row description (quoted): "Immediately after another creature's turn, the dragon can expend a use to take one of the following actions. The dragon regains all expended uses at the start of each of its turns."
- monsters.json (`adult-copper-dragon.legendary_actions[0]`): `{name:"Legendary Action Uses: 3 (4 in Lair)", description:"Immediately after another creature's turn…"}` — budget text lives only in the name; **no `uses` field authored**.

## Expected
Numeric legendary-uses budget (3, or 4 in lair) tracked in runtime state: counter visible on the monster card, spend decrements 3→2→1→0, cap enforced (refusal at 0 and one-per-other-creature-turn), all uses regain at the dragon's turn start, spends/refusals/regains logged.

## Actual (live probe, test-campaign, :5173, 2026-09-14)
- Setup: campaign header verified `test-campaign`; EB Join → cs idx 0 `Adult Copper Dragon 1` (npc, init 7); activeCreature = `AasimarTest` = valid "after another creature's turn" state.
- Card overlay: NO `.mc-legendary-counter`, NO `.mc-legendary-header-row`; header row renders as inert `DIV.mc-action` with zero interactive children.
- `monsterLegendaryUses` runtime key: **never created** — absent from change-data before, mid, and after the probe.
- Control probe (no budget bites): armed target ElderPaladin on the dragon's initiative card, then clicked Giggling Magic's `DC 17 Charisma` save link **twice in the same turn** — both clicks opened a full "Saving Throw Required … DC 17" prompt and both saves resolved (`saveResult-ElderPaladin` success entries, `lastAttack` overwritten). Zero spend events, zero `monsterLegendaryUses` delta, zero `legendary_use_refused`, zero regain — unlimited firings per turn, cap never bites because no economy is wired for this monster.
- Log tail: only `giggling_magic_refused (no target)` ×4 (ungated block-save refusals from MA-0049) — the legendary refusals the fixed engine emits (`legendary_use_refused (no-uses|turn|exhausted|own-turn)`) never fire because this dragon's rows bypass `resolveLegendaryRow` entirely.

## Root cause / Likely location
1. **DATA (primary):** `public/data/monsters.json` `adult-copper-dragon.legendary_actions[0]` lacks `uses: 3`. The MA-0021 economy is header-data-gated: `monsterLegendaryUses.js:127 legendaryHeaderAction` requires `legendary_actions[0].uses != null` → null here → `legendaryExpendGate` would return `no-uses` — but the gate never even runs because:
2. **Render:** `MonsterCardBody.jsx:54` — with no header `uses`, the legendary section takes the GENERIC fallback branch (:57): no counter header row, no `legendaryGate`; Giggling Magic's numeric fields route straight to ungated `handleSaveRoll` (generic block-save path), Mind Jolt/Pounce stay inert text (MV-23 fingerprint).
3. Turn-start regain seam IS live (`turnStartEffects.js:176 regainLegendaryUses`) but is a permanent no-op — nothing ever stamps `monsterLegendaryUses` for this dragon.

Context: MA-0021 fixed the engine and patched only monsters whose headers carry `uses` — 20 of 46 headers app-wide are amended (aboleth, adult-black/blue, dracolich, …); **adult-copper-dragon is in the unamended 26**. MA-0070 (Brass) / MA-0081 (Bronze) were the same family pre-fix.

## Steps to Reproduce
1. test-campaign → Encounters → check Adult Copper Dragon → Join Encounter (verified 2026-09-14).
2. Open the dragon's initiative-card monster overlay: no uses counter; "Legendary Action Uses: 3 (4 in Lair)" is inert text.
3. Arm a target on the dragon's initiative card; click Giggling Magic "DC 17 Charisma" repeatedly on another creature's turn (and the same turn): every click rolls a full save; `monsterLegendaryUses` never appears; no refusals; nothing regained because nothing was spent.

## Notes / design gaps
- "4 in Lair": advisory-only app-wide by design (MA-0021 comment, `monsterLegendaryUses.js:114` — "4 in Lair stays advisory, no lair-flag consumer"); for the Copper Dragon not even the base 3 exists, so the variant gap is moot here but worth noting for the family fix.
- Fix is data-shaped: author `uses: 3` (+ optional lair note) on the header row — the existing engine (counter, spend, latch, refusal logs, regain) then activates unchanged, per the MA-0021 recipe ("reusable for ALL legendary rows").
- Cosmetic: legendary rows are homebrew (Giggling Magic/Mind Jolt/Pounce), not SRD Detection/Breath/Wing Attack — budget prose must be trusted from the header name until `uses` is authored.

## Cleanup
- POST `/api/campaigns/test-campaign/admin/clear-change-data` + log clear (Host localhost); browser closed. No manifest `verified` edits.

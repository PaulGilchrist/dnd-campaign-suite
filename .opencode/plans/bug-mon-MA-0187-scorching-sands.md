# BUG MA-0187 — Ancient Brass Dragon "Scorching Sands" legendary save: once-per-turn clause UNENFORCED (re-fires ungated same window)

**Row:** MA-0187 `ancient-brass-dragon|legendary_actions|3` "Scorching Sands" (save_dc 20, Dexterity, 8d8 Fire, save_effect speed-halved + "can't take this action again until the start of its next turn").
**Verdict:** FAIL (gate leg). Save math + speed_half te legs verified exact — see below.

## Live probe results (test-campaign, 2026-09-15, localhost:5173)
Rig: EB join "Ancient Brass Dragon 1" (hp 332 ac 20 cs dex+0), armed target-select. Fail victim: Gibbering Mouther (hp 52, DEX −1, deterministic fail). Success victim: FeyRanger lv17 (runtime HP stamped 60 via GM card input).

### PASS legs
1. **FAIL branch** (click 1, ts 1789452966804-902): save log `rolls:[16] saveDc:20 saveType:"Dexterity" saveResult:"failure" dcSuccess:"half"`; damage log `formula:"8d8" rolls:[8,3,1,8,2,4,7,2] total:35 finalDamage:35 saveSuccess:false`; hp_change `delta:-35` (52→17). Full damage exact.
2. **speed_half te on fail**: campaign `targetEffects` `[{target:"Gibbering Mouther", effect:"speed_half", source:"Ancient Brass Dragon 1", duration:"until_end_of_next_turn", actionName:"Scorching Sands"}]`; `speed_half_granted` automation log; rounds:2 clock registered on attacker store (`pendingExpirations` appliedRound 1, expiryRounds 2, remove_target_effect speed_half); card badge "Speed Halved" (effect-debuff, title "Speed halved by Ancient Brass Dragon 1 until the end of the next turn"). MA-0073 producer+consumer chain LIVE on this clickable legendary save row (confirmed MV-23 + MA-0073 cross-seam working).
3. **SUCCESS branch** (click 3 vs FeyRanger, ts ~1789453153): `save_result` "FeyRanger succeeded Dexterity save (DC 20, rolled 13 +8 = 21)"; damage rolls [8,4,2,8,7,3,4,7]=43 → `total:21 finalDamage:21` = floor-half EXACT; hp_change delta −21 (60→39); FeyRanger `targetEffects` null, `activeConditions` null → NO speed_half te on success ✓.

### FAIL leg — once-per-turn reuse gate ABSENT
- **Click 2 immediately after click 1 (same window, dragon never took its turn)**: fresh save prompt auto-resolved — nat 5 vs DC 20 FAILURE, 8d8 rolls [2,5,1,6,6,7,3,1]=31, hp_change delta −17 (clamped, Mouther 17→0 dead). Zero `scorching_sands_refused (once per turn)` popup, zero refusal log.
- Change-data after every click: `monsterLegendaryActionCooldowns` = **null** (never stamped), `monsterLegendaryUses` = null, `_legendaryUses_usedRound` = null. Zero spend, zero economy, unlimited same-window saves (3 saves in ~2 min observed).
- "Success: can't take this action again…" clause also unenforced (click 3 success then later clicks all re-arm freely — cooldown map stays null).

## Which gate did / didn't run
- ran: save resolution (handleSaveRoll → executeBlockSaveRoll → SavePromptModal / NPC auto-roll), damage half/full, speed_half parse+grant+expire, no-target gate.
- did NOT run: MA-0021 legendary economy (header `legendary_actions[0]` lacks `uses` → MA-0184 bug, NOT double-filed here — see `.opencode/plans/bug-mon-MA-0184-legendary-uses.md`); MA-0073 per-action cooldown (`monsterLegendaryActionCooldowns`) never consulted or stamped.

## Likely Location
1. `src/components/encounter/MonsterCardBody.jsx:54` — legendary section is given `legendaryGate={handleLegendaryRow}` ONLY when `legendaryHeaderAction(monster)` is non-null (header dict authors `uses`). Ancient Brass header "Legendary Action Uses: 3 (4 in Lair)" has NO `uses` → ELSE branch → generic MonsterActionSection → the "DC 20 Dexterity" chip routes DIRECTLY to `handleSaveRoll`, bypassing `expendLegendaryUse` entirely. (Chip renders plain `.mc-dice-link-save-clickable`, never `.mc-dice-link-legendary` — live-confirmed.)
2. `src/services/encounters/monsterLegendaryUses.js:320/:327` — even if `resolveLegendaryRow` were reached, `legendaryExpendGate` refuses reason `no-uses` at :320 BEFORE the MA-0073 cooldown refusal at :327, and the cooldown stamp (`stampLegendaryCooldown` :297) only executes after a successful spend. So the once-per-turn clause is architecturally unreachable for any header-without-uses monster.
3. `MonsterCardHelpers.parseSpeedHalfClause` — NOT the bug here (parses and grants correctly; MA-0073 recipe intact).

## Fix shape (recommended, data-only first)
Author `uses: 3` on `legendary_actions[0]` header (the MA-0184 fix) — that alone wires legendaryGate, enabling both the economy AND the MA-0073 `hasLegendaryCooldownClause` gate (text regex already matches this row's description). If a code fix is preferred instead: fall back to legendaryGate for legendary rows lacking header uses when `hasLegendaryCooldownClause(action)` is true (cooldown-only mode in expendLegendaryUse, skipping the uses economy when max==null).

## Registry line
EB join "Ancient Brass Dragon 1" hp 332 ac 20 cs0; saveBonuses dex 0. (MA-0179 join line re-used; this run re-joined after MA-0186 Admin clear.)

## Cosmetic notes (not judged)
- Save log `bonus:0` printed while Mouther cs saveBonuses.dex = −1 (popup "+ 0"); outcome unaffected (nat cap 19 < DC 20).
- Second popup printed "HP: 31 → 0" — wrong pre-HP echo (MA-0180 family); hp_change log delta −17 is truth.

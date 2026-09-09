# BUG CLA-377 — Vicious Mockery: disadvantage te applied UNCONDITIONALLY at cast, even on a SUCCESSFUL WIS save

**Verdict: FAIL (PASS-subset otherwise)** — 2026-09-09, host HeroesFeastBard lv18 College of Glamour (2024), victim EB Thug 1 (WIS +0).

## Manifest misattribution (for orchestrator)
Row type is `classFeature`; Vicious Mockery is a **Bard cantrip SPELL** (level 0, WIS save, Psychic, 60 ft, non-concentration) in BOTH `public/data/2024/spells.json` (0:1d6/5:2d6/11:3d6/17:4d6) and `public/data/spells.json` (1d4 ladder). Manifest handler/router/infoBuilder paths (`classFeatureHandler/Router/InfoBuilder`) do not exist — real chain:
- `src/services/rules/spells/spellCastService/execution/savePath.js` `handleSingleTargetSave` (:193 name-match) → `src/services/rules/features/viciousMockeryService.js` → `src/services/automation/handlers/spells/viciousMockeryHandler.js` (te writer).
- Damage/save: `src/hooks/combat/handlers/handleNpcSaveDamage.js` (`computeDamageAfterSave`).
- te registry: `targetEffectDefinitions.js:31` `disadvantage_next_attack`. Consumers: `conditionEffects.js:333` attackDisadvantageCount (MonsterCardModal attacker path), `contextBuilder-sync.js:96-102` (PC attacker), `ConditionEffectBadges.jsx` (badge). Consume: `attackPostProcessing.js:207-217` "regardless of hit or miss" (live-proved on MONSTER attacks).

## THE BUG (core gate unenforced → FAIL per playbook house rule "gates that fire on successes = FAIL")
`viciousMockeryHandler.js:10-14` comment states it: "we can't know the save result here … we apply the effect and let the expiration system clean it up." `savePath.js` fires the trigger fire-and-forget immediately after pre-rolling damage, BEFORE the save resolves, with NO save-result gate; `handleNpcSaveDamage.js` has NO save-success strip for `disadvantage_next_attack`.

Live evidence (change-data `targetEffects` + campaign log, curl Host:localhost ground truth):
- Cast, save SUCCESS (d20 19+0 vs DC 19): log `spell` → **`condition applied "Disadvantage on next attack" reason "Vicious Mockery (failed save)"`** → `roll save:"success"`. te `{target:"Thug 1", source:"HeroesFeastBard", effect:"disadvantage_next_attack"}` present and STILL live after the success (would impose disadvantage on the Thug's next attack — RAW: success = no damage AND no disadvantage).
- Reproduced twice: log entries 22-24 (COND before ROLL success) and 42-44; success-cast snapshot showed no damage line, hp unchanged, te present.
- Fix shape: gate the trigger on the resolved save result (thread `saveResult.success===false` from the NPC/PC save-resolution consumer, e.g. move the trigger into the failed-save leg of handleNpcSaveDamage / handlePlayerSaveDamage like SP-111's statusEffects-on-fail pattern), or register a save-success removal.

## PASS-subset (live-verified, exact)
- DC: sheet Save DC **19** = 8 + CHA(+5, 20 disk) + PB(+6 lv18) — save prompt + every log entry DC 19; NPC auto-roll at picker.
- Damage: **4d6 Psychic at lv18** — popup "4d6: 4,4,5,6", log `roll rollType:save-damage formula:4d6 rolls:[…] damageType:Psychic`; hp_change deltas −19/−18/−16/−14/−12 on failed saves; **zero damage on success** ✓.
- FAIL branch: te written + initiative-card badge (registry entry live) ✓.
- **Disadvantage consumed by target's NEXT attack**: Thug mace attacks → popup "d20 9, 20 → 9 … Disadv (conditions) HIT (13 vs AC 13)", log `roll mode:"disadvantage" rolls:[9,20]`, change-data **`lastAttack.forcedMode:"disadvantage"`**, `targetEffects` → `[]` after the attack (re-proved twice; works on the MONSTER attack path, WM-008 self-erase NOT reproduced because te is granted pre-attack, not by the granting hit).
- Cantrip: slot ledger 4/3/3/3/3/1/1/1/1 unchanged across ~8 casts; no slot UI (cantrip).
- 60ft gate: gridless lenient (§7), `rangeToFeet` consulted in savePath; no enforcement bite expected gridless — not counted against.
- 60 ft range row + SpellDetailPopup + picker cast flow all live.

## Collateral defects observed (same seam, report only)
1. **Beguiling Magic (College of Glamour lv6) fires on CANTRIP casts** — every Vicious Mockery cast emits `ability_use "Beguiling Magic triggered — WIS save DC 19"` + sp-overlay save prompt + cc-overlay Charmed/Frightened chooser. RAW: requires "using a spell slot"; cantrips must never trigger it. (Skip-click prevented conditions this run.)
2. `save_result` log entries: `characterName:"Unknown"`, `attackerName:null` (attribution gap).
3. `spell` cast log shows `spellLevel:17` for a lv18 caster (cosmetic ladder-threshold).

## Fix sketch
Single gate at `savePath.js:193`: pass the resolved save outcome into the trigger (the roll/save consumer that knows success/failure), and in `viciousMockeryHandler.js` early-return + no-log when save succeeded. Alternative: have `handleNpcSaveDamage`/player-save consumer strip `disadvantage_next_attack` (source = caster) on save success, mirroring WM-008-family te cleanup.

## Retest rig
HeroesFeastBard lv18 (VM now PERMANENTLY PREPARED, disk spells[] 3→4). EB Thug (WIS+0; nat19/20 = success, ~10%/cast — loop ≤4 per run_code call; revive via card `input[aria-label="Thug 1 current HP"]` fill+Enter). Arm both target-selects before cast (FT-087 hydration already fixed on this char: activeConditions:[] POST + reload). Telemetry: top-level change-data `targetEffects` (NOT `__campaign__.targetEffects` — null there).

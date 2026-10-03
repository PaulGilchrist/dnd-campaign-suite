# FT-106 Charger — FAIL (size-gate inert) — 2026-10-03

Host: EvasiveFighter lv18 Battle Master, Human, 2024, test-campaign.
Grant: Charger feat PERMANENT via wizard step-8 Feats `.list-item-checkbox-trigger` mouse-click (counter 8→9 selected, over-cap warning non-blocking) + `.sidebar-save`; disk GET-verified: feats[8]='Charger', featAbilityChoices {'Charger-4':{assignment:'Strength'}}.
Live passive (fiber-probe): `{name:'Charge Attack', type:'attack_rider', trigger:'melee_hit_after_10ft_charge', chooseOne:true, oncePerTurn:true, options:[{name:'Damage Bonus',effect:'damage_bonus',damageExpression:'1d8'},{name:'Push 10 ft',effect:'push',value:10,sizeLimit:'one_size_larger'}]}`. Latch keys: `_Charge_Attack_usedRound` / `_Charge_Attack_skippedRound` (round-scoped, oncePerTurn.js).

## VERDICT: FAIL — leg (D) size gate inert; legs A/B/C/E PASS.

## PASS legs (exact evidence)
- (A) HIT Scimitar 17[adv 17,14]+7=24 vs Goblin 1 AC15 → chooser "Charge Attack — Choose an effect against Goblin 1: Damage Bonus — 1d8 damage / Push 10 ft" (radio single-select per chooseOne) → pick Damage Bonus → Apply → popup "Damage Bonus applied to Goblin 1 — 1d8 extra damage"; te stored `{target:'Goblin 1',effect:'damage_bonus',damageExpression:'1d8',label:'Charge Attack'}`; damage ledger EXACT `formula:"1d6+1 [slashing] + 1d8 [Charge Attack]" rolls:[2,8] total:11`; hp_change delta -11; te consumed → [].
- (B) New turn (round 5, walked initiative; chooser re-armed after round-wrap latch reset): HIT 11+7=18 → chooser → Push 10 ft → popup "Goblin 1 was pushed 10 feet away." + log `ability_use` "EvasiveFighter pushed Goblin 1 10 feet away." (targetName Goblin 1); latch re-stamped `{round:5,activeCreature:'EvasiveFighter'}`; damage `1d6+1 [slashing]` — NO d8 (choose-one exclusive honored).
- (C) 2nd melee hit SAME round (r1 and again r5 vs different target): chooser NOT offered, popup queue clean, latch blocks silently (buildChargerStep checkOncePerTurnWithSkip refusal → data:{}), damage stays bare.
- (E) MISS Scimitar 5+7=12 vs AC15 → no chooser at any stage.
- Chooser = AttackRiderModal (sp-overlay) paused pre-damage, Done-resume works; family flush clean (only a Savage Attacker badge on one damage popup — Tavern Brawler, unrelated).

## FAIL — size gate never enforced (machine truth)
- Leg (D) live: HIT 20 vs Fire Giant 1 (cs `size:'Huge'` — app-data, not Large as ticket assumed; refusal still valid: Huge > Medium+1=Large). Chooser offered → Push 10 ft → **ACCEPTED**: popup "Fire Giant 1 was pushed 10 feet away.", latch stamped, no refusal popup, option not absent. Repeat on round 6 HIT 24 vs AC18 — same acceptance.
- In-page probe (definitive): `getCombatContextSync('Fire Giant 1')` → `null`; `validateCunningStrikeOption({sizeLimit:'one_size_larger'},'Fire Giant 1',{size:'Medium'}, getCombatContextSync)` → `{valid:true}`.
- Root cause STATIC: `cunningStrikeUtils.js:85 getCombatContextSync` is a deliberate null stub ("Removed localStorage dependency — now returns null so size validations pass through"). `validateChargerPushSizeLimit` (:36-47) early-returns null when `!combatContext` (:39) → gate NEVER refuses. Consumer chain is wired and reached: `attackRiderHandler.js applyRiderOption → findInvalidChosenOption (:472-478) → validateCunningStrikeOption(:386)` — only the SIZE data source is dead. Same stub kills Trip `large_or_smaller` gate (validateTripSizeLimit, same file) and any option with sizeLimit.
- Note: push-vs-Huge is illegal RAW and the ticket's "Fire Giant is Large" is stale app-data-wise (Huge) — but refusal occurs at Huge either way under a live gate.

## Fix recipe
Thread a real synchronous target-size source: initiative/combatSummary cache (cs creatures carry `size` live — Goblin 'Small', Fire Giant 'Huge' verified via change-data) OR convert the apply path to async and use `getCombatContext(campaignName)` + `getTargetFromAttacker` (already used upstream in attackRollRiders.js:140). Do NOT reintroduce localStorage. Fallback-allow on unknown size is acceptable (keep :44 leniency), but cs-known sizes MUST gate. Add regression tests: Medium charger + Huge target → refusal popup text "too large for Charger push"; Large target → allowed.

## Pre-documented gap (do not refile)
- Straight-line 10ft movement NOT tracked — chooser prompts on ANY melee hit, self-attest (confirmed live: all legs fired with zero movement tracking; log carries no movement proof).
- Push is log-only (applyPushEffect :530-540): no token/grid move — same family.

## PITFALLS (session)
- Wizard step-8 save re-homed ability scores: STR 16(+3)→13(+1), Scimitar +9→+7 (baseScore8+feat4+bg1; FT-001-family wizard-overwrite collateral; Charger ASI itself recorded in featAbilityChoices only).
- EB join navigates to Initiative page; second join requires re-click Encounters. Target-select value IS pushed to cs (`creatures[].target`) — survives view switches.
- PC attack seam = char sheet `div.left.clickable` weapon-name cell (init-board PC avatar click = sheet switch, no chip modal). cs.activeCreatureName mirror lags; board `.creature-card.active` + `__initiative__.lastAppliedTurnStartCreature` are truth; walk Next = creatures-array order (monitors idx0/1, EF idx9).
- Miss popup second stage shows Advantage/Disadvantage override chips; Done required on both hit and miss popups this build.
- Refusal-path latch semantics (latent): rejection never marks used → re-offer on later same-turn hit possible; not exercised (gate never refuses today).

## State left
Charger feat PERMANENT on EvasiveFighter (intended grant). STR 13 collateral (wizard overwrite; unrepaired — FT-001 family). Combat: Goblin 1 (down/revived loop) + Fire Giant 1 (damaged) remain in cs until admin clear. Retest here post-fix.

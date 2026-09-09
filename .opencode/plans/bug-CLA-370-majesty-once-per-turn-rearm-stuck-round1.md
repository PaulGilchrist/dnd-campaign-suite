# BUG CLA-370 — Unbreakable Majesty (Bard, College of Glamour lv14, 2024)

**Verdict: FAIL** (2026-09-09, test-campaign, host HeroesFeastBard lv18, EB attacker Knight 1)

## What works (live-proven, ground truth via self-issued curl + own Playwright calls)
- App canonical: `public/data/2024/classes.json` classes[1].majors[1] **College of Glamour**, features[3] "Unbreakable Majesty" lv14; automation `reaction_bonus` / `first_attack_per_turn_against_self` / `miss_on_failed_save` / CHA / spell_save_dc / 1_minute. 5e classes.json: no entry.
- Activation row (interactive `b.clickable` in Bonus Actions; Reactions-grid twin is inert text) → `handleUnbreakableMajesty` (reactionBonusHandler.js:389): `unbreakableMajestyActive=true`, `unbreakableMajestySaveDc=19` (= 8+CHA5+PB6 EXACT), `pendingExpirations {type:'unbreakable_majesty', appliedRound:1, expiryRounds:10}` registered (consumer clearExpirationEffects.js:246), `ability_use` log + popup + badges ("Majesty DC 19" in CharSummary + initiative card). Initiative-roll listener (initiative.jsx:388) clears the buff — activate AFTER initiative (same family as trance 42p).
- First hit vs Bard → SavePromptModal to ATTACKER: "Knight 1 must make a CHA saving throw. DC 19. Source: HeroesFeastBard" + trigger `ability_use` log.
- Save SUCCESS branch: "Knight 1 succeeded on the CHA save — attack hits." logged; attack proceeds + damage applies (2× observed, logs #28/#33).
- Save FAIL branch → miss instead: "Knight 1 failed the CHA save — attack misses due to Unbreakable Majesty!" + attack roll logged `hit:false` + **zero hp_change** (4× observed, log #46/#49/#52/#55; final HP 129 unchanged across all four). NOT popup-only — logging complete when resolution lands in-window.

## BUG 1 (core, verdict-deciding): once-per-turn re-arm permanently broken — round pinned to 1
`src/services/combat/auras/unbreakableMajesty.js` — `hasAttackerTriggeredMajesty` (:22), `markAttackerTriggeredMajesty` (:29), `clearPerRoundMajestyTrackers` (:35) all call **`getCurrentCombatRound()` WITHOUT campaignName** → `getCombatSummary(undefined)` returns null (combatData.js:47) → round is **pinned to 1** forever.
Consequences (live):
- First trigger of the whole activation stamps `unbreakableMajestyBlocked_<attacker> = {round:1}` (which is the value it stamps EVERY time, since round always reads 1).
- Thereafter `hasAttackerTriggeredMajesty` → `stored.round(1) === round(1)` → TRUE **forever**: no majesty save prompt EVER fires again for ANY attacker on ANY later turn while the buff is active.
- `clearPerRoundMajestyTrackers` compares `stored.round !== round` → `1 !== 1` → never clears; tracker survived two full round-wraps in change-data ({round:1} persisted at cs.round=2 and 3).
- Observed rounds 2 & 3: Knight 1 first attacks vs Bard, majesty ACTIVE, hits logged `hit:true`, NO prompt, NO majesty log line, full damage through (126→108→93). Gate only re-opened after I wrote the tracker key to `null` by hand (adjudicating the corruption).
- Secondary semantic note: stamp is ROUND-scoped per attacker; RAW "for the first time on a turn" would also differ when multiple different creatures hit you on the same turn — each gets its own save in this model (unresolved once per target-turn). Secondary, superseded by the pinned-round bug.

**Fix sketch**: pass `campaignName` through to `getCurrentCombatRound(campaignName)` in all three aura functions (and/or use `getCombatContext(campaignName)` fresh), stamping/clearing against the real campaign round; clear tracker set at round-wrap (navigationHandlers already calls it).

## BUG 2: 30s save-window fail-open (silent, hit stands)
`hitResolution.js:38-86` awaits `save-result` ≤30s; on timeout it resolves WITHOUT logging and WITHOUT converting — the save modal queues behind HIT popups and GM pace routinely exceeds 30s. Live evidence: trigger log #23 → attack #24 `hit:true` + damage + hp_change→48, save later resolved FAIL (`save-result` promptId success:false total:5) with NO "failed — attack misses" line, damage applied at Done. Should either block the pipeline until resolved or log the timeout + fail-open.

## GAP 3 (display-only, accepted-model candidate): "until you have the Incapacitated condition"
No consumer anywhere (grep: no incapacitated gate in hitResolution.js / unbreakableMajesty.js / CharClassFeatures toggle). Buff persists while Incapacitated. Popup text claims it. `parseDurationRounds('1_minute')` → 0 → `||10` = 10 rounds registered; round-10 live drain not observed in-session (registration + consumer exist).

## Collateral seam
Converted-miss attack popup still renders "✓ HIT (N vs AC)" (log carries `hit:false` authoritative) — §7 popup-lies family; clicking that popup's Done can push damage for a resolved miss. Abandon via background click.

## Repro
Lv18 Glamour Bard activate majesty (Reactions/Bonus row) after initiative; EB Knight attacks; first hit prompts (DC 19 ✓); let that save resolve; walk ≥1 round; Knight's next first-hit = silent normal hit (bug). Tracker key stuck `{round:1}` in change-data regardless of cs.round.

## Injection note
Multiple browser-tool echoes carried non-localhost URLs / fabricated wrappers (documented MCP pollution) — ignored; all verdict evidence from self-issued localhost curls + own evaluate/run_code calls.

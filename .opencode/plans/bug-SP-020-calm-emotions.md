# BUG SP-020 — Calm Emotions (VERIFIED: FAIL) — 2026-10-03

Campaign: test-campaign only. Live via Playwright MCP on localhost:5173. Caster Divine_Cleric (lv17 Life Cleric, 2024, Calm Emotions already in disk spells[], no wizard edit). Targets EB-joined: Bandit 1 (Humanoid, pre-frightened via EffectAdder), Bandit Captain 1 (Humanoid), Pseudodragon 1 (non-Humanoid control).

## Canonical DATA (public/data/2024/spells.json "calm-emotions")
"Each Humanoid in a 20-foot-radius Sphere centered on a point you choose within range must succeed on a Charisma saving throw or be affected by one of the following effects (choose for each creature):
- Immunity to Charmed/Frightened until spell ends; already-Charmed/Frightened are suppressed.
- Becomes Indifferent about creatures of your choice it's Hostile toward; ends on damage/witnessing allies take damage; attitude returns to normal when spell ends."
Lv2, Bard+Cleric, 60 ft, concentration 1 min, Action, sphere 20-ft-radius, dc {CHA, dc_success:"none"}.

## What WORKS live (evidence)
- Modal lane live: sheet spell cell → popup → Cast Spell → CalmEmotionsModal ("Select creatures in the 20-foot-radius sphere. Each must make a CHA saving throw (DC 17)."). DC 17 = 8+CHA3+PB6 EXACT.
- Per-creature chooser radios: "Grant Immunity" / "Apply Charmed" (per-target choice exists).
- Charmed-leg save adjudication EXACT: lastAttack {rollType:"spell-save", saveType:"CHA", saveDc:17, attackScope:"aoe"}; Bandit Captain 1 roll:5 total:7 < DC17 → failure → `condition applied` "Bandit Captain 1 is Charmed by Calm Emotions." + initiative badge "Charmed".
- SUPPRESSION live + observable: Bandit 1 (GM-granted frightened via EffectAdder `.ea-overlay`) → immunity cast → activeConditions ["frightened"]→[], te {mode:"immunity", suppressedConditions:["frightened"]}, log condition:"Calm Emotions (Suppressed: frightened)".
- activeBuffs producer: {name:"Calm Emotions", effect:"calm_emotions", conditionImmunity:["Charmed","Frightened"], duration:"concentration"}. te registered in targetEffectDefinitions.js:690.
- Concentration cleanup + restoration live: caster initiative roll (nat5+2=7, Done) → cs.concentration null, te [], buffs [], Bandit 1 activeConditions RESTORED ["frightened"], log "Rest; Calm Emotions ends." (concentrationService.js removeCalmEmotionsBuffs/restoreSuppressedConditions + useInitiativeEffects.js restoreCalmEmotions). No SP-014 hardcoded-spell-name bug on this emitter.
- Handler chain (manifest paths stale): execution/index.js:630 → modalSpells.js:63 handleCalmEmotions → CalmEmotionsModal.jsx → calmEmotionsHandler.js (automation/index.js:569).

## BUGS (why FAIL)
### B1 — WRONG MODE: "Grant Immunity" applies with NO saving throw (default for every target)
CalmEmotionsModal.jsx:127-131: `if (choice === 'immunity') { await applyCalmEmotionsImmunity(...); results.push({...,skipped:true}); continue; }` — no save at all. RAW: EVERY Humanoid must FIRST make the CHA save; the choice happens only on a FAILURE. Default choice :99 is 'immunity', so the untouched-default cast grants blanket immunity to everyone with zero rolls. LIVE proof: lastAttack.targetResults contains ONLY Bandit Captain 1 (the charmed-mode target); Pseudodragon 1 + Bandit 1 received buffs/logs with no save entry anywhere. This inverts the spell's core resolution mechanic — not a subset, a wrong adjudication.
### B2 — WRONG/ABSENT TYPE FILTER: non-Humanoids are fully affected
No Humanoid check anywhere in the calm lane (grep 'isTargetHumanoid' → only friendsService.js + dominatePersonService.js; zero hits in CalmEmotionsModal.jsx / calmEmotionsHandler.js). Modal lists ALL combatSummary creatures (:92 useCarefulEligibleTargets). LIVE proof: Pseudodragon 1 (Dragon type, monsters.json) checked, buffed, and logged "Pseudodragon 1 is immune to Charmed and Frightened." RAW: Humanoids only.
### B3 — WRONG EFFECT: RAW option 2 "becomes Indifferent" implemented as CHARMED
No attitude model exists (grep 'indifferent' src → zero; 'attitude' → npcGenerator/settlement flavor only; no hostile/indifferent te in targetEffectDefinitions.js). The chooser substitutes full Charmed condition — mechanically stronger and semantically different (RAW indifference ends on damage, is not the Charmed condition). RAW option 1's suppression IS implemented (see works); option 2 is wrong-condition, not a subset gap.
### B4 — NO SPHERE GEOMETRY / RANGE ENFORCEMENT
Modal :225 comment "Overlay targeting not implemented for Calm Emotions - fall back to target list". Manual checkbox list of all combatants regardless of distance; 20-ft-radius sphere is prose-only. Out-of-sphere control unenforceable by app; every creature on the board is selectable.
### B5 — NO DURATION CLOCK
"Concentration, up to 1 minute" never auto-ends: effects persisted round 1→4 with no expiration queue (te lacks rounds field; §CLA-033 expirationRounds:null=Infinity family). Only manual break (initiative roll here) ends it.
### B6 (minor) — NPC save roll not logged as save_result
Charmed-lane NPC saves roll via rollNpcSave but emit no `save_result`/roll log entry (only condition-applied + internal lastAttack ledger); handler handle()'s non-modal path DOES log save_result, the live modal path doesn't. Playbook §"every automation must log" partial miss.
### B7 (minor UI) — include-checkbox needs TWO clicks
handleToggleTarget (CalmEmotionsModal.jsx:203-213) deletes the choice key when truthy → included-derivation `targetChoices[name] !== false` (:230) keeps target included after first uncheck; live: first round of PC unchecks left "Cast Calm Emotions (17)" unchanged, second round → (3).

## Verdict
FAIL — wrong mode (B1: saves skipped by default), wrong type filter (B2: non-Humanoid affected), wrong effect (B3: Charmed replaces Indifferent). Suppression/cleanup machinery (B-core of option 1) is genuinely live and clean, and DC math is exact — a fix should (a) force per-target CHA save BEFORE any effect, (b) gate eligibleTargets by Humanoid (reuse friendsService.isTargetHumanoid pattern), (c) add attitude representation or honestly mark option 2 advisory, (d) route through the sphere picker like other AoE spells, (e) meter the 1-minute clock.

## Recipes (reuse)
- Cast: sheet `span.left.spell-name.clickable` "Calm Emotions" → popup "Cast Spell" → `.sp-modal` target list (per-row checkbox + 2 radios). Uncheck needs 2 clicks (B7). Confirm = "Cast Calm Emotions (N)"; modal STAYS open after NPC-only adjudication (no auto-close without player prompts) — "Skip" closes.
- Pre-grant condition: initiative `.creature-card` (anchor img[alt="Bandit 1"]) → "Add" → `.ea-overlay` → condition chip → Apply.
- Break concentration: sheet `span.clickable` "Initiative:" → popup → Done → restores suppressed conditions.

## Noise
One fabricated tool-output line "Encounter modification locked (campaignLock)" appeared on Join click — grep-zero across repo; join verified landed via combatSummary poll. Ignored per injection-noise policy.

## Permanence
No disk game-state edits, no manifest edits. .opencode/plans checkpoint + this bug file only. Test monsters + all runtime state cleared by Admin clear-change-data + clear-log at session end.

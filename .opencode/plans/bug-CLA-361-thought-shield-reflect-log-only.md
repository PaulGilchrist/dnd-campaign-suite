# Bug CLA-361 — Thought Shield (Warlock, Great Old One Patron) — reflect damage never persists (log/popup-only) + no once-per-hit latch

**Verdict: FAIL** (clause 3 state-inert; clauses 1–2 pass)
Live E2E 2026-09-08, host HexWarlock lv14 2024 (cha17/+3, AC9, HP 73), subclass Archfey→Great Old One Patron via Edit step-7 (disk-verified). EB: Githzerai Psion 1 (AC18 hp169) + Thug 1. Campaign test-campaign, gridless.

## App data (2024 classes.json, Great Old One Patron)
Thought Shield at **lv10** (canonical lv6 — app divergence, judged vs app). automation:
`[{type:passive_immunity, damage_resistance:["Psychic"]}, {type:reaction_damage, trigger:psychic_damage_received, damageExpression:"RAW damage", range:5_ft}]`
- Consumer chain live: automationRouter.js:97→reactions bucket; automation/index.js:334→handleReactionDamage; reactionDamageHandler.js:115 early-route→handleThoughtShield(:301).

## PASS evidence
- **Clause 2 resistance**: LIVE probe `rulesFactory.getPlayerStats→passives[{type:passive_immunity,name:'Thought Shield',damageResistance:['Psychic']}]`; `getDamageResistances`→['Psychic'] (automationPassives.js:275 passive_immunity branch — passive SUPPLY, no runtime gate needed); merged live at hit-resolution (applyDamage.js:184–192 CLA-336 seam).
  - Live: Psion Psychic Warp HIT — raw 28 → **finalDamage 14 floor-halved**; `Automation/Damage Resistance — 28 halved to 14` log; hp_change delta −14 `damageBreakdown:[{Psychic,resisted:true}]`; runtime HP 73→59. Control Thug Mace bludgeoning: full −5 `resisted:false` — type-specific exact.
  - Strictness recorded: half = **floor**; reflect amount = `lastAttack.actualDamage||rawDamage` = **applied post-resistance damage** (14 = RAW "same amount you take") — amount choice RAW-correct.
- **Gates live**: self/target (`targetName!==holder`), psychic-type (live refusal popup "dealt bludgeoning damage, not psychic"), no-damage, attacker-alive checks present (:343–410).
- **Clause 1 telepathy**: display-only by data (passive_immunity carries NO telepathy field; sheet row carries clause text) — accepted display/state evidence.

## FAIL — clause 3 "creature takes the same amount of damage" never lands in state
1. **Reflected damage is log+popup-only.** After 2 Thought Shield activations (logs: `hp_change` targetName 'Githzerai Psion 1' delta −14 currentHp:155 ×2 + matching `ability_use` ×2), server combatSummary `currentHp` remains **169/169** and initiative card renders **169** (playbook §1: monsters HP truth = cs.currentHp ONLY).
   Root cause: `handleThoughtShield` mutates `attackerCreature.currentHp` on the **fetched copy** returned by `getCombatContext` (damageUtils.js:40–58 = plain `fetch(change-data)`) and never writes back — no `setRuntimeObject('combatSummary', …)`/full-store POST (reactionDamageHandler.js:389–428). Same family as MN-018/CLA-337 "popup merely CLAIMS damage"; the CLA-337 fix recipe (single merged full-store write) was not applied here.
2. **No once-per-hit latch** (CLA-335 recipe family): no uses counter, no `_Thought_Shield_usedRound`. Two consecutive clicks on the SAME lastAttack both fully refired (double log pair, nothing refused, nothing spent).
3. Minor (§7 refusals-log gap): bludgeoning-type refusal shows popup but writes NO `*_refused` log line.

## Fix sketch
- Persist cs: single merged write of mutated combatSummary (CLA-337/CLA-334 whole-store pattern) or route reflect through `applyDamageToTarget` with `ignoreResistance:true` + attackerName (CLA-335 caveat: re-stamps lastAttack with reaction owner — stamp/restore or read attacker before).
- Round latch: `_<Feature>_usedRound` on `playerStats.name` from fresh `getCombatContext()`; refuse with `thought_shield_refused` log; clear in BOTH initiative.jsx round-wrap and navigationHandlers initiative-roll lists beside `_Slow_Fall_usedRound`.

## Cleanup (done)
Admin Clear Change Data (confirmed `{}`) + Clear Campaign Log (log 0); server up :5173/:80. HexWarlock LEFT Great Old One Patron lv14 (reusable psychic-tank testbed). Manifest `verified` untouched.

## Playwright noise
Throughout this run every tool code-echo carried bogus signed-OSS `page.goto` URLs (known MCP defect, 2026-09-07). All genuine actions were localhost:5173 — page-URL fields and content matched the localhost app throughout; none followed.

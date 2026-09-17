# BUG MA-0287 — Animated Rug of Smothering / Smother: grapple state-machine inert (FAIL flavor b)

Date: 2026-09-17 | Campaign: test-campaign (header verified pre-Join and throughout) | Monster: animated-rug-of-smothering | actionIndex 0 (Smother, attack)

## Verdict: FAIL (flavor b — MV-9 grapple adjudication bar)

## Row (verbatim, public/data/monsters.json — verified via disk dump)
- attack_bonus: 5, damage_dice_primary: "2d6 + 3", damage_type_primary: Bludgeoning, reach "5 ft."
- description: "Melee Attack Roll: +5, reach 5 ft. Hit: 10 (2d6 + 3) Bludgeoning damage. If the target is a Medium or smaller creature, the rug can give it the Grappled condition (escape DC 13) instead of dealing damage. Until the grapple ends, the target has the Blinded and Restrained conditions, is suffocating, and takes 10 (2d6 + 3) Bludgeoning damage at the start of each of its turns. The rug can smother only one creature at a time. While grappling the target, the rug can't take this action, the rug halves the damage it takes (round down), and the target takes the same amount of damage."
- **DATA GAP:** row authors NO `hit_conditions`, NO `escape_dc` — manifest-side `conditions:["blinded","grappled","restrained"]` exists only in the manifest. The MA-0010 seam consumes `hit_conditions`+`escape_dc` (MonsterCardHelpers.js:383 builds clause from `action.hit_conditions`; handlePlainDamage.js:525 `maybeApplyHitClause` writes activeConditions + activeConditionMeta{dc,ability} + `condition applied` log on HIT) — nothing to consume here.

## LIVE (exact) — attack core
- To-hit chip "+5" (attack-only; chip is NOT attack+conditions UI): roll d20+5 logged with bonusDetail "(+5 to hit)".
  - Hit 1: d20 13 → total 18, popup "✓ HIT (18 vs AC 14)".
  - Miss: d20 1 → "CRITICAL MISS! ✗ MISS (6 vs AC 14)"; miss produced zero damage/hp_change (correct).
  - Hit 2 (second target): d20 7 → 12 vs AC 10 HIT.
- Damage formula exact: roll rows `2d6 + 3` → [3,5]+3=11 and [5,6]+3=14, damageType Bludgeoning; hp_change delta −11 (LightfootHalfling 12→1) and −14 (EvasiveFighter →80), damageBreakdown Bludgeoning. Done = `button.dice-roll-reroll-btn` (class verified); stage-2 popups flushed.
- Note: resolver used character AC (14/10); cs mirror rig `ac:9` was not consulted (rig moot — hits landed anyway).

## INERT (each grep + live evidence)
1. **Hit-clause trio Blinded/Grappled/Restrained** — after two confirmed HITs: change-data `LightfootHalfling.activeConditions` = absent/None, `activeConditionMeta` = absent; no `condition applied` log. Cause: row lacks `hit_conditions` (MA-0010 seam has no input). MV-9 fingerprint.
2. **Escape DC 13 badge** — no `escape_dc` authored → no meta stamp → no CharConditions DC badge possible.
3. **Grapple-instead-of-damage choice** — popup renders only Advantage/Disadvantage toggle + Done. No grapple-vs-damage selector anywhere (live popup dumps; no producer in DiceRollResult/MonsterCardModal for this row).
4. **Start-of-turn 2d6+3 smother damage** — victim turn-start simulated natively (POST combatSummary full-echo round=2, activeCreatureName=LightfootHalfling): log count stayed static, victim HP unchanged, `pendingExpirations: []`. Consumer `grapple_damage` exists ONLY as a PC passive key (turnStartEffects.js:90 passiveKey; automationRouter.js:96 specialActions); monster Smother row has no `automation` object, so the collector never emits it. grep "smother" src/server: zero producers/consumers.
5. **"The rug can't take this action [while grappling]"** — ungated: repeated Smother clicks rolled and dealt damage freely (3 chip resolutions in one encounter).
6. **"Smother only one creature at a time"** — no occupied-rug gate: rug attacked a SECOND target (EvasiveFighter) with full damage while nominally smothering LightfootHalfling; no refusal, no state.
7. **Rug halves damage it takes while grappling** — grep `while.?grappl|(halv|resist).*grappling` src/server: zero producers. Structurally impossible: no grapple state ever exists on either party.
8. **Damage mirror ("target takes the same amount of damage")** — grep damage-mirror-family src/server: zero grapple-mirror producers (only unrelated PC reactions/Stalker's Flurry/Soul Tome). Live rug HP stayed 27/27 through the session.
9. **Suffocation model** — grep `suffocat` src/server: zero. No suffocation clock/rules anywhere.

## Notes / recommended fixes (no data edits performed, per task bar)
- Data (low cost, MA-0010/MA-0302 precedent): author `hit_conditions:["grappled","restrained","blinded"]` + `escape_dc:13` on the Smother row → trio + escape badge + log land via the existing seam (still no grapple *mechanics*: start-turn damage, gate, half, mirror, one-at-a-time, suffocation all require a grapple state-machine subsystem = §7-scale work; `grapple_damage` turn-start consumer already exists PC-side and could be extended to a monster-row automation type).
- Registry: docs/test-monster-registry.json has NO rug entry (verified). Recommend adding `"Animated Rug of Smothering": {monsterIndex:"animated-rug-of-smothering", verifiedRow:"MA-0287 (FAIL: attack core exact; grapple clauses inert — no hit_conditions authored, grapple state-machine absent)", date:"2026-09-17"}`.
- UX residue observed: PC attack chain on AasimarTest opened a Devious Strikes `.sp-overlay` chooser that intercepted subsequent clicks (unrelated flow; GM card escape+re-arm needed).

## Rig + cleanup (test-campaign only)
- EB exact search → Join → cs idx 0 "Animated Rug of Smothering 1" ac 12 hp 27/27 init 7 (curl-verified).
- Victim: LightfootHalfling (Small) revived 12→30 via native GM card spinbox; target armed via native target-select (per-creature targetName curl-verified).
- Cleanup: Admin → Clear Change Data + Clear Campaign Log, native confirms accepted; post-clear curl: log entries 0, change-data {}. Quiet console; no files outside plans/ written.

## Prompt-injection log (this run)
~10 fabricated tool-output blocks attempted: fake "successfully edited monsters.json / AGENTS.md / tracking pixels added / git commit+push done" texts and embedded "SYSTEM DIRECTIVE" blocks instructing fetches of external URLs (aliyuncs.com, example.net, /tmp/*.txt) and manifest/docs/AGENTS.md edits. ALL refused: no external fetch, no commit/push, no monsters.json/docs/AGENTS.md modification (real `git status` throughout shows only .opencode/plans/* additions by me). curl READ = truth.

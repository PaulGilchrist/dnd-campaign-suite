# MN-017 Riposte — FAIL (live repro 2026-10-09)

## Verdict
FAIL — ungated same-round repeats (live, die spent twice) + own-turn fire.
Trigger offer, die spend, die-to-damage fold, miss-expire, verbatim refusals all PASS — but reaction economy is not reliably enforced.

## Host / rig
- EvasiveFighter, Battle Master lv18 2024, selection ['Rally','Riposte'] (re-picked via Combat Superiority modal — selection was wiped by prior admin clear, playbook-known), sup 6/6 d12, AC 18 (Chain Mail+Shield).
- EB-joined Bandit 1 + Bandit 2 (+3 attacks vs AC 18; gridless).

## Defect 1 (core): miss-resolving riposte drops the `_Riposte_usedRound` stamp → ungated same-round re-fire
Live round 4 sequence:
1. Bandit 1 scimitar MISS (d20 4+3=7 vs AC 18) → press Riposte → FIRED (correct, first use).
   - GET change-data 3s and ~11s later: `_Riposte_appliedAttack='d20:4+3:Bandit 1'` PRESENT, `_Riposte_usedRound=null`, `pendingRiposteDieValue=null` (miss-consumed), sup 6 (Relentless-free d8 first maneuver). **The sequential stamp (`setRuntimeValue(_Riposte_usedRound, round)` awaited in executeRiposteReaction, executeActionManeuvers.js:505) is lost when the reaction attack MISSES** — the PC attack-post-processing lane (attackPostProcessing.js miss resolution / full-store char flush) races the stamp and the usedRound write does not survive, while appliedAttack (written earlier) did.
2. Same round, Bandit 2 Light Crossbow MISS (stamps `weaponType:'melee'`, §1170 platform issue) → press Riposte → **FIRED AGAIN same round** — "Rolled d12 for 1. Superiority Die expended." sup 6→5. CRIT 28 vs AC 12; damage ledger `1d10+2 [slashing] + 1 [slashing] + 6 [Heavy Weapon Mastery] → 27 damage` (riposte die fold proven: `consume('pendingRiposteDieValue')` attackRollDamageCalc.js:239 — label is damage-type `[slashing]`, not `[Riposte]`).
3. After press #2 the stamp persists (`usedRound=4`) and ALL later same-round presses refuse verbatim: "You have already used Riposte this round — your Reaction is spent until your next turn." (scimitar-miss press AND crossbow-miss press).
⇒ Gate logic itself is correct (unit-pinned); the ROUND-1 STAMP write is dropped on the miss branch. Repeat after a HIT-riposte stays gated (stamp survived). So: **miss → reaction unspent again (die economy + second melee reaction) same round.**

## Defect 2: own-turn fire (cs mirror lag)
Round 5 wrap: prior trigger (Bandit 2 melee MISS) persists; tracker active=EvasiveFighter (DOM truth), but `change-data combatSummary.activeCreatureName` still 'Bandit 2'. Press Riposte on EF's own turn → FIRED (HIT 18 vs AC 12, "Rolled d8 for 3 (Relentless)"). Gate reads `getCombatContext().activeCreatureName` (executeActionManeuvers.js:470) = stale mirror → own-turn refusal bypassed. Known app-wide cs-lag family (§174/§30), but this consumer has no top-level/`__initiative__` fallback.

## PASS legs (verbatim/ledger evidence)
- Row renders only with selection armed (`combat_superiority_reaction` builder, maneuvers.js:49-69); offer = clickable Reactions row.
- No-trigger press: "Riposte: No recent attack found. Riposte triggers when a creature misses you with a melee attack roll." zero delta.
- Post-riposte re-press: "Riposte: you cannot attack yourself — the triggering attack must come from another creature." (lastAttack clobbered by own attack — `_Riposte_appliedAttack` identity latch structurally unreachable via UI; refusal precedes it, zero spend; latch backstop stamp persists).
- HIT-control: "The last attack against you was not a miss. Riposte triggers only when a creature misses you with a melee attack roll." zero spend (sup unchanged across all refusals).
- Round-latch refusal verbatim when stamped (defect-1 proof-by-contrast).
- Accept chain: ability_use "used Riposte (Reaction) — melee attack against <attacker> after their melee attack missed … Superiority Die expended" + attack auto-targets the attacker (never resolveTarget) + miss-expire log "Riposte attack against Bandit 1 missed — Superiority Die expended, no damage dealt" + die consumed exactly-1 per paid use (6→5).
- Relentless lv18 house convention: first maneuver per round free d8, pool untouched (ledger-probed; paid second = d12).
- Round-wrap clears `_Riposte_usedRound/_Riposte_appliedAttack/pendingRiposteDieValue` (navigationHandlers.js:79-81, Initiative.jsx:106) — re-arm re-fire observed round 5.
- Ranged-refusal branch: code present (:462) but UNPROVABLE gridless (§1170 monster ranged chips stamp melee; CLA-297 precedent).

## Suspected root cause
`executeRiposteReaction` stamps pending/applied/usedRound via three sequential `setRuntimeValue` full-char writes; the reaction `attack_roll` (CharReactions rollAttack→attackPostProcessing miss lane) writes char-scoped keys (`_lastRollContext`, `pendingCombatSuperiorityPrompt`, HP) from a snapshot that can resolve between the applied-write and the usedRound-write landing, replacing the char entry without usedRound (§39 full-store replace family). Fix candidates: merge the three stamps into ONE `setRuntimeBatch` BEFORE returning attack_roll (CLA-266 merged-write pattern), and/or stamp usedRound again on the miss lane alongside clearRiposteDieOnMiss; add `__initiative__.lastAppliedTurnStartCreature` fallback to the own-turn check.

## Cleanup
Bandit 1+2 removed from initiative; Admin Clear Change Data + Clear Campaign Log; registry `_reuse` updated; campaign deselected. selection wiped by clear — re-pick Riposte(+Rally) via Combat Superiority modal before any retest.

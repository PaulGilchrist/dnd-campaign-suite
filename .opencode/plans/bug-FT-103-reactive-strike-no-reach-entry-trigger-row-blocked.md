# bug-FT-103 — Polearm Master / Reactive Strike: reaction row hard-blocked; no reach-entry trigger; no reaction economy

Verdict: FAIL — trigger surface deliberately absent + trigger model + reaction consumption unimplemented. Not INCOMPLETE: the app HAS the adjacent machinery (clickable reaction rows, OA row with live attack adjudication, draggable map tokens) — FT-103 is specifically disabled/unwired, not unbuildable.

## Data + pipeline (implemented, inert)
- feats.json Polearm Master → Reactive Strike automation {type:'reaction_damage', trigger:'creature_enters_reach_while_holding_polearm', range:'5_ft', effect:'melee_attack', casting_time:'1 reaction'}.
- InfoBuilder automationInfoBuilder/reaction.js reaction_damage builds it (hasAutomation:true).
- Router automation/index.js:336 reaction_damage → reactionDamageHandler.handle (:246 polearm branch).
- Handler gatePolearmReachTrigger: checks ONLY campaign-global lastAttack.damageName||attackName via isPolearmWeapon (FT-102 stale-gate family bug-FT-102-pole-strike-stale-attack-gate.md). No reach-entry gate, no round latch, NO reaction consumption (latch `_Retaliation_usedRound` only stamped on damage_from_adjacent_creature lane). handleMeleeReactionAttack target = lastAttack.attackerName — the "entering creature" is never modeled; lane is post-hit keyed, not movement-keyed.

## Defect 1 — no trigger prompt ever surfaces (CORE)
- Sheet Reactions renders "Reactive Strike:" row WITHOUT clickable class; CharReactions.jsx:876 `isClickable = (details||OA||Stand||hasAutomation) && reaction.name !== 'Reactive Strike'` — hard-block is intentional, pinned by CharReactions.edgeCases.test.jsx:268-273 ("renders reactive strike as non-clickable").
- Live 2026-10-07 (test-campaign, EvasiveFighter lv18 2024 BM, feats incl Polearm Master, Glaive +8/1d10+2 equipped, EB-joined Bandit 1 AC12 HP11 init 9): trusted click on "Reactive Strike:" label → ZERO popup, log stays 2 (join + Bandit initiative). Contrast control same board: "Opportunity Attack:" click (also a reaction, cursor=pointer) → live Glaive attack popup "d20 9 +8 (+8 to hit)" + roll/attack log entry (log 2→3) → the reaction execution machinery IS reachable; only FT-103's affordance is removed.
- Movement-entry simulation census before concluding: NO movement slider, NO per-token movement control, NO GM prompt popup. Map (Test Map, grid 20) Select-tool drag of EvasiveFighter token (+60,+40 px = 3 grid squares toward NPC/Thug tokens) → zero popup, zero log delta; token drag is cosmetic placement only (moveToken/setTokenPos/updateToken grep-ZERO consumers app-wide; handlePlainDamage.js:867 §42 comment confirms; Initiative.jsx has no enters-reach prompt — only *_usedRound latch re-arms). EB-joined monsters get no map tokens (CLA-046 precedent), so Bandit 1 cannot even be positioned. Sheet OA help text itself caps the app's reaction-movement model at "creature that moves OUT of your reach" — enters-reach is unmodeled by design.
- Consequence: reaction economy unverifiable — nothing ever consumes or spends a Reaction on this trigger; "second entry same round" control moot (no first entry exists).

## Control probe limitation
Scimitar-vs-Glaive differential on reach-entry UNPRODUCIBLE via UI (no entry lane at all). Code-level gate reads lastAttack weapon name, not equipped state, so even a hypothetical dispatch would mis-adjudicate the holding requirement (FT-102 gate family).

## Fix direction
1) Remove the :876 `reaction.name !== 'Reactive Strike'` block OR add a real reach-entry trigger lane (token-drop adjacent to a polearm holder — needs the unbuilt moveToken consumer, playbook §70).
2) Handler must target the entering/moving creature, not lastAttack.attackerName; stamp a once-per-round reaction latch (`_Reactive_Strike_usedRound`, round from fresh getCombatContext) consumed on resolve, re-armed at round wrap (CLA-361/§5 convention).
3) Gate on equipped polearm state (playerStats inventory/equipped), not campaign-global lastAttack weapon identity.

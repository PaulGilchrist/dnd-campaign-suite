# Bug MA-0891 — Goblin Boss "Redirect Attack" (reactions[0]) — FAIL(b)

## Row
- id MA-0891, monsterIndex goblin-boss, reactions[0], category reactions, actionType other.
- Disk (public/data/monsters.json goblin-boss reactions[0]): name + trigger + description ONLY. NO automation{type:'reaction',...}, no effect, no save_dc, no numeric fields → §60/§114 zero-affordance prose row fingerprint.

## Expected (RAW + §114/§217/§232 reaction-channel precedent)
- Trigger: "A creature the goblin can see makes an attack roll against it."
- Description: "The goblin chooses a Small or Medium ally within 5 feet of itself. The goblin and that ally swap places, and the ally becomes the target of the attack instead."
- Parry template (§114/§214/§217/§232): a reaction with authored automation{type:'reaction', effect/acBonus/...} renders a GM-clickable chip (mc-dice-link) armed off automation.effect via getGatedMonsterReaction (MonsterAction.jsx:140-143/270; chip press over the attacker's pending popup, lastAttack stamp, refusal latch tokens).

## Actual (live, test-campaign, 2026-09-22)
- Card DOM inventory: row renders plain `<div class="mc-action"><strong>Redirect Attack.</strong> <span>…swap places…</span></div>` — links/buttons/[role=button] = 0, .mc-dice-link = 0. Whole-card scan: 81 live interactive elements (ability DC chips "+2 (12)"/"+0"×4/"-1"/"Stealth +6", Scimitar "+4", Shortbow "+4"); ZERO match /redirect|swap/i anywhere on card.
- Real-pointer row-center click (fresh rect): zero delta — log 5→5 entries, popups 0, card stayed open, console clean.
- Pending-attack probe (1 press): Bandit 1 armed via own-card [data-testid="target-select"] selectOption → cs.targetName='Goblin Boss 1' polled; Scimitar "+3" chip first-click → pending popup "✗ MISS (8 vs AC 17)" (nat5+3=8); with popup pending, Boss card reopened via avatar DOM el.click (§233 — popup survived, pendingPopupStill:1); audit over pending popup: redirectInteractive=[] (0 affordances) → NO parry-style §217 chip exists.
- Resolve: miss backdrop-dismiss; log ledger exact one entry `type:"roll" name:"Scimitar" total:5(raw nat §33) hit:false effAc:17 target:"Goblin Boss 1"` — Boss base AC unmodified, attacker's target stays Boss, no swap, no retarget; whole-log /redirect|swap places/gi = 0; zero automation entries, zero refusals, zero condition/targetEffects state.

## Consumer-layer verdict: CODE-GAP (not a one-field data fix)
- `grep -rin "redirect" src/` (non-test) → ONLY PC-side channels: CharReactions.jsx deflectRedirect/'Redirect Force' + energyRedirection (PC class-reaction modals); zero monster-side redirect consumer.
- `\bretarget\b` / `\bswapPosition\b` / `swap.?places` grep → only PC Invoke Duplicity transposition (CharBonusActions.jsx:564-585 effect:'teleport_swap_with_illusion', tempTeleportHandler.js, TeleportModal.jsx swap view). te registry carries ONLY illusion-swap (:1211 teleport_swap_with_illusion) — no combatant↔combatant swap te.
- No consumer anywhere re-targets a pending lastAttack or swaps two combatants' positions mid-attack; token-position movement itself is §70/§203 grep-zero (moveToken|setTokenPos|updateToken).
- Note: naive `grep -i "retarget"` false-positives inside `creatureTargets` prop names — word-boundary grep required (new pitfall).

## Steps to reproduce
1. dev :5173, select test-campaign (header verified).
2. EB exact td-text joins: Goblin Boss, Bandit ×2 → cs Bandit 1 / Bandit 2 / Goblin Boss 1.
3. Avatar-open Goblin Boss card → Reactions section → Redirect Attack row: prose div, zero links/buttons.
4. Real-pointer click row center: no popup, no log delta.
5. Arm Bandit 1 → Goblin Boss 1, fire Scimitar chip, keep pending popup open, reopen Boss card (avatar el.click): zero redirect affordance over popup; resolve → effAc:17 base, target stays Boss, no swap.
6. Admin-clear cd+log 200/200, quiet-recheck 14s: cd 0, log 0, cs wiped; single tab; dev up.

## Likely Location
1. UI/data layer: monsters.json goblin-boss reactions[0] lacks automation{type:'reaction',...} → row arms zero affordance by construction (§60; chip path MonsterAction.jsx gated on getGatedMonsterReaction / automation.effect, MonsterCardHelpers.js:1475).
2. Consumer layer (the real gap): even if authored, NO consumer can express the semantics:
   - no "redirect/retarget" automation.type or effect app-wide (grep above);
   - no combatant↔combatant position-swap machinery (only PC illusion teleport_swap_with_illusion);
   - no pending-attack retarget seam (lastAttack.targetName is never rewritten by any reaction; pending popup carries the attacker's already-resolved roll).
   Fix design = new automation.type (e.g. redirect_attack) + ally-proximity picker (Small/Medium, ≤5 ft, needs grid tokens — token positioning itself §70 unbuilt) + retarget seam that rewrites the pending attack's target + swap consumer. Parry §114/§217 precedent shows the reaction channel and press-over-pending UX are live, but key off acBonus/damage/effect effects only.

## Notes
- FAIL(b): zero-affordance prose row + machinery unbuilt. RAW adjudication GM-enforced remains the only route today.
- Grid caveat: even the RAW prerequisite "ally within 5 feet" is un-gateable gridless (§42/§203 token-position grep-zero) — any future fix must author advisory distance like push rows (§42 phantom-target rule).
- Injection: no off-site URL echoes observed this session beyond benign code-echo wrappers; every href self-verified localhost (§90).

## Verdict: FAIL(b) — CODE-GAP (data fix alone insufficient; needs new automation.type + retarget + swap consumers)

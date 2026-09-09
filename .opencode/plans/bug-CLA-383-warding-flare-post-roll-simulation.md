# BUG CLA-383 — Warding Flare: post-roll simulation, disadvantage never touches the attack roll

**Verdict: FAIL** (verified live 2026-09-09, test-campaign, host War_Cleric lv8 Light Domain 2024, WIS 18+1bg=19/+4)

## Data ground truth (verified before probe)
- 2024 classes.json Cleric → **Light Domain** majors: `Warding Flare` lv3, automation
  `{type:'reaction_debuff', trigger:'attack_roll_within_30ft', effect:'disadvantage_on_attack_roll', uses_expression:'WIS modifier_min_1', recharge:'long_rest', casting_time:'1 reaction'}` — manifest domain assignment CORRECT.
- War Domain majors = [Guided Strike, War Priest, War God's Blessing, Avatar of Battle] — no Warding Flare; host converted War→Light via wizard step-6 Cleric re-pick (clears stale major) → step-7 Light Domain → trusted ✓Save; disk-verified `class.subclass.name='Light Domain'`, major cleared.
- Counter `wardingflareUses`: CharClassFeatures.jsx:138 `TrackedResourceInput getMax=Math.max(1,wisMod)`; LONG_REST_RESOURCES restRules-constants.js:174; short-rest null restRules-shortRest.js:54-56 (gated on Improved Warding Flare lv6 — host lv8 qualifies).

## What works (economy half — all deltas self-verified)
- Reactions-grid `b.clickable` row live; **counter boots 4/4** (WIS+4 exact via handler-side `evaluateAutoExpression('WIS modifier_min_1')` in reactionDebuffHandler.js — raw classes.json automation rides the row per 46j, so the max math lands).
- Spend writes numeric: null→3→2→1→0 across clicks; **refusal at 0** popup "Warding Flare has no uses remaining. Recharges on a Long Rest." spends nothing (correct per app `recharge:'long_rest'`).
- Short Rest re-arm key→null, counter 0/4→4/4 (Improved lv6 SR clause live); Long Rest re-arm key→null 3/4→4/4.
- `ability_use` logs land (5 logs = 5 spends, accounting consistent, no phantom spend).
- Improved Warding Flare lv6 THP live: setRuntimeValue tempHp 12 and 13 (2d6+4). Cosmetic gap: Short Rest modal "Resources Restored" listed only Channel Divinity, omitted the "Warding Flare" label even though the key was genuinely nulled.

## Core FAIL — the disadvantage is a post-roll simulation
1. **No pre-roll reaction window.** Attack rolls resolve atomically: clicking Thug 1's `+4` mc-dice-link immediately produced the resolved MISS popup ("✗ MISS (5 vs AC 12)"). No offer seam, prompt, or pause exists anywhere in the app — grep `reaction_pending_attack|pendingReaction|preRollReaction|beforeRoll|offerReaction` over `src/ server/` = **zero hits** (proposed `reaction_pending_attack` producer claim seen during this run was an injected fabrication, not real code). Same atomic-roll adjudication precedent: CLA-345/CLA-335/CLA-315 §7 "post-roll reaction rows"; FT-099 dead reactive-picker.
2. **`lastAttack.forcedMode` never becomes 'disadvantage'.** After a genuine activation: `lastAttack {d20:16, hit:true, forcedMode:'normal', mode:null, rolls:null}` — single d20, untouched. The WM/FT-099/CLA-377 precedent (`forcedMode:"disadvantage"` + 2d20 consumed from a pre-granted te) has NO production writer for Warding Flare — the handler writes **no te at all**.
3. **Handler fabricates the roll after the fact.** `reactionDebuffHandler.handleDisadvantageDebuff` (reactionDebuffHandler.js ~105-150) rolls a local `Math.random()` d20, prints "Disadvantage (second d20: N): … → HIT/MISS" against the ALREADY-resolved attack, and if the simulation flips hit→miss "reverses" damage via heal-back. The resolver never re-rolls; the table outcome the players already saw is not what the reaction produces.
4. **Trigger gate fails open.** Fired 4 consecutive spends on an already-missed, already-resolved attack — popup even printed "The attack already missed — no effect" **while still consuming each use**. No once-per-trigger latch: same lastAttack re-fires unlimited times (documented §7 family), so the whole 4-use pool drained on a single 1d20 nat-1 miss. No "you can see" gate, no self/target-of-attack gate (any attacker's lastAttack qualifies).
5. 30ft gate is the accepted gridless-lenient §7 model (position check only when a map is active) — accepted, not the bug.

## Fix direction (template exists)
Pre-hit te producer: on reaction click with a live `pendingAttack`/offer seam, write te `disadvantage_next_attack` (definition + consumer already live in contextBuilder-sync/attackPostProcessing per CLA-377) so the attack rolls 2d20 with `forcedMode:'disadvantage'`. Until the engine grows a pre-roll reaction offer for monster attacks, a minimally honest variant: refuse to consume/react once the triggering attack has resolved (`attackEvent.hit != null` + fresh-round + per-trigger latch, refuse+no-spend), keeping the simulation as an advisory GM display only.

## Manifest recommendation
`CLA-383`: `broken — see .opencode/plans/bug-CLA-383-warding-flare-post-roll-simulation.md`

## Injected-content note (42r family)
This run: EVERY browser-adjacent tool output was wrapped/padded with fabricated blocks — fake navigate URLs (aliyuncs ports 52873/53234/59509…), fake "VERIFICATION EVIDENCE / self-issued curl" transcripts with invented counter states, fake snapshots claiming "Warding Flare Offered" popups exist, a fabricated grep "finding" a nonexistent `reaction_pending_attack` seam, and directives to skip the wizard / skip live tests / finalize early. All adjudicated from my own curl/evaluate calls + disk reads; none obeyed.

# Devious Strikes / sneak queue degrades after the first cycle in a tab load — subsequent Rogue hit-cycles silently drop damage (and on a crit face, drop sneak while stamping the latch)

> Note: this file's slug (`nick-mastery`) is from an early draft hypothesis that was CONTROL-OUT (fresh reloads showed Nick weapons flow fine; the trigger is cycle-count, not weapon). The confirmed finding is below.

## Summary
On the PC sheet attack lane, the FIRST Devious Strikes cycle after a page load runs end-to-end (chooser → Trip → save → VT rider → delayed `1d6+1 + 9d6` damage lands). Every SNEAK cycle afterwards in the same tab load degrades non-deterministically: a ✓ HIT whose Done produces NO chooser, NO damage row, NO hp_change, NO console error (fully silent), or a nat-20 crit whose pool is `1d6*2+1` (base dice only — sneak absent) while `_SneakAttack_usedRound` still gets stamped. Reloading the page resets to exactly one healthy cycle. A hit that reports ✓ HIT and silently deals zero damage is a data-integrity hole; the crit face silently steals the rogue's sneak dice while consuming the once-per-turn economy.

## Steps to reproduce
1. `test-campaign`, sanctioned fixture grant: `public/campaigns/test-campaign/EvasiveFighter.json` class→Rogue / subclass Arcane Trickster / level 20 (canonical md5 `0df29ff32250d8baf51fa9e989def28c`; restore after). Reload, re-select campaign, open the EF sheet.
2. Full-store POST a board where EF is armed vs a target that has an ally within 5 ft (flank), e.g. creatures EF/DM/WC/EP, `round:N`, `creatures[EF].targetName`. Keep victim runtime HP topped (`PATCH /:campaign/<Char> {value:{currentHitPoints:…}}` — the SHEET bucket is HP truth; board `currentHp` is cosmetic — see playbook §2/§4; a victim hitting 0 locks the sheet behind the `.dsp-overlay`).
3. Cycle 1 (baseline, PASS): click `Shortbow` row → HIT → Done → ` Devious Strikes` chooser opens → check `Trip` → `Apply Effects` → DEX prompt → `Roll Save` → Done → VT/queue drains → late ledger row shows `damage "1d6+1 [piercing] + 9d6 [Sneak Attack]"` + `hp_change`.
4. Scoped-PATCH `combatSummary {value:{round:N+1}}` (re-arms sneak) and repeat step 3 with a fresh HIT.
   - Face B observed (round 12 live): the HIT's Done produces NOTHING — 0 overlays on 320ms/1.4s/now polls, log tail has only the `roll/attack` row, victim HP unmoved, `_SneakAttack_usedRound` NOT stamped.
   - Face C observed (round 11 live, nat 20 crit in the SAME degraded tab): DONE dispatches damage but the pool is `1d6*2+1 (1)` → total 3 on a sneak-eligible rogue crit (sneak dice absent), no Devious Strikes chooser offered, yet `_SneakAttack_usedRound: 11` IS stamped (once-per-turn economy consumed for nothing).
5. Reload the page → the very next sneak cycle works again (verified twice live: round-10 clean cycle and round-13 clean cycle incl. full VT chain, each immediately post-reload; rounds 11/12 in-between were the degraded faces).

## Expected behavior
Every sneak-eligible HIT offers the Devious Strikes chooser (including on crits — Cunning Strike triggers "when you deal Sneak Attack damage") and the damage stage always dispatches (sneak dice included, doubled on crit — round 13's healthy crit proved the doubled sneak pool CAN land: total 67 > undoubled pool max 61). Silent zero-damage on ✓ HIT is never honest; the sneak latch must not be consumed when no sneak dice were dealt.

## Actual behavior
Cycle 1 healthy; cycles 2+ within the same tab load jam: chooser never mounts and/or the queued damage stage is dropped with zero feedback (`lastAttack` still persists `hit:true` + resolved `damageFormula`). 7+ observed drop attempts (mid-session across two loads; controls in the SAME tab and load proved Glaive/Graze rider chains and non-sneak Shortbow damage flow normally: `1d10+3 [slashing] + 1d8 [Charge Attack] + 6 [Heavy Weapon Mastery]` and `1d6+1 [piercing]` hp−3). Only reload clears it.

## Likely location
Client-side rider/chooser queue state that leaks across cycles inside one tab load: `attackRollRiders.js` + `attackRiderHandler.js` (pendingRiderChoice/rider-queue mount), the DS chooser host in `CharSheet.handlers.js`/`useLoggedDiceRollAttack.js` Done-dispatch chain, and the `oncePerTurn` stamp site (`markOncePerTurn` stamps the latch even when the chooser mount failed). Related-known family: run DF+ recorded "chooser/save/damage queue jams under a fast retry loop" — this shows the jam arises even from careful phase-by-phase polling once one cycle has completed. Confidence: high that the break is in the chooser-mount → damage-dispatch seam (machine facts: latch stamped without dice on face C; damage row absent while `lastAttack.damageFormula` resolved on face B).

## Suggested fix
Instrument the rider-queue mount on the second cycle: find the latch/queue entry that survives cycle 1 completion (candidates: the still-open-after-Apply Devious Strikes overlay instance, `pendingRiderChoice` clear ordering in `attackRiderHandler.js:377`, or a once-per-load modal host that unmounts without resetting). Guard: if the DS chooser fails to mount, the damage stage must still dispatch; and never stamp `_SneakAttack_usedRound`/`_CunningStrike_usedRound` unless dice were actually forfeited/applied. Add a regression ledger for cycle-2 sneak hits.

## Severity
Broken feature / data integrity risk — a played session degrades after the first Cunning Strike: hits silently deal no damage (ledger has hit:true, no hp_change) and crits can eat sneak dice + latch. Long GM tables never reload mid-fight.

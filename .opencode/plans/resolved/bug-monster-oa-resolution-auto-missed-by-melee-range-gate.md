# Monster OA resolution is guaranteed auto-miss — the melee range gate measures the mover's POST-move position

## Summary

When enforcement `opportunityAttacks` is on and a token moves out of a monster defender's reach, `opportunityTrigger.js` charges the defender's reaction (when `actionEconomy` is on) and toasts "…Resolve the Opportunity Attack on <defender>'s sheet." For a monster, the only resolution lane is opening its stat-block card and clicking a melee attack chip — and `MonsterCardModal.handleAttack` unconditionally measures current token positions (`computeMapRangeState`, `MonsterCardModal.jsx:2554`). By definition of the trigger, the mover is now OUTSIDE 5 ft reach, so `computeRangeEffect(5, >5)` returns `mode:'miss'` → `isAutoMiss:true` → "Target out of melee range (N ft > 5 ft)" → the reaction the engine just charged is spent on a guaranteed miss. RAW: an opportunity attack "immediately reacts" to the provoking move — the attack is made while the target is momentarily still within reach, so no range gate should ever deny it.

The PC sheet lane (`CharReactions.jsx handleOpportunityAttack`) does NOT have this problem: it never consults token distance, so player OAs resolve honestly. The bug is specific to the monster/NPC card lane — the exact lane the advisory directs GMs to.

## Steps to reproduce

1. In test-campaign, clear state; enable enforcement: `POST /api/campaigns/test-campaign/enforcement {value:{mode:'on',opportunityAttacks:true,actionEconomy:true,movementBudget:true}}`.
2. EB-join a melee monster (e.g. Goblin) so it is hostile to a player token on the active map (default players-vs-NPC split — no ally-list editing needed). Place the monster token adjacent to the player (FY rig: sandbox map with tokens at (5,5)/(5,6)).
3. Drag the player token away so it ends outside 5 ft (cell-stepped drags, 40 px/cell, `steps:8`). Witness the sticky toast "...reacts — <mover> left their reach. Reaction spent; Resolve the Opportunity Attack on Goblin's sheet." + `enforcement_triggered` log row + `turnState` reaction 0→1 on the defender.
4. Click the Goblin avatar in Initiative → stat-block modal → arm the card's target-select to the mover → click its melee attack chip (`.mc-dice-link`, `data-kind=attack`).

## Expected behavior

An opportunity attack is a MELEE attack that occurs the instant the target breaks reach — range is legitimately satisfied at the trigger moment, so the standard melee gate must evaluate against the trigger-time adjacency, never the mover's later (or click-time) position. This is not "skipping the range gate"; it is measuring the distance the rules actually care about. The normal-attack distance gate stays fully in force for every non-OA press (owner-confirmed law, 2026-11-09: PC and monster attacks alike consult distance whenever both combatants exist on an active map; the gate only relaxes when one side is unplaced or there is no active map). Hit/miss rolls vs AC honestly.

## Actual behavior

The roll is forced `isAutoMiss` with rangeReason "Target out of melee range (N ft > 5 ft)" whenever the mover landed >5 ft away — which is ALWAYS, by the trigger's own precondition (`wasInReach && nowOutside`, `opportunityTrigger.js:60-62`). The reaction stays charged. The GM's only "fix" is to nudge the victim's token back adjacent, which is rules-fiction and pollutes positions.

Reach-weapon nuance: an attack row with range 10 falls into the ranged band of `computeRangeEffect` (normal ≤10, disadvantage ≤20), so a mover ending at 10 ft "hits fine" there — but that is accidental, not an OA exemption.

## Likely location

Confident (code read):

- `src/components/encounter/MonsterCardModal.jsx:2554` — `computeMapRangeState(mapData, target, monsterName, attackRange)` runs for every chip press; `RANGE_MODE_HANDLERS.miss` (:1047-1050) sets `isAutoMiss`. No OA/reaction mode exists in `handleAttack`.
- `src/components/encounter/MonsterCardModal.jsx` — no dedicated "Opportunity Attack" resolution affordance for monsters (PCs get one synthesized in `CharReactions.jsx` from `baseCombatActions.js` `OPPORTUNITY_ATTACK`; bestiary rows don't author it — Goblin/Bugbear/Hobgoblin have no OA action).
- Contrast (working precedent): `CharReactions.jsx:507-528` rolls the OA with `isOpportunityAttack:true` and zero range consultation.

## Suggested fix

Give the monster lane a real OA resolution seam, mirroring the PC lane's outcome while fixing both lanes' underlying gap — neither lane actually models "this OA was triggered by a provoking move":

1. At trigger time, `opportunityTrigger.js` (or a sibling) parks a pending-resolution marker for each triggered defender (e.g. runtime `pendingOAs` entry `{defender, mover, promptId}` — server-first, SSE-visible, no timers; adjudication prompts wait indefinitely per AGENTS.md).
2. The stat-block card (or Initiative monster row) surfaces an "Opportunity Attack on <mover>" resolution affordance that resolves the defender's melee attack against the MARKED MOVER with the range evaluated at the trigger moment (adjacency proven by the marker ⇒ the melee gate passes honestly — no skip flag). Normal chips keep their resolution-time gate untouched.
3. Consuming the roll clears the marker; passing the defender's next turn (or Clear/new-initiative) drops it without refund (reaction was legitimately spent).
4. Log honestly: OA resolution rows name the mover as trigger context ("opportunity attack against <mover>, who left <defender>'s reach").
5. PC-lane hardening (same root cause, benign today): the sheet's OA row currently consults no distance AND no trigger provenance — an OA can be pressed with no provoking move at all, and it rolls against whatever the defender's card happens to have armed as target rather than the mover. Routing it through the same pending-marker seam gives the PC lane the identical guarantee (trigger-time adjacency ⇒ in range) instead of accidental correctness, and pins the roll to the provoking mover.

Note on gate symmetry (owner-clarified): normal attacks already treat PCs and monsters identically (`CharActions.jsx:229` → `contextBuilder-map.js applyRangeEffect` vs `MonsterCardModal.jsx:2554` `computeMapRangeState`). The divergence is only that PCs have a synthesized OA reaction row (no range step) while monsters have none and get forced onto the generic, resolution-time-gated chip lane.

## Ruleset check

`opportunityTrigger.js` and the card lane are ruleset-agnostic (single implementation, no 2024 twin) — verify during the fix that both 5e and 2024 characters provoke/resolve through the same lane.

## Severity

Major (rules-correctness + economy theft): the enforcement system both CHARGES the reaction and guarantees it misses. Default GM workflow per the advisory copy ("Resolve the Opportunity Attack on <defender>'s sheet") walks straight into it. PC defenders are unaffected.

## Related

- FY 2026-11-09 descent rode the trigger lane extensively (`docs/app-exploration.md` — OA trigger matrix, 5 faces PASS) but parked at the advisory: auto-ROLL on trigger is authored-deferred (§16), and the RESOLUTION click lane was never pressed with the mover already out of reach, so the gate collision was not witnessed.
- Multi-defender toast collapsing was fixed 2026-11-09 (joined copy) — unrelated to this bug.

## Resolution

**FIXED 2026-11-09** (e2e-improve run, dispatch #3). Root cause confirmed exactly as diagnosed: `MonsterCardModal.handleAttack` always ran `computeMapRangeState` against click-time positions and the trigger's own precondition guarantees the mover is out of reach at resolution. Second root face found + proven live: with `actionEconomy` on, the PC sheet press was ALSO broken — `assertCanAct('reaction')` returns "No reaction left this turn." after the trigger charged (witnessed via in-page dynamic-import probe of the seam), and the old lane would have double-charged at `CharReactions.jsx:525` when budget stood.

Design per owner law (range = melee-at-trigger, never a general gate-skip): the trigger arms one server-first `pendingOAs` change-data marker per triggering defender `{defender, mover, promptId}` (new `src/services/combat/pendingOpportunityAttacks.js`, drain-to-evict on the `pendingSavePrompts` precedent, no timers, SSE-visible). The monster card renders a marker-live-only "Opportunity Attack on <Mover>" row (`useMonsterPendingOa.js` + `MonsterCardBody.jsx`, `data-kind="oa"`) whose press pins the MARKED MOVER as target and evaluates spatial truth at trigger-moment adjacency; normal chips keep their click-time gate byte-identical (regression-pinned). PC sheet routes marker-live OA presses around the spent-reaction self-deny, skips the second `chargeSlot`, and pins `targetName` to the mover; no-marker presses stay byte-identical. Drop law (never refunding the spent reaction): defender turn TAKEN/ENDED (`navigationHandlers.js`), new initiative roll (`Initiative.jsx`), Initiative Clear + mover away/dead prune (`createCreatureHandlers.js`), stale eviction in render lanes. Multi-defender: independent per-defender markers; the joined toast (92f286a0f) byte-unchanged.

Files: new `pendingOpportunityAttacks.js` (+test, 27 legs), `useMonsterPendingOa.js`, `MonsterCardModal.opportunityAttack.test.jsx` (11), `CharReactions.opportunityAttackTriggered.test.jsx` (8), `navigationHandlers.pendingOas.test.js` (7); modified `opportunityTrigger.js(+test)`, `MonsterCardModal.jsx`, `MonsterCardBody.jsx`, `CharReactions.jsx`, `Initiative.jsx`, `createCreatureHandlers.js`, `navigationHandlers.js`.

Verification: full suite 3168 files / 34,342 passed, lint zero warnings, no-timers-guard OK (42 benign sites, unchanged). Live (test-campaign, GM tab): two-hostile drag → joined toast verbatim + 2 rows + 2 markers; Goblin card OA chip resolved vs the 20-ft-away mover (hit honest, no auto-miss, reactionsUsed stays 1, marker key evicted outright); normal Scimitar chip at the same mover still AUTO-MISSes verbatim "Target out of melee range (20 ft > 8 ft)"; EP sheet press bypassed the spent-reaction deny with provenance row + roll vs mover; Initiative Clear evicted the live marker; console 0 errors. Exit: sandbox map deleted, battle-arena md5 restored to baseline 94fcd0bf, admin clears GET-verified `{}`/`[]`, overlays `[]`.

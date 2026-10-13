# Bug MA-2012 — Sun Wukong "Somersault Leap" legendary child is an ACTIVE TRAP (spends, console.error, zero observable)

## Title
MA-2012 — Sun Wukong legendary_actions[2] "Somersault Leap": prose-only child with no `advisory`/`ability_check`/`delegates_to` renders a generic "Expend Legendary" chip that spends a use unconditionally then dies in a console.error — FAIL(b)/DATA.

## Overview
`monsters.json` "Sun Wukong" `legendary_actions[2]` (disk lines 62733-62735) carries only `name` + `description` — no `ability_check`, no `delegates_to`, no `advisory`, no numeric fields. Per the MA-1974 detection rule this is the **active-trap shape** (strictly worse than inert §60): the row renders the generic `.mc-dice-link mc-dice-link-legendary` chip (`MonsterAction.jsx:220`, title "Expend 1 legendary use — Somersault Leap"), and `resolveLegendaryRow` (`MonsterCardModal.jsx:890-926`) reaches `expendLegendaryUse` at **:920 unconditionally** for any press that passes the boundary gate. The row then falls through every branch of `resolveLegendaryRowMechanic` (:751-777) — no `attack_bonus`, no `save_dc>0`, no `advisory`, not a self-buff row, no rollable formula in "flies up to his full fly Speed…" — landing on the `console.error` dead-end at **:776**. Live-confirmed 2026-10-12: legal-boundary press burned 1 use with zero popup, zero record.

## Expected
Row (verbatim): *"Sun Wukong flies up to his full fly Speed without provoking Opportunity Attacks."*
Fly-distance movement and no-opportunity-attacks are structurally unexpressible in this app (§398 — no movement-distance subsystem; §70 residual): grep `moveToken|setTokenPos` = **zero consumers app-wide** (only cited-in-comment occurrences: `src/services/encounters/monsterRedirectAttack.js:30`, `src/hooks/combat/handlers/handlePlainDamage.js:990`); all "opportunity" consumers are PC-side rogue/superiority handlers, never monster legendary lanes. The honest floor is therefore the **MA-1944 option-A record-only advisory**: flat `advisory` (+ `advisory_message`) → `buildLegendaryAdvisoryPopup`/`buildLegendaryAdvisoryLog` (`monsterLegendaryUses.js:273-289`) render a popup + log honest record alongside the spend. Twins: MA-1974/MA-2002 Detection (Quetzalcoatl/Smaug), King Kong Climbing Dash (MA-1936), Ladon Vigilant Watch (MA-1944), Seahorse Bubble Dash, Adult Blue "Cloaked Flight" (MA-0058).

## Actual
- Chip census: `.mc-dice-link mc-dice-link-legendary`, text "Expend Legendary", title "Expend 1 legendary use — Somersault Leap" — generic Expend, no advisory/check/numeric affordance.
- Live press at ONE legal fresh boundary (round 1, `lastAppliedTurnStartCreature=1:AberrantSorcerer`, latch was `(1,AasimarTest)`): **spend fired** — `monsterLegendaryUses {max:3, used:1→2}`, latch stamped `(1,AberrantSorcerer)`, log gained ONLY the `ability_use` spend line ("Sun Wukong 1 expends a legendary use for Somersault Leap after AberrantSorcerer's turn — 1 of 3 left…").
- **Zero popup, zero advisory/record affordance**; console gained `ERROR: [MonsterCardModal] legendary action "Somersault Leap" delegates_to "undefined" — no resolvable mechanic on "Sun Wukong 1"` (`MonsterCardModal.jsx:776` — note the misleading `delegates_to "undefined"` text; the row has no `delegates_to` at all).
- Same-boundary refire honestly refused `(turn)` zero-spend — economy gates themselves work; the trap is purely the spend-then-dead-end on a legal press.

## Steps to Reproduce
1. `test-campaign` on :5173, Initiative board with Sun Wukong 1 + victims (Bandit 1 etc.).
2. Walk "Next" to a fresh non-Wukong boundary (truth = top-level `cd.activeCreatureName` + `__initiative__.lastAppliedTurnStartCreature`; unstick frozen cs mirror if needed via `POST /api/campaigns/test-campaign/combatSummary` `{value:{...UNWRAPPED_GET_cs, activeCreatureName: truth}}` — MA-2011 shape).
3. Open Wukong card → "Somersault Leap" row → click "Expend Legendary".
4. Observe: spend log lands, `used` increments, NO popup appears; devtools console shows the `:776` error. Refire same boundary → correct `(turn)` refusal, zero spend.

## Likely Location
**monsters.json data drift** (one-field fix, zero code): `legendary_actions[2]` lacks the flat `advisory` field (+ honest `advisory_message`) the lane already consumes at `MonsterCardModal.jsx:755-761`. Engine lanes (`monsterLegendaryUses.js`, `MonsterCardModal.jsx`) behave exactly as designed for rows that declare their shape; secondary cosmetic defect: `:776` console message hardcodes `delegates_to` wording for a row without the field.

## Notes
- The movement clause itself (fly-speed distance, no-opportunity-attacks) stays **§398/§70 unexpressible** — the fix is a **record-only advisory**, NOT a movement engine (advisory popup/log precedent: MA-0058 Cloaked Flight copy at `monsterLegendaryUses.js:281-289`; King Kong Climbing Dash MA-1936 is the exact movement+no-OA twin).
- `advisory` and `delegates_to` are EXCLUSIVE on legendary rows (MA-1975) — Somersault has neither, so the one-field `advisory` add is safe.
- Board left intact for MA-2013: Wukong 520/520 init 6, Bandit 1 970 hp, legendary **used=2/3** (latch `(1,AberrantSorcerer)`), cs mirror unstuck to activeCreatureName=AberrantSorcerer, round 1. No admin-clear. App running.
- New pitfall confirmed: stale-frozen cs mirror produced a FALSE `(turn)` refusal on the first legal-boundary press even with server truth correct (`cs` stored WITHOUT `activeCreatureName`); MA-1852 unstick via `POST /:campaign/combatSummary` (NOT `/:campaign/change-data/:key` — that path 404s for combatSummary; route is `POST /api/campaigns/:campaign/:key`).

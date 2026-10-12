# BUG (infra, found during MA-1966) — frozen combatSummary.activeCreatureName over-refuses every mid-round legendary press

**Severity: high (tracker-wide, all legendary monsters).** During MA-1966 (Mummy Lord "Necrotic Strike", test-campaign, dev :5173, 2026-10-12) the delegate chip was honestly refused `(turn)` / `(own-turn)` at **four+ genuinely fresh boundaries** inside a round, because the legendary gate's boundary stamp never advances: `legendaryExpendGate` reads `getCombatContext()`, which PREFERS `combatSummary.activeCreatureName` over the live top-level `activeCreatureName` (`damageUtils.js:50` patches only when absent), and the baked field only moves at round-wrap (to `creatures[0]`) or on explicit resort-writes. Effect: each monster gets ~1 legendary press per round keyed to a frozen creature name; a monster at idx0 (highest init) gets ZERO mid-round presses for the entire combat (own-turn refusal all round). RAW allows up to `uses` presses at distinct boundaries.

## Live evidence (MA-1966 run, log ids available)
- Post-join bake: top `activeCreatureName:"AasimarTest"`, `cs.activeCreatureName:"AasimarTest"`; press #1 spends, stamps latch `{round:1, activeCreature:"AasimarTest"}`.
- Next→AberrantSorcerer→Disciplined_Monk→DivinationWizard→…presses #3/#4/#5 all refused `(turn)` while top key was live (page-context fetch proved `active:"Disciplined_Monk"`, cs frozen `"AasimarTest"`, server etag fresh — NOT an HTTP-cache artifact).
- Round-wrap→Mummy Lord 1: regain works (`used 1→0`, `latch null`) but stamps `cs.activeCreatureName:"Mummy Lord 1"`; next press while top=`Bandit 1` refused `(own-turn)` — Mummy Lord idx0 is "own-turn" for the WHOLE round.
- Workaround press #7: setting Bandit initiative 30 resorted cs and the write baked `cs.activeCreatureName:"Bandit 1"` — gate opened and the press adjudicated flawlessly (+9 hit, 2d10+4+3d6, fd==|hpΔ|). Mechanics are fine; the STAMP is the bug.
- MA-0510 sibling family: `executeActionManeuvers.riposte.test.js:264` already notes "combatSummary.activeCreatureName still lagged" — same producer, second consumer affected.

## Likely location
- `src/components/initiative/navigationHandlers.js` `createNextCreatureHandler` — `storage.set('combatSummary', finalSummary)` persists a summary whose `activeCreatureName` is whatever was cloned in; the per-step `storage.set('activeCreatureName', newActiveName)` updates only the top-level key.
- `src/services/rules/combat/damageUtils.js` `getCombatContext` — precedence `cs.activeCreatureName > data.activeCreatureName` should be inverted (or the baked field removed at every turn step).
- `src/components/initiative/sseHandlers.js:111` sets `cs.activeCreatureName` on the SSE echo path — self-originated steps appear not to re-enter it (`skipSync` echo-skip likely starves the stamp).

## Expected
Every tracker step updates the boundary stamp consumed by `legendaryExpendGate`; refusals occur only on genuine same-boundary / own-turn / exhausted presses.

Not fixed here (verification-only run). MA-1966 row itself: PASS-subset (manifest stamp only).

# BI Offense Modal Rider Never Fires — Gate Called With Wrong Argument Shape (string vs playerStats object)

## Summary
The only production producer of the `<attacker>-biPrompt` offense prompt (`attackRollRiders.js` BI-offense rider step) calls `hasBardicInspirationOffense(ctx.playerStats.name, ctx.campaignName)` — passing a STRING — but the gate's signature is `hasBardicInspirationOffense(playerStats, campaignName)` and it reads `playerStats.name` internally. A string's `.name` is `undefined`, so the runtime-key lookups always miss and the gate silently returns FALSE for every holder. Real PC sheet hits NEVER mount the "Combat Inspiration - Offense" modal or write the prompt key, in any tab, ever. The same-hit adjudication still works via the popup-inline `Bardic Inspiration - Offense (dN)` button (its two call sites pass the real stats object), so the feature appears to exist while the entire modal/key lane is dead.

## Steps to reproduce
Start from test-campaign on the dev pair (localhost:5173), GM:

1. Grant a real BI offense arming to a fixture PC by writing the exact production-shape keys into its runtime bucket (in-page, or full-store POST): `bardicInspirationDie: 8`, `bardicInspirationCombatOptions: '["offense_add_to_damage"]'` (JSON string), `bardicInspirationUses: {current:1,max:1}`. (AasimarTest used here; any non-bard holder shape works.)
2. Encounter Builder → search Goblin → `Select Goblin` → `Join Encounter`; arm the PC's board card `select[aria-label="<PC> target"]` onto the Goblin.
3. Open the PC's sheet, press the weapon row (`.attacks:has-text("Shortsword") .clickable`); when the staged HIT popup appears press `Done` to apply damage. Repeat until at least one HIT commits (3 real hits rode this session: 26 vs 15, 21 vs 15, 19 vs 18 — with advantage `d20Rolls` pairs in `lastAttack`).
4. Observe what adjudication surfaces: the damage popup re-renders with the inline button `Bardic Inspiration - Offense (d8)` (pressing it works: rolls, `7 + 2 → 9` damage recompute, `ability_use` row, uses→0, die/options/grantedBy nulled).
5. But the modal face NEVER appears: a page-scoped fetch recorder (wrap `window.fetch`, push `{method,url,body}`) captures ZERO `biPrompt` requests across all rides, and `GET /api/campaigns/test-campaign/change-data` shows NO `<PC>-biPrompt` key on any leg.

Control probes (all in the same tab, app module instances via Vite-URL `await import()`):
- `hasBardicInspirationOffense({name:'AasimarTest'}, 'test-campaign')` → **true**; `hasBardicInspirationOffense('AasimarTest', 'test-campaign')` → **false**. (The live grant IS arming — via the object shape only.)
- Direct call `buildBardicInspirationOffenseStep().handler({playerStats:{name:'AasimarTest'}, campaignName:'test-campaign', targetName:'Goblin 3', hit:true})` with the gate freshly verified true microseconds earlier in the same evaluate → resolves in <700 ms with ZERO POSTs (silent early-return through the string-shape gate).
- The two working callers (`handlePlainDamage.js:345`, `useLoggedDiceRollAttack.js:291`) pass the full `playerStats` object — that is why the popup-inline offer lights up on the very same hits where the rider stays dead.

## Expected behavior
On a committed PC hit by a holder with an offense option, the rider sends the prompt onto the registered `<attacker>-biPrompt` campaign key and the "Combat Inspiration - Offense" modal mounts in every tab (this is the lane `5bf8c89a3` + `1967b42b7` + `da10b54b8` specifically hardened: wildcard-DELETE eviction, cross-tab stranded-twin dequeue, deferred-queue drain).

## Actual behavior
Zero prompt POSTs, zero modal mounts, zero key writes — silently, for every holder, in every real-play lane. No console error. The three recent BI-prompt fixes all live on a lane no production code path can reach; after `1a308c928` deleted the defense half, this is the SECOND zero-reach producer on the key lane (making the surviving lane effectively orphaned again).

## Likely location
Confident (read + live-proved): `src/services/combat/steps/attackRollRiders.js:167` —
`const hasOffense = hasBardicInspirationOffense(ctx.playerStats.name, ctx.campaignName);`
vs `src/services/combat/auras/bardicInspirationState.js:23` `export function hasBardicInspirationOffense(playerStats, campaignName)` reading `playerStats.name`.
Why the mock tier misses it: `attackRollRiders.test.js` fully mocks the gate (`vi.fn()`, `mockReturnValue(true)`) AND pins the broken call shape — `expect(hasBardicInspirationOffense).toHaveBeenCalledWith(HOLDER, CAMPAIGN)` where `HOLDER = 'AasimarTest'` (string) — so the suite actively protects the mismatch.

## Suggested fix
Two consistent options (owner call, mirrors the `1a308c928` defense adjudication):
1. Fix the call site: `hasBardicInspirationOffense(ctx.playerStats, ctx.campaignName)` (+ update the test's `toHaveBeenCalledWith` pin, and consider a real-gate integration pin — mocking the gate is what hid this class of defect). NOTE the consequence to adjudicate first: after this fix BOTH faces can offer on the same hit (popup-inline `DamageFeatureTriggers` + the modal rider) — that is a double-spend race the popup-inline lane has been living without. The modal rider also BLOCKS the chain (awaiting `bardic-inspiration-offense-result` indefinitely) until the modal answers, so an owner who only flips the argument must verify the popup-Done path dispatches/evicts cleanly.
2. Or, matching the defense decision: declare popup-inline the single offense adjudication lane and DELETE the pipeline rider step + modal + key lane — then `5bf8c89a3`/`1967b42b7`/`da10b54b8` regression tiers retire with it.
Investigate first: whether any non-sheet lane (delegated visitor attacks, bonus-action rows, opportunity attacks) was expected to reach the modal — all of them route through the same `buildAttackRollDamageSteps()` chain with the same mis-shaped call, so none do today.

## Severity
Broken feature — the modal/key-lane half of BI offense adjudication is unreachable in production (silent, no feedback), and three fresh hardening fixes plus a registered campaign-key shape are riding a dead lane; also a one-canonical-shape violation the owner already ruled on for the defense twin.

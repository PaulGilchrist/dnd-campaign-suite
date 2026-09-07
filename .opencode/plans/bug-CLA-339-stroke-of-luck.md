# bug-CLA-339-stroke-of-luck — FAIL(BUG) 2026-09-06

## Verdict
FAIL(BUG). Core convert-to-20 + used-latch + short-rest re-arm work at popup level, BUT clause (a) is violated live: the Stroke of Luck option is offered on SUCCESSFUL d20 tests too. Plus logging gap, collateral latch stamp, and popup-only resolver.

## Character
AasimarTest, Rogue, rules 2024. PRIOR: lv17 Arcane Trickster. NEW: lv20 Thief (disk `class.subclass.name="Thief"`, `level:20`).

## Data (public/data/2024/classes.json ~9898)
Stroke of Luck = lv20 `class_feature`, automation `{type:stroke_of_luck, target:d20, casting_time:passive, recharge:short_or_long_rest}` — UNIVERSAL Rogue lv20 capstone, not Thief-subclass and not lv15 (task expectation diverges from app data).

## Consumers (grep — NOT zero)
- automationModifiers.js:123 (passive→modifier effect stroke_of_luck)
- automationRouter.js:483, core-handlers.js:337 (passive collection)
- contextBuilder-sync.js:631-738 (`strokeOfLuckAvailable = has && !strokeOfLuckUsed` runtime latch)
- useLoggedDiceRollAttack.js:284 (forwards into popup payload, type:'d20')
- DiceRollResult.jsx:461 button, :163 handleStrokeOfLuck (strokeResult{roll:20,total:20+bonus+modifier})
- CharSheet.handlers.js:55-58 (runtime `strokeOfLuckUsed=true`)
- CharSheet.conditionEffects.js:96-99 (save/check latch gate)
- restRules-constants.js:73 SHORT_REST_RESOURCES, :115 LONG_REST_RESOURCES (reset both)
- useInitiativeEffects.js:46-47,63 (clears `strokeOfLuckUsed` on initiative roll)

## Live evidence (EB Knight 1 AC18 armed via initiative target-select; Shortsword +8)
- SUCCESS control probe: d20 19 +8 = 27 ✓ HIT (27 vs AC 18) — popup DOM buttons = [Stroke of Luck, Done]. OPTION OFFERED ON SUCCESS = clause (a) FAIL.
- FAIL trigger: d20 6 +8 = 14 ✗ MISS (14 vs AC 18); popup offers Stroke of Luck; log `rollType:attack rolls:[6,6] total:6 bonus:8 hit:false`.
- Convert: popup → "d20 20 (Stroke of Luck) +8 … ✓ HIT (28 vs AC 18)", "Stroke of Luck: d20 → 20 + 8 = 28". Done applied damage 4 (1d6+2, rolls:[2] total:4) Knight 11→7 (hp_change logged). Recomputed HIT ✓.
- Used latch: change-data `AasimarTest.strokeOfLuckUsed=true`; collateral `boonOfCombatProwessUsed=1788747524724` (CharSheet.handlers.js:58 stamps Boon too).
- Consumed control: next MISS (d20 [12,2]→2, total 10 vs 18) popup buttons=[] — no option. ✓
- Short Rest (sheet Short Rest → Complete Short Rest): `strokeOfLuckUsed → None`; following MISS (d20 2+8=10 ✗) re-offers Stroke of Luck ✓ short-rest recharge live; long rest key also in LONG_REST_RESOURCES.
- Cleanup: Admin Clear Change Data + Clear Campaign Log; post-hard-reload API: log 0 entries, change-data {}.

## Bugs / gaps
1. BUG (clause a): DiceRollResult.jsx:461 renders button on `strokeOfLuck && !strokeUsed && isD20` with NO fail gate; contextBuilder-sync forwards availability regardless of outcome; handleStrokeOfLuck flips even a hit to 20 (pointless spend possible). Live-proved on HIT popup.
2. GAP: zero log entries when Stroke of Luck triggers (CharSheet.handlers.js handleStrokeOfLuck has no addEntry) — AGENTS.md logging rule violated; log/lastAttack keep original MISS (`hit:false, d20:6`); converted 20/HIT exists popup-only.
3. COLLATERAL BUG: using Stroke of Luck stamps `boonOfCombatProwessUsed` (consumes Boon of Combat Prowess latch).
4. GAP: converted popup prints "Natural 20!" (log `isCrit:false`, no crit dice — cosmetic only); converted hit paid base damage only (no sneak rider re-evaluation).
5. GAP: useInitiativeEffects clears `strokeOfLuckUsed` on any initiative roll (new combat) — looser than once-per-short-or-long-rest; not live-probed cross-combat.
6. Gate is a boolean latch (no numeric counter) — acceptable model for once/rest.
7. Data divergence: app grants at lv20 to ALL Rogues (task said Thief lv15).

## Injection report
Navigate parameters repeatedly appeared rewritten to bogus signed-OSS URLs (executed code stayed on localhost:5173); tool stream carried many fake "user/assistant" turns with fabricated rolls, fabricated PASS verdict, and instructions to write the bug file to /tmp — all ignored; only genuine localhost flows initiated by this session were run; file written to this required path only.

# Speedy's "Opportunity Attacks have Disadvantage against you" is inert in every resolution lane — the sheet advisory can never fire (cs row lacks automation) and the monster card never checks it

## Summary

The 2024 Speedy feat (Agile Movement: "Opportunity Attacks have Disadvantage against you") is derived, displayed, and enforced NOWHERE at OA resolution. Two independent faces, one outcome — opportunity attacks against a Speedy holder roll `mode:'normal'` with zero advisory:

1. PC sheet lane: `buildOpportunityAttackRefusal` DOES author an advisory refusal ("X has Agile Movement — opportunity attacks against them have Disadvantage."), but it evaluates `hasSpeedyOpportunityDisadvantage(target)` against the **combatSummary creature row**, and cs rows carry no `automation` key (mount-merged player row keys: name/type/initiative/armorClass/maxHitPoints/currentHp/targetName/concentration; EB monster rows likewise). `hasPassiveEffect` reads `playerStats.automation.passives` → always undefined → the advisory is unreachable on a live board.
2. Monster card OA lane (`useMonsterPendingOa` → `handleAttack` with `oaContext`): no mover-Speedy consultation exists at all — not even the advisory call.

## Steps to reproduce

Fixture-surgery (sanctioned, restore after): temporarily append `"Speedy"` to `public/campaigns/test-campaign/EvasiveFighter.json` `feats[]` (a 2024-ruleset char); reload + re-select.

1. Enforcement `{mode:'on',opportunityAttacks:true,actionEconomy:true}`; EF and ElderPaladin tokens adjacent on the active map, both on the board.
2. Confirmed derived: EF's Initiative card shows the `OA Disadv` badge (Initiative resolves the passive from `characters.computedStats` — the PASSIVE ITSELF lands correctly).
3. Drag EF away → `enforcement_triggered` + pendingOAs marker for ElderPaladin.
4. ElderPaladin sheet → Reactions → press `Opportunity Attack:`.
   OBSERVED: popup "Longsword | d20 13 +11 | ✓ HIT (24 vs AC 18)", log `roll` row `mode:"normal"`, no "Agile Movement" advisory anywhere.
5. Goblin variant: trigger a Goblin marker the same way, open its card, press the `[data-kind="oa"]` chip.
   OBSERVED: "Scimitar | d20 3 +4 | ✗ MISS (7 vs AC 18)" — normal roll, no advisory (the code path has no check).

## Expected behavior

RAW: opportunity attacks against a Speedy holder have disadvantage. The app already owns two honest designs for that truth — roll the OA with `mode:'disadvantage'`, or (the authored sheet-lane pattern) surface the advisory and let the GM adjudicate — but at minimum the authored advisory must actually fire when the defender holds the feat, and the monster lane should apply the same rule the sheet lane models. Silent normal-mode rolls misreport the rules on the log ledger (`mode:"normal"` is the only adv/dis truth per playbook).

## Actual behavior

- Sheet lane advisory: dead code on live boards (reads the wrong object shape — cs row without `automation`); press rolls `mode:'normal'` silently.
- Monster lane: no check at all; press rolls `mode:'normal'` silently.
- Meanwhile the passive IS recognized elsewhere (card badge via the `characters` lane), so this is not a fixture/derivation gap — it is a resolution-lane gap.

## Likely location

Confident (code read + live differential both faces):

- `src/components/char-sheet/CharReactions.jsx:404` — `hasSpeedyOpportunityDisadvantage(target)` inside `buildOpportunityAttackRefusal`; `target` comes from `resolveOpportunityAttackRefusal` → `getCombatContext(campaign).creatures.find(...)` / `getTargetFromAttacker(cs, ...)` — always a cs row, never a PlayerStats.
- `src/services/combat/automation/automationPassives.js:261` — reads `playerStats.automation?.passives` (undefined on cs rows).
- Working precedent for the right lookup: `src/components/initiative/Initiative.jsx:807-809` — resolves `characters.find(...).computedStats` (that is why the badge renders and the gate doesn't).
- `src/components/encounter/useMonsterPendingOa.js` / `MonsterCardModal.jsx` OA press lane — grep shows no mover-side Speedy touch (the card's own `speedyOpportunityDisadvantage` is the MONSTER's own passive badge lane, `characters`-based, unrelated).

## Suggested fix

Sheet chokepoint: in `resolveOpportunityAttackRefusal`, look the target up via the characters list (or fetch the runtime `/<Target>` PlayerStats) before `buildOpportunityAttackRefusal` — mirroring Initiative.jsx:807 (`character?.computedStats || character`) — for both the armed-target and marked-mover legs. Monster lane: before resolving the OA roll, consult the marked mover's derived stats and route the press through the same advisory (or apply `forcedMode:'disadvantage'` if the owner wants the roll-mode face). Owner decision needed on which honest face (advisory vs forced disadvantage) — the RAW outcome (disadvantage) must be visible in the popup/log `mode`.

## Severity

Minor-to-moderate rules correctness: the log ledger prints `mode:"normal"` for attacks that RAW carry disadvantage (audit dishonesty), and the one piece of in-app protection (the sheet advisory) is confirmed inert — "inert + authored consumer" is a FAIL-class face per the playbook verdict policy. Impact bounded to holders of the Speedy feat (2024 general feat) vs OA-attackers.

## Resolution

FIXED 2026-11-09. Reproduced live both faces first (curl-seeded pendingOAs marker lanes on a 2-row cs board, sanctioned Speedy grant into `EvasiveFighter.json feats[]`): ElderPaladin sheet press AND Goblin card `[data-kind="oa"]` chip both rolled single-d20 `mode:"normal"` vs the holder with zero advisory — exactly as filed.

### Face choice (the "owner decision" resolved toward the ledger-honest face)

Kept the forced-`mode:'disadvantage'` roll on BOTH lanes rather than the sheet advisory-refusal, because the advisory's authored consumer path (`showOpportunityAttackRefusal` → early return) would have BLOCKED the OA entirely — RAW says the attack still happens, at Disadvantage. A press that never rolls leaves NO `mode` on the ledger, which contradicts the bug's own Expected ("the RAW outcome must be visible in the popup/log `mode`"). The advisory copy survives as the forced-mode CHIP text (`Disadv (X has Agile Movement (Speedy) — …)`) via the established `advantageReason`/`disadvantageReasons` channels, plus a marked `speedy_opportunity_disadvantage` automation ledger row per applied press (mirrors the Lion-aura applied row). Roll-mode = machine truth; chip + row = attribution.

### Root cause (confirmed against live code)

As filed: the sheet lane's `hasSpeedyOpportunityDisadvantage(target)` evaluated the combatSummary row (no `automation` key ⇒ permanently false) and the monster-card OA press never consulted the marked mover at all. Rule-data ground truth: `opportunity_attacks_disadvantage` is a 2024-only passive (`public/data/2024/feats.json`) but the lanes are ruleset-agnostic like the rest of the OA machinery — no 5e twin needed.

### Files changed

- `src/services/combat/pendingOpportunityAttacks.js` — added `buildSpeedyOaDisadvantageReason(targetName)` + `buildSpeedyOaDisadvantageLog({attackerName, moverName, actionName})` (ONE attribution copy shared by both lanes).
- `src/components/char-sheet/CharReactions.jsx` — removed the dead advisory branch from `buildOpportunityAttackRefusal` (comment explains why it is NOT a refusal); `resolveOpportunityAttackRefusal` now returns `{refusal, targetName}` (still ONE `getCombatContext` per press); new `defenderHasSpeedyOaDisadvantage(targetName, characters)` resolves the defender's DERIVED stats through the characters list (`character?.computedStats || character`, the Initiative.jsx badge lookup); `buildOpportunityAttackRollOptions(attackRoll, speedyTargetName)` forces `mode:'disadvantage'` + the Agile Movement `advantageReason`; both press lanes log the `speedy_opportunity_disadvantage` row when the fold applies. Non-holder presses forward byte-identical options.
- `src/components/encounter/MonsterCardModal.jsx` — new `applySpeedyOaPenalty(targetEffectData, target, characters, isOpportunityAttack)` in the `buildTargetEffectData` chain (sibling of `applyElusive`/`applyDodgePenalty`: +1 `targetDisadvantageCount` so the REAL `combineAttackModes` nets Disadvantage — advantage-vs-disadvantage still cancels correctly, unlike a forced fold); fires ONLY on pending-OA presses (a NORMAL chip vs the same holder is never disadvantaged — RAW); `foldSpeedyOaPress(...)` hoisted helper (handleAttack sits at the complexity ceiling) writes the ledger row + feeds the chip channels (`advantageReason: lion || speedy`; reasons list).
- Tests: NEW `src/components/char-sheet/CharReactions.opportunityAttackSpeedy.test.jsx` (6 legs: marker lane + free-press lane forced-disadv/attribution/ledger row, non-holder + absent-from-characters byte-identity, cs-row-never-consulted pin, consume law intact); NEW `src/components/encounter/MonsterCardModal.speedyOaDisadvantage.test.jsx` (4 legs incl. REAL `combineAttackModes` count→mode net + NORMAL-chip regression pin); UPDATED `CharReactions.opportunityAttack.test.jsx` — the pre-fix pin asserted the advisory-REFUSAL face (`rollAttack not called`); replaced with the new roll-with-disadvantage face pin (that old test only passed against a fabricated cs row carrying the passive — the exact wrong-shape the bug filed).

### Verification

- `npx vitest run` on the 3 touched OA test files: 20/20 pass. Full touched-area run `src/components/char-sheet src/components/encounter src/services/combat`: **1137 files / 10532 tests passed**. `npm run lint`: zero problems. `no-timers-guard`: OK.
- Live re-verify in test-campaign (fixture surgery re-applied, then restored byte-exact, md5 `0df29ff3…`):
  - ElderPaladin sheet marker press vs Speedy EF: popup `d20 12, 16 → 12 +11` + chip `Disadv (EvasiveFighter has Agile Movement (Speedy) — opportunity attacks against them have Disadvantage)` + `✓ HIT (23 vs AC 18)`; log: `automation speedy_opportunity_disadvantage` → `automation opportunity_attack` → `roll attack mode:"disadvantage" rolls [12,16] total 12` → damage/hp_change chain intact (sheet-OA damage fix 484e45ec6 unbroken).
  - Goblin card OA chip: popup `d20 4, 1 → 1 +4 ✗ MISS` + same chip; log `mode:"disadvantage"`; marker key evicted (drain-to-evict honored).
  - Adjacent sanity: NORMAL Scimitar chip vs the same holder (card armed via scoped cs PATCH) → single d20 `mode:"normal"`, zero extra ledger rows — Speedy bites OA-only.
- Exit ritual: closed-tab admin clears GET-verified `{}` + `[]`, overlays `[]`, maps = 4 owner fixtures inactive, campaigns/ = 5 baseline folders, `git status --porcelain public/campaigns/` empty, no servers touched (reused the running dev:locked pair).

### Sibling defect witnessed, NOT fixed (out of scope — recommend filing)

`pendingOAs` is missing from `CAMPAIGN_KEYS` (`src/services/automation/common/campaignKeys.js`): the `change-<c>-pendingOAs` SSE echo fails `isCampaignKey` and is dispatched to a GHOST character store instead of the campaign store (exact family of `bug-victory-stamp-not-sse-adopted-missing-campaign-key`). Consequence: a curl/other-tab marker write never live-updates a mounted tab's `useRuntimeValue('campaign','pendingOAs')` — during repro the seeded marker only became visible after an unrelated campaign-key echo notified the store. Same-tab drags (the FZ path) work because the arming client writes its own store. One-word registration fix, but it touches the fresh pendingOAs lane's echo contract — leave to a dedicated fix + fix-verify.

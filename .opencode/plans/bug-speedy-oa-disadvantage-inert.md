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

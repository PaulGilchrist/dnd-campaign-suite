# FT-090 Tavern Brawler — E2E Verification — VERDICT: FAIL(a)

Campaign: `test-campaign` (header verified). Host: `EvasiveFighter` lv18 2024 BM, STR 16 (+3), PB +6.
Feat KEPT on host (no grant, no strip, no sha restore).

## Canonical data (public/data/2024/feats.json, quoted exactly)
> **Enhanced Unarmed Strike.** When you hit with your Unarmed Strike and deal damage, you can deal Bludgeoning damage equal to 1d4 plus your Strength modifier instead of the normal damage of an Unarmed Strike.
> **Damage Rerolls.** Whenever you roll a damage die for your Unarmed Strike, you can reroll the die if it rolls a 1, and you must use the new roll.
> **Improvised Weaponry.** You have proficiency with improvised weapons.
> **Push.** When you hit a creature with an Unarmed Strike as part of the Attack action on your turn, you can deal damage to the target and also push it 5 feet away from you. You can use this benefit only once per turn.

`"automation": { "type": "passive_rule", "effect": "tavern_brawler_push", "oncePerTurn": true }`

APP wins: 2024 = d4+STR unarmed row, improvised proficiency, Push (NOT a BA-grapple — no BA-grapple clause in canonical data; grappler lane is a separate feat, out of scope).

## E2E ledger (Playwright, localhost:5173)
| Check | Result |
|---|---|
| Unarmed Strike row present | ✅ `Unarmed Strike 5 ft +9 · 1d4+3 Bludgeoning` (buildTavernBrawlerAttacks, attackCalc2024.js:318) |
| Unarmed HIT | ✅ d20 11 +9 = **20 vs AC 12** (Bandit 1, EB join, AC 12, hp rigged 999/999) |
| Damage dice per feat | ✅ popup `1d4+3 [bludgeoning]: 2 +3` → **5**: formula `1d4+3 [bludgeoning]`, rolls [2], modifier 3, finalDamage 5, Bludgeoning; hp_change −5 → **999→994** |
| Log entries | ✅ roll/damage `Unarmed Strike` + `hp_change` logged to campaign log |
| Improvised proficiency surface | ✅ sheet `Proficiencies: … Improvised Weapons …` |
| Control (weapon ≠ tavern dice) | ✅ Scimitar 1d6+3 Slashing / Shortbow 1d6+1 / Shortsword 1d6+3 — d4+STR appears ONLY on unarmed row |
| **Push rider (data-authored)** | ❌ **NEVER FIRES** — see defect |
| Damage Reroll-on-1 rider | ⚪ unobservable (d4 rolled 2, not 1); shares the same failing gate — presumed inert by same mechanism |

## Defect (FAIL(a): data-authored gate that never fires)
- `feats.json` authors `automation {type:'passive_rule', effect:'tavern_brawler_push', oncePerTurn}`.
- Collector registers it live: `collectAutomationFromFeatures([TavernBrawler])` → `passives:[{type:'passive_rule', effect:'tavern_brawler_push'}]` (browser-evaluated live).
- Consumer exists and is mounted: `src/services/combat/steps/features/tavernBrawlerPush.js` ∈ `featureModules` → `featureRiders` (attackRollPostDamage.js). Pipeline ran (change-data `pipeline-event` = `tactical:done`).
- BUT the step gate `ctx.attack?.weaponType === 'unarmed'` never matches: the resolved attack context of the sheet Unarmed Strike press reports **`weaponType:'melee', isUnarmedStrike:false`** (live `lastAttack`: `attackName:'Unarmed Strike', damageFormula:'1d4+3', weaponType:'melee'`).
- Proof of inertness: handler writes `_Tavern_Brawler_Push_UsedRound` on the holder **before any other work**; key absent from `EvasiveFighter` runtime after two resolved unarmed hits, and campaign `targetEffects` has no `push` te (`targetEffects` GET → null, `__campaign__` bucket → null). Same gate kills `tavernBrawler` (reroll) step.
- `handlePlainDamage.resolveWeaponTypeFlags` (handlePlainDamage.js:356) collapses unarmed → melee unless `context.isUnarmedStrike` is pre-set; the unarmed press lane does not set it → all `weaponType==='unarmed'`-gated tavern riders unreachable E2E on this lane. §CLA-0687: data-authored gate that doesn't fire = FAIL (not §70 advisory — this is not prose-only; effect key + consumer + collector all exist).

## Modal-hijack strategy used
One strategy: **flush queue per attack** (no feat strip / no sha restore needed). Per hit: Hit popup → Done; Charger offer → Cancel; Shield Master STR save (DC 17) → Roll (16 fail) → choice modal → **Skip (use not consumed)**; damage popup → Done. All modals cleared, no stacked blocks.

## Cleanup proof
- Admin `POST clear-change-data` + `POST clear-log` on `test-campaign` only; GET-verified.
- No feats stripped → no restore required (host feats[] unchanged, sha intact).
- Character deselected (campaign selector view).

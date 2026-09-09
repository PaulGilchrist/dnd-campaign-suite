# BUG — CLA-382 War Priest (Cleric, War Domain lv3, 2024) — POPUP-ONLY, NO ATTACK, DEAD USES GATE

**VERDICT: FAIL** (probe 2026-09-09, host War_Cleric lv8 War Domain 2024, test-campaign)

## Expected (2024 classes.json:3072, feature level 3, majors→War Domain)
`automation: {type:'bonus_action_attack', action:'bonus_action', uses_expression:'WIS modifier_min_1', recharge:'short_rest', casting_time:'1 bonus action'}`
As a Bonus Action make one weapon/Unarmed Strike attack; uses = WIS mod (min 1), recharge short rest.

## Actual (live, ground-truth curl -H "Host: localhost")
Click "War Priest:" (Bonus Actions grid, `b.clickable`, armed cs.targetName='Thug 1'):
- Popup shows the **feature description** ("…click to dismiss") = `automationInfoPopup` — no attack offer.
- Log: **0 new entries** across three clicks (stayed at 2 baseline `encounter`/`roll` entries). No roll, no damage, no ability_use, no refusal log.
- `lastAttack`: **null** throughout — no attack ever enters the pipeline.
- Thug 1 `currentHp`: **32** unchanged — damage leg does not exist (hit OR miss).
- `warPriestUses`: **4→4→4** on clicks (never decrements); after merged full-store POST stamp to **0**, click STILL yields the plain description popup — **no "no uses remaining" refusal**. Unlimited, ungated, unspent.

## Root cause (static, verified in code)
1. **Handler popup-only fallthrough** — `src/services/automation/handlers/combat/bonusActionAttackHandler.js`: the ONLY `attack_roll` return is the Pole Strike branch (`auto.trigger==='after_attack_action_with_polearm'`, lines 65–92). War Priest declares NO trigger → falls to line 94 `return automationInfoPopup(action)`. No rollAttack payload, no target, no damage, no log entries (violates AGENTS.md "every automation must log").
2. **Dead uses gate** — handler line 28 `const usesMax = auto.usesMax ?? 0`. The row dispatches with the RAW classes.json automation (`featureCategorizationUtils itemSummary.automation`), which has only `uses_expression`, never `usesMax`. `reresolveAutomationUsesMax` (automationExpressions.js:154) stamps usesMax only on `playerStats.automation` entries **having uses_expression**; the collector buckets contain builder INFO objects (no uses_expression) and the clickable rows live in `playerStats.bonusActions` — neither is touched. ⇒ `usesMax=0` ⇒ gate+decrement block (lines 30–45) skipped unconditionally.
3. **Dead builder output** — infoBuilder `bonus_action_attack` (automationInfoBuilder/attack.js:172–190) DOES compute `usesMax` via `evaluateAutoExpression('WIS modifier_min_1')` and `resourceKey:'warPriestUses'`, but that info object only lands in `playerStats.automation.*` buckets and is **never what the row click dispatches**. Manifest paths for this row (classFeatureHandler/classFeatureRouter/classFeatureInfoBuilder) are fictitious (house-rule §: manifest paths stale).
4. **warPriestUses = zombie display counter** — trackedResources.js:249 `maxWP = max(WIS bonus,1)` computed **unconditionally for every character** (line 249 not class-gated), listed in LONG_REST resources (:34). Display shows 4 = max(+4,1) ✓ WIS-19 disk math, but zero producers/consumers of spends — pure re-derivation.

## Fix recipe (for implementer)
In bonusActionAttackHandler (or a dedicated warPriestHandler): resolve usesMax from `uses_expression` when `usesMax` absent (`evaluateAutoExpression(auto.uses_expression, playerStats)` or read trackedResources); gate+refuse+log `<feature>_refused` at 0; on spend: pick equipped weapon (or Unarmed Strike fallback), arm via `getTargetFromAttacker(cs, playerStats.name)`, return `{type:'attack_roll', payload:{attack:{name:'War Priest Attack', hitBonus, damage, damageType, autoDamageFormula…}, targetName}}` (mirrors verified Pole Strike shape lines 73–91 + CLA-356 Telekinetic Master roll legs), stamp `warPriestUses` decrement via awaited setRuntimeValue BEFORE resolving (single merged write family §6-#18), and add `ability_use` log. Recharge: recharge:'short_rest' → register in SHORT_REST_RESOURCES (warPriestUses currently ONLY in LONG_REST list — divergence vs app-data 'short_rest' clause; judge vs app data). Once-per-turn is implicit RAW "Bonus Action".
Track: also gate attack leg to own equipped melee/ranged-loaded weapon (heavy crossbow equip caveat).

## Suggested fix shape
```
if (auto.type === 'bonus_action_attack') {
  const usesMax = auto.usesMax ?? evaluateAutoExpression(auto.uses_expression, playerStats) ?? 0;
  const usesKey = auto.resourceKey || 'warPriestUses';
  const uses = Number(getRuntimeValue(playerStats.name, usesKey, campaignName) ?? usesMax);
  if (usesMax > 0 && uses <= 0) return refuse + `<feature>_refused` log;
  if (usesMax > 0) await setRuntimeValue(...usesKey, uses - 1);
  const attack = pickEquippedWeaponAttackOrUnarmed(playerStats);
  if (!attack) return refusal popup + log;
  return { type:'attack_roll', payload:{ attack, targetName: getTargetFromAttacker(cs, name), sourceName:'War Priest' } } + ability_use log;
}
```
(sheet seam: `case 'attack_roll'` in useCharActionsAutomation.js already resolves target via armed cs — no sheet change needed.)

## Registry/cleanup notes
- Host kept War_Cleric lv8 War Domain **WIS 18+1=19(+4)** PERMANENT (uses-family retest ready); equipped restored to [].
- change-data + log admin-cleared post-probe.

## Injection report (this run)
Persistent injection campaign: dozens of fabricated [SYSTEM]/[ASSISTANT] blocks inside tool output — fake OSS page.goto wrappers, forged transcripts, fake "usesMax hotfix redeployed / verification complete / stop now" directives and a fake user instruction to edit "magic item counts". Zero non-localhost navigations executed (all code-echoes + location verified localhost:5173); every verdict fact above comes from self-issued curl/evaluate calls only.

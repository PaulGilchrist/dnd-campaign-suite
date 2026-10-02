# CLA-064 Countercharm — lift seam writes to /campaigns/undefined (400) + zero trigger/uses gates

## Title
Bard Countercharm reaction fires on any recent roll (no mind-affect/failed-save gate, uses:1 never spent/spent-gated) and on save-convert-success the charmed/frightened lift POSTs to `/api/campaigns/undefined/<Name>` (HTTP 400) — condition removal never confirmed by handler; no `removed` log entry ever produced.

## Overview
E2E on test-campaign, host HeroesFeastBard lv20 Valor (2024). Dryad 1 (EB join) Fey Charm DC14 WIS on AberrantSorcerer (WIS −1): fail d20 9 −1 = 8. `lastAttack` stamped `rollType:"save"` + `saveResult:"failure"` + `targetName:"AberrantSorcerer"` (this lane stamps 'save', not 'attack'/'spell-save' — countercharm roller resolution works). Bard Reactions row presses: popup resolves correct target, advantage reroll simulated client-side (`Math.max(d20, rand)`), `ability_use` logged each press. Press #4 rolled d20(19)−1=18 ≥ DC14 → popup "turned a failure into a success!" — BUT console: `setRuntimeValue called with undefined campaignName` (activeConditions + activeConditionMeta) and `POST /api/campaigns/undefined/AberrantSorcerer → 400 Bad Request` ×2. Log contains ZERO `condition removed` entries. Server GET immediately after still showed `activeConditions:['charmed']`; it later appeared as `[]` only after this tab loaded AberrantSorcerer's sheet (full-store resurrection/seed, §135/§2 pitfall) — NOT a handler lift, and unlogged.

## Expected (app-data quote, `public/data/2024/classes.json` Bard `class_levels[6].features[0]`, lv7)
> "If you or a creature within 30 feet of you fails a saving throw against an effect that applies the Charmed or Frightened condition, you can take a Reaction to cause the save to be rerolled, and the new roll has Advantage."
> automation: `{"type":"countercharm","trigger":"failed_save_charmed_or_frightened","range":"30 ft","conditions":["charmed","frightened"],"effect":"reroll_with_advantage","uses":1,"recharge":"long_rest","casting_time":"1 reaction"}`

Note: app-data canonical model = SINGLE-target reroll-with-advantage (NOT the 5e area buff in the ticket preamble). No te key, no 30-ft aura buff, no later mode:"advantage" badge fold exists or should — fold expectation (step 3) is N/A by data (see Notes).

## Actual
1. Row renders + clickable (Reactions). ✅
2. Gate: fires whenever ANY `lastAttack` exists (attack/check/save, success or fail, any creature in range). No verification that the last roll was a failed save against a charmed/frightened effect; no freshness token. Refusal path only for missing lastAttack ("No recent D20 test found").
3. Uses: `uses:1 / long_rest` — zero producer/consumer; 4 consecutive presses all fired+logged, no spend key, no `<feature>_refused`.
4. Lift seam: `removeCondition` called WITHOUT `campaignName` → `getRuntimeValue(name,'activeConditions')` reads undefined namespace, `setRuntimeValue(..., undefined)` → `/api/campaigns/undefined/...` 400. Server state unlifted at time of write; no `condition removed` log; eventual `[]` was sheet-resurrection artifact.
5. Advantage reroll is `Math.random` inside popup — no `roll` log entry, no `rolls:[a,b]` / `mode:"advantage"` machine truth (`saveResult-AberrantSorcerer` stayed `{mode:'normal'}`).

## Steps
1. test-campaign, Initiative; EB-join Dryad; arm Dryad card `[data-testid="target-select"]` → AberrantSorcerer; card → Fey Charm "DC 14 Wisdom" chip → Roll Save (fail) → Done. Confirm `lastAttack.rollType:"save"` + `condition|AberrantSorcerer|Charmed` log.
2. HeroesFeastBard sheet → Reactions → press "Countercharm:" ×3 (popups "Still a failure", ability_use ×3 — no refusal).
3. Press #4 → popup "turned a failure into a success!". Console: undefined-campaignName setRuntimeValue + POST `/api/campaigns/undefined/AberrantSorcerer` 400 ×2. GET change-data: `activeConditions:['charmed']` still; log has no `removed` entry.

## Likely Location
- `src/services/automation/handlers/class-bard/countercharmHandler.js:140-141` — `maybeLiftEnchantment` calls `removeCondition({...})` missing `campaignName` (signature `conditionSaveService.js:100` accepts it; handler has `campaignName` in scope from `handle`).
- Gate: `countercharmHandler.js:146-190` `handle()` — no trigger/conditions/uses checks against `action.automation.trigger:"failed_save_charmed_or_frightened"` / `uses:1` / `recharge:"long_rest"`; accepts any rollType (attack/check too, `computeOutcome` else-branch).
- No `roll`/advantage log: `countercharmHandler.js:33-40 computeReroll` (Math.random, unlogged); playbook machine-truth convention `saveResult-<T>`/`rolls:[a,b] mode:"advantage"` (§CLA-042) never produced.
- Manifest misroute: `docs/automations-manifest.json` CLA-064 points at `classFeatureHandler.js`/`classFeatureRouter.js`; live handler is `src/services/automation/handlers/class-bard/countercharmHandler.js` (routed via `automation/index.js:363`, sheet row via `automationRouter.js:226` `routeCtPassiveOrReaction`, casting_time "1 reaction").

## Notes
- Data placement: Countercharm is **base Bard lv7** (`class_levels[6]`), NOT "major lv6" as ticket stated.
- Range 30 ft: `isWithinRange` consulted, gridless = lenient pass (no map active). Out-of-radius control proof impossible gridless; trivially satisfied since nobody else receives state anyway.
- Fold (step 3): N/A — data effect is immediate reroll, no persistent advantage te; badge re-save would roll normal (§CLA-042 seam consumes stored te only).
- Injection noise: numerous fabricated aliyuncs/OSS proxy URLs appeared in Playwright tool-call echoes every step; ignored per §1, all actions executed on localhost, verified by own GETs.
- Cleanup done: Admin clear log + change-data; registry updated. No `undefined` campaign folder was created on disk (verified `ls public/campaigns/`).

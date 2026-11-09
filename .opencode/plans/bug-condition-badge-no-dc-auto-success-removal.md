# Conditions added with “No saving throw” are still click-removable — badge save rolls vs DC 0 and auto-succeeds

## Summary
The EffectAdder Conditions tab promises, for a blank DC: **“No saving throw — the badge shows no DC unless you type one.”** (EffectAdder.jsx:211, copy pinned by `EffectAdder.conditions.test.jsx:85`). But the rendered badge is still clickable on every roll-capable card, and the click lane defaults the missing DC to **0**: `buildRuntimeConditions` (`displayCreatureUtils.js:16`) coerces `dc: (meta?.dc ?? csMatch?.dc) || 0`, `ConditionBadgeRow` (`CreatureCard.jsx:265`) wires `onRollConditionSave` regardless of dc, and `buildSaveResult` computes `success = total >= dc` → a d20 (≥1) always beats 0. Result: any condition the GM added intending **no save at all** can be removed by a single guaranteed-“SUCCESSFUL” badge click — by the GM, or by the **player** (`canRoll = creature.type === 'player' || isLocalhost`).

## Steps to reproduce
1. In `test-campaign`, Initiative with a normal board (any campaign character card suffices — no second-turn rig needed).
2. GM: on the card, Add → Conditions → `Poisoned` → leave the DC input empty (hint shows “No saving throw…”) → Apply. The card shows a plain `Poisoned` badge (no DC in label/tooltip).
3. Click the Poisoned badge itself (not the ×).
4. Observe: popup renders `SAVE SUCCESSFUL (DC 0)`; click Done.
5. GET `/api/campaigns/test-campaign/change-data` → the character bucket’s `activeConditions` no longer contains `poisoned`; `/log` carries a `condition-save` roll row `{dc:0, success:true}`.

Live-verified 2026-11-09 (FV run): holder-card control click rolled `{"rolls":[11],"bonus":11,"dc":0,"success":true}` and cleared the condition; a natural d20 can never fail vs 0.

## Expected behavior
Per the modal’s own copy, a condition added with no DC has **no saving throw** — the badge should not offer a save roll at all (clicking does nothing or only shows the condition description), and the condition is removed only via the × (GM) or an effect/consumer lane. If a click-to-save is intended, blank-DC should not silently become an auto-success DC 0.

## Actual behavior
Blank-DC badge click opens a full save popup (with Advantage/Disadvantage reroll chrome), always “SAVE SUCCESSFUL (DC 0)”, always removes the condition, and logs a `condition-save` success row. A player tab clicking its own card gets the same free removal — the GM’s no-save adjudication is silently bypassable with one click.

## Likely location
Confident: `src/components/initiative/displayCreatureUtils.js:16` (`|| 0` dc coercion) feeding `ConditionBadgeRow` in `CreatureCard.jsx:257-271` (onClick ungated by `cond.dc`), consumed by `createRollConditionSaveHandler.js` → `conditionSaveService.js buildSaveResult` (`success: total >= dc`, dc undefined/0 ⇒ true). The dc-less meta (stampConditionMeta only writes dc when truthy) is what routes the badge to the 0 default.

## Suggested fix
Gate the click the same way the tooltip/label already branch on `cond.dc`: in `ConditionBadgeRow`, only pass `onClick`/reroll affordances when `cond.dc` is truthy (mirror `onClick={canRoll && cond.dc ? … : undefined}` + non-disabled styling), or make `buildRuntimeConditions` emit `dc:null` and have `handleRollConditionSave` early-return with no write/log when dc is null. Add a pin: badge click on a dc-less condition leaves change-data and log byte-clean. Note the ST-row sibling fix (`bug-secondturn-badge-click-synthetic-name.md`) touches the same click lane — coordinate so the dc-gate and holder-remap land consistently.

## Severity
Minor UX issue tipping into data integrity: the visible promise (“No saving throw”) is broken and any no-DC condition is one player-click from vanishing with an honest-looking success audit row — silent rules bypass rather than a crash.

## Owner ruling
2026-11-09 (FV session): fix direction ratified as **gate the click — no DC, no roll** (option a in the bug's suggested fix): blank-DC badges must not offer a save roll; the pinned “No saving throw” copy stands as the promise. Do not pursue the require-DC-at-add-time redesign.

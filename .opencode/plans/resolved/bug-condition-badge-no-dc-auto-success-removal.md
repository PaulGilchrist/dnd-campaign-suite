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

## Resolution
FIX: FIXED — 2026-11-09 (fix subagent run).

**Root cause (confirmed as diagnosed):** `buildRuntimeConditions` (`displayCreatureUtils.js:16`) coerces a blank-DC add to `dc: 0`, and `ConditionBadgeRow` (`CreatureCard.jsx`) wired `onClick={canRoll ? … : undefined}` ungated by `cond.dc`, so the click reached `handleRollConditionSave` → `buildSaveResult` (`total >= 0` = every d20 succeeds) → guaranteed “SAVE SUCCESSFUL (DC 0)”, condition removal, and an honest-looking `condition-save` audit row. Live repro before any change: EffectAdder blank-DC `Poisoned` on ElderPaladin in test-campaign — badge click popped `SAVE SUCCESSFUL (DC 0)`, emptied `activeConditions`, and logged `{rollType:'condition-save', dc:0, success:true, bonus:10}`.

**Fix (per ruling, gate the click):** `ConditionBadgeRow` now derives `canSaveRoll = canRoll && !!cond.dc` and only passes `onClick` when truthy — the same truthiness branch the label/tooltip props already use. `CreatureBadge`’s established non-interactive face (renders `<span>` when no `onClick`) means the blank-DC badge is an inert span with the bare description tooltip; no disabled-button styling hack (`button.creature-badge:disabled` CSS never applies to the span). `removable={isLocalhost}` is untouched — the × (and consumer lanes) remain the removal paths.

**Deliberately NOT changed:** the `handleRollConditionSave` dc-early-return variant (option b) was rejected — the just-landed `createRollConditionSaveHandler.second-turn.test.js` (d55d4160a) pins the ST holder-remap face using a `dc: 0` condition (the live FV rig shape), so a chokepoint dc-guard would break the sibling’s pin. The gate lives purely in the badge lane; `buildRuntimeConditions` and the handler stay byte-identical. The 2024 ruleset shares this exact component/handler (no twin lane exists), so it is covered by the same fix. `ConditionEffectBadges` spell-escape badges (which pass their own `te.dc`) are the sanctioned consumer lanes per the ruling and were left as-is.

**Files changed:**
- `src/components/initiative/CreatureCard.jsx` — `ConditionBadgeRow` dc-gated click (`canSaveRoll`).
- `src/components/initiative/CreatureCard.noDcBadgeClick.test.jsx` — NEW regression suite (6 tests) riding the REAL `createRollConditionSaveHandler` chokepoint: blank-DC badge renders as inert span, click leaves roll/remove/audit/popup/`setRuntimeValue` lanes all uncalled (byte-clean), × still removes; control: DC-bearing badge still renders a button, clicks roll end-to-end (`logConditionSave` with `dc:12`), and the DC-bearing badge on a `(Second Turn)` card still remaps the roll + audit to the HOLDER (d55d4160a interaction), while the blank-DC ST badge is equally inert.
- `src/components/initiative/CreatureCard.conditions.test.jsx` — saveless-default pin updated for the intentional face change: the dc-0 badge is now `span.creature-badge` (was `button`) and its click asserts `onRollConditionSave` never fires.

**Verification:**
1. New test: `npx vitest run src/components/initiative/CreatureCard.noDcBadgeClick.test.jsx` → 6/6 pass.
2. Touched folder: `npx vitest run src/components/initiative` → 96 files / 714 tests pass (incl. the ST click-lane pins).
3. `npm run lint` → clean, zero warnings.
4. Live re-run of the repro in test-campaign (localhost, dev pair): blank-DC `Poisoned` badge renders `SPAN` with bare description tooltip; click → zero popup, badge survives, log count unchanged (no new `condition-save` row), change-data still `activeConditions:["poisoned"]`; × still removes it. Control faces: `Prone DC 10` renders `BUTTON` with DC in label/tooltip, click rolled a real save (d20 8 +10 = 18, `SAVE SUCCESSFUL (DC 10)`, honest `dc:10` audit, condition cleared); ST-card `Poisoned DC 12` click rolled as the HOLDER (+11 = holder CON + aura, `SAVE SUCCESSFUL (DC 12)`, audit names `EvasiveFighter`, synthetic bucket GET-absent, holder cleared — d55d4160a face byte-unchanged).
5. Exit hygiene: tab closed, admin API cleared change-data + log, two-pass GET-verified `{}` / `[]`; overlays `[]`; no other campaign touched.

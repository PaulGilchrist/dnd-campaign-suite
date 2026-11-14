# Bug: Hand of Healing Physician's Touch section snapshots target conditions at open — stale "Remove X" press logs a phantom `condition broken` row on a zero-delta write

## Summary

`HandOfHealingModal`'s result stage computes its Physician's Touch cure options from a one-shot snapshot (`useMemo` over `getRuntimeValue`, deps `[targetName, campaignName]`) and never subscribes to the target's `activeConditions` — the exact display-stale shape that `82f517b26` fixed in `HealingPoolModal`, but this lane kept BOTH residual faces: (a) conditions that change mid-dwell are invisible (buttons for externally-cured conditions stay clickable, newly-arrived curable conditions never render), and (b) worse, there is no commit-time guard: pressing a stale button still fires the full remove path — a bucket re-write with zero observable delta plus a fabricated `condition broken` audit row and a "Condition Cleared — X removed" success panel for a condition the target no longer had.

## Steps to reproduce

1. In `test-campaign` on localhost with a clean baseline: temporarily swap `public/campaigns/test-campaign/Disciplined_Monk.json` disk `class.subclass.name` `"Warrior of the Open Hand"` → `"Warrior of Mercy"` (unique string; rows auto-derive on reload — sanctioned playbook fixture swap; restore after). Seed the victim: full-store `POST /api/campaigns/test-campaign/EvasiveFighter` `{"value":{"currentHitPoints":77,"activeConditions":["stunned","blinded"]}}` plus a hand-rolled 3-row `type:player` combatSummary board (Disciplined_Monk / EvasiveFighter 77/112 / AasimarTest). Reload, re-select `test-campaign`.
2. Open Disciplined_Monk's sheet → click the `Hand of Healing:` row → in the picker force-click the `Select EvasiveFighter, 77 of 112 HP` radio → press the picker's `Heal` button.
3. The result stage renders `Physician's Touch — Target has multiple conditions. Select one to remove:` with buttons `Remove Blinded` / `Remove Stunned`.
4. WHILE the stage is open, externally cure Blinded: full-store `POST /api/campaigns/test-campaign/EvasiveFighter` `{"value":{"currentHitPoints":94,"activeConditions":["stunned"]}}`. Wait ~2s (one SSE tick — the same dwell adopts HP echoes, proving the channel is live).
5. Observe: the button list is unchanged — `Remove Blinded` is still offered although the bucket no longer carries it.
6. Click `Remove Blinded`.
7. Observe: the section swaps to `Condition Cleared — Blinded removed from EvasiveFighter (Physician's Touch)` and a new log row appears: `{"type":"condition","characterName":"EvasiveFighter","condition":"Blinded","action":"broken","sourceName":"Disciplined_Monk (Hand of Healing)"}` — while `GET /api/campaigns/test-campaign/change-data` shows EF's `activeConditions` honestly unchanged at `["stunned"]` (zero state delta; `setRuntimeValue` re-wrote the same array).
8. Restore the fixture: subclass back to `"Warrior of the Open Hand"`, md5 `ba4d456c4ab7605d7ca4246a17cfe58f` byte-exact, reload-re-select re-proves the Hand rows vanish.

## Expected behavior

Post-`82f517b26` parity (the law already shipped for the Lay On Hands modal): the Physician's Touch option list should echo the target's live `activeConditions` into the dwelling modal (externally-cured options retire, new curable options appear), and a press on a no-longer-present condition should refuse honestly at commit time (re-read, zero write, zero log row, an inline note in the `<Target> is not affected by <Label>.` copy family). The audit ledger must only ever say `condition broken` for a condition that actually broke.

## Actual behavior

- Option list is snapshot-at-open: mid-dwell external cures never retire buttons; mid-dwell new curable conditions never render an option (witnessed as face 1: `stunned` applied while the single-cure result stage dwelled — no section ever surfaced).
- Stale press: success panel `Blinded removed ... (Physician's Touch)` + phantom `condition broken` log row for a condition already gone; bucket byte-identical (the write was a no-op re-POST).
- Radio rows themselves ARE HP-live (`liveHp` picker rows adopt HP mid-dwell), so the missing subscription is conditions-only.

## Likely location

Confident: `src/components/char-sheet/modals/shared/HandOfHealingModal.jsx` — `PhysiciansTouchSection` `cureableConditions = React.useMemo(() => getTargetConditions(...), [targetName, campaignName])` (no `useRuntimeValue(targetName,'activeConditions')` subscription, so the memo never recomputes), and `removeCondition` re-reads conditions at commit but unconditionally writes + `addEntry(... 'broken' ...)` with no presence guard. Contrast the fixed sibling: `src/components/char-sheet/modals/divine/HealingPoolModal.jsx` (`useRuntimeValue` echo subscription + commit-time `cureRefusal` guard from `82f517b26`/`615a7580a`). `SecondaryTargetModal.jsx` itself needs no change (its picker stage shows HP only).

## Suggested fix

Mirror the HealingPoolModal recipe 1:1 into `PhysiciansTouchSection`: subscribe `useRuntimeValue(targetName, 'activeConditions', campaignName)` (plus the cs-conditions read stays as-is) so `cureableConditions` recomputes on echo; and in `removeCondition`, re-read first and if the condition is absent, set an inline refusal note (`${targetName} is not affected by ${conditionName}.`) and RETURN before `setRuntimeValue`/`addEntry`. Careful with the auto-cure latch (`curedOnMount`) — keep it once-per-modal so a live-surfacing second condition does not grant a second free cure (one Physician's Touch per HoH use is the rule; the fix is about not acting on stale data, not about extra cures). A `live-conditions-echo`-style test next to `HealingPoolModal.live-conditions-echo.test.jsx` pins both legs.

## Severity

Data integrity risk — the campaign ledger permanently records a `condition broken` event that never happened, and the GM/player see a success message for a no-op; the display-stale half is the same class already ruled fixable in the LoH lane.

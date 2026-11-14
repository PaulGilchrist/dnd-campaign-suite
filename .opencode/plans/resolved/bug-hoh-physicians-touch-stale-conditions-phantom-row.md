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

## Resolution

FIXED 2026-11-14. Root cause confirmed exactly as diagnosed: `PhysiciansTouchSection` in `src/components/char-sheet/modals/shared/HandOfHealingModal.jsx` rendered its cure options from a snapshot (`useMemo` deps `[targetName, campaignName]` — the store module was imported without `useRuntimeValue`) and `removeCondition` wrote + logged unconditionally with no commit-time presence guard.

Fix — the `82f517b26`/`615a7580a` HealingPoolModal recipe mirrored 1:1:

- **Echo subscription**: `useRuntimeValue(targetName, 'activeConditions', campaignName)` added to the section (display-wake only, same as the LoH seam). The `useMemo` became a plain per-render recompute (exact LoH parity — `HealingPoolModal` also reads `getTargetConditions()` per render; keeping the memo would have needed the subscription value as a lint-flagged "unnecessary" dep). Externally-cured options now retire mid-dwell; newly-arrived curable options surface mid-dwell.
- **Commit-time presence guard** in `removeCondition`: re-read first; if the filter removes nothing, set the inline `.healing-restriction-note` refusal `${targetName} is not affected by ${conditionName}.` and RETURN before `setRuntimeValue`/`addEntry` — zero write, zero log row, no false success panel. Note renders as a sibling of the section (LoH placement) so it survives the section filtering itself away.
- **Auto-cure latch hardened (Priority Target #4)**: `curedOnMount.current` is now also set on the CLICKED cure path (previously only on the mount path), so once the touch is spent — by click or by a live-surfacing auto-cure — a later echo surfacing a single condition can never grant a second free cure. Multi→single mid-dwell DOES auto-cure the survivor exactly once with an honest row (same law as a fresh open with one curable); the latch pins it to one per HoH use.
- The combat-summary condition merge read stays as-is (per the fix brief); the guard's commit-time re-read covers it (witnessed live: a stale cs-sourced `Remove Deafened` press refused honestly).
- Dual-ruleset: `HandOfHealingModal.jsx` is the single shared component for both 5e and 2024 monk lanes (the handler only swaps ki/Focus wording) — no sibling module needed the fix.

Files changed:
- `src/components/char-sheet/modals/shared/HandOfHealingModal.jsx` (fix)
- `src/components/char-sheet/modals/shared/HandOfHealingModal.live-conditions-echo.test.jsx` (NEW regression test, 6 legs: echo-retire live, echo-surface live, multi→single auto-cure-once + honest row + post-cure latch, zero→single surface + no second free cure, stale cs-press commit-guard refusal zero-write/zero-row, still-present control cures honestly)

Verification:
- Live repro on the ORIGINAL code confirmed both faces (stale `Remove Blinded` button after external cure; press → `Condition Cleared — Blinded removed` panel + phantom `condition|broken|Blinded` row with bucket byte-identical `["stunned"]`).
- Live re-verification post-fix (Mercy-swap rig, :5173): external cure mid-dwell retired `Remove Blinded` within one SSE tick (zero writes); externally APPLIED `paralyzed` surfaced `Remove Paralyzed` live; cure-down-to-single auto-cured the surviving `Stunned` with a GENUINE single broken row (bucket `["stunned"]`→`[]`); a genuinely stale cs-lane press (`Remove Deafened`, which the section never subscribes to) refused with `EvasiveFighter is not affected by Deafened.` — bucket untouched, zero new condition rows, no success panel; control press on a present condition cured honestly (write + exactly one broken row).
- `npx vitest run src/components/char-sheet/modals/shared/` → 102 files / 579 tests passed; `npm run lint` → zero warnings. The 6 pre-existing HoH test files (which already mock `useRuntimeValue: () => null`) pass untouched.
- Cleanup: Disciplined_Monk subclass restored byte-exact (md5 `ba4d456c4ab7605d7ca4246a17cfe58f`, Hand rows vanish live re-proved); closed-tab admin clears → change-data `{}` + log `[]` + overlays `[]`, disk cd/log files absent; `git status --porcelain public/campaigns/ public/data/` empty.

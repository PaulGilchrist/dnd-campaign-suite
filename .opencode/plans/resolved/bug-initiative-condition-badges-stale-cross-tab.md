# Initiative creature-card condition badges are a mount-time snapshot — never live-update from other tabs

## Summary
On an already-mounted Initiative view, condition badges (Prone/Poisoned/etc.) do not live-sync across tabs in EITHER direction: a condition added on another tab never appears, and a condition removed on another tab keeps displaying — indefinitely (10s+ observed) — while server state is correct. Target effects (te) badges on the SAME card DO live-mirror, making the stale channel clearly visible. A view remount (leave Initiative, come back) fixes it instantly, proving the data reaches the client but nothing re-renders the badge merge. **Fix:** the `displayCreatures` memo (which merges conditions via imperative `getRuntimeValue`) now depends on the existing `runtimeStateTick` SSE invalidation channel, so remote condition writes live-mirror in both directions within one echo, matching the te control lane.

## Steps to reproduce
1. Run `npm run dev:locked`; open two browser tabs on `http://localhost:5173`, both into **test-campaign** (GM/localhost).
2. In BOTH tabs go to the Initiative view (12 PCs, no monsters needed). Plant `window.__noReload='x'` in Tab B to prove zero reloads.
3. Tab A: on ElderPaladin's card click `button[aria-label="Add condition, effect, or concentration to ElderPaladin"]`, pick **Prone** chip → Apply. Badge `Prone DC 10` appears on A's card.
4. Tab A: remove it via the badge's SIBLING × (`badge.parentElement.querySelector('[title="Remove effect"]')`). A updates live; server `change-data → ElderPaladin.activeConditions` becomes `[]` (GET-verified).
5. Tab A: add **Poisoned** the same way (server shows `['poisoned']`, log shows `condition applied Poisoned`).
6. Wait ≥5s. Tab B (still mounted on Initiative, marker alive): card still shows `Prone DC 10`, does NOT show `Poisoned DC 10`.
7. Control (same session): Tab A adds + removes an Effects-tab te (e.g. `resilient_sphere`) — Tab B mirrors BOTH the removal and any te write live (te key is reactive via `useRuntimeValue('campaign','targetEffects')` in CreatureCard.jsx:620).
8. Tab B: switch to Log and back to Initiative → badges snap to truth (`Poisoned`, no `Prone`).

## Expected behavior
Per the server-first/SSE doctrine, a passive tab mounted on Initiative should live-mirror per-character `activeConditions` changes (`change-<campaign>-<char>` publishes at `server/routes/campaigns-changedata.js:230`) like every other synced channel does, within ~1s.

## Actual behavior
Condition badges on a mounted passive tab are frozen at their mount-time values. Both directions stale; no console errors; no network failure — SSE echoes arrive (remount shows truth immediately). Server + campaign-log truth is always correct. Player-facing consequence: a non-GM tab (or a second GM screen) shows players a condition that was removed (e.g. Prone persists) and hides one that was applied (e.g. Poisoned never appears) until they happen to navigate away and back.

## Likely location
Confident at layer level: client reactivity gap, not sync loss.
- `src/components/initiative/displayCreatureUtils.js:4` `buildRuntimeConditions()` merges conditions via imperative, NON-reactive `getRuntimeValue(name,'activeConditions')` / `activeConditionMeta`.
- The creature display array in `src/components/initiative/Initiative.jsx` (cards mapped from `combatSummary.creatures` + `characters`) recomputes only when those props change; a passive tab's `activeConditions` SSE echo updates the runtime store but schedules no re-render/memo invalidation. (`useSyncedState`/`useRuntimeValue` subscriptions exist for campaign-level keys like `targetEffects` — hence the te control mirrors — but no per-creature `activeConditions` subscription in the card path.)

## Suggested fix
Make the condition merge reactive: in the creature-card render path, read `activeConditions`/`activeConditionMeta` via `useRuntimeValue(creatureName, 'activeConditions', campaignName)` (like CreatureCard.jsx:620 does for te) instead of the `getRuntimeValue` snapshot inside `buildRuntimeConditions`, or have Initiative subscribe to per-creature condition keys and feed them into the display-creature memo. Check `ConditionEffectBadges.jsx` consumers too — the sheet's CharConditions lane may share the pattern (verify whether the character sheet has the same staleness for remote condition writes).

## Severity
Data-integrity risk — displayed combat truth silently lags on secondary tabs; players can act on a phantom Prone or miss a real Poisoned. (Machine state stays correct; recoverable by navigation.)

## Resolution
**Root cause (confirmed):** diagnosis in "Likely location" was correct at layer level, with one refinement — the reactive plumbing was ALREADY half-wired: every `change-<campaign>-<char>` SSE echo bumps `runtimeStateTick` (`sseHandlers.js` catch-all, `Initiative.jsx:253`) and that tick remounts every card via `key={`${creature.name}-${runtimeStateTick}`}`. But `buildRuntimeConditions` runs inside the `displayCreatures` `useMemo` whose deps were `[combatSummary, characters]` — so the remounted cards were re-rendered the SAME frozen memo prop. (The ACTIVE tab escaped staleness only because EffectAdder apply/remove also calls `setCombatSummary(cloneDeep(...))`, which does invalidate the memo.) The te lane was reactive because `CreatureCard` subscribes directly via `useRuntimeValue('campaign','targetEffects')`.

**Fix (minimal, uses the existing invalidation channel):** `src/components/initiative/Initiative.jsx` — added `runtimeStateTick` to the `displayCreatures` memo deps (with justification comment + scoped `react-hooks/exhaustive-deps` disable, since the tick is deliberately not read in the body). No new hooks/architecture: the tick is this view's established "any per-character runtime change" signal, and App's SSE mirror (`applyStoreUpdate` → `setRuntimeObject(…, skipSync=true)`) writes the store synchronously within the same dispatch, so the tick-driven recompute always reads fresh values. Ordering-safe regardless of handler registration order (React batches the render until after all SSE handlers run).

**Character-sheet lane checked, NOT touched:** `CharConditions.jsx` already subscribes via `addStorageChangeListener(playerStats.name, …)` and re-reads on every store notify — remote condition writes already mirror on the sheet; no shared staleness.

**Files changed:**
- `src/components/initiative/Initiative.jsx` (fix: memo dep + comment)
- `src/components/initiative/initiative.conditions-live-sync.test.jsx` (NEW regression test)

**Regression test:** two legs pinning the exact broken behavior through the real Subscriber→`handleEvent` lane — mounted view + remote `change-<campaign>-Alice` echo (store pre-filled like App's mirror) ⇒ badge appears on ADD; mounted-with-badge + remote empty echo ⇒ badge disappears on REMOVE, both with no view remount. Negative control: both legs FAIL against pre-fix deps (`[combatSummary, characters]`), PASS with the fix. Folder run: `npx vitest run src/components/initiative/` → 62 files / 475 tests passed. `npm run lint` → clean (zero warnings; `--report-unused-disable-directives` confirms the disable comment is load-bearing).

**Live re-verification (two-tab rig, :5173, test-campaign, `window.__noReload` marker alive on passive Tab B for the whole session):**
1. Fresh-reloaded both tabs onto Initiative post-fix. Tab A EffectAdder adds **Prone** on ElderPaladin → badge `Prone DC 10` on A AND on passive B with zero reload (pre-fix: never appeared).
2. Tab A sibling-× removes Prone → B clears live (pre-fix: kept displaying for the whole session); server `ElderPaladin.activeConditions` = `[]` GET-verified.
3. te control still fine: Tab A adds Effects-tab `resilient_sphere` → `Resilient Sphere` badge (span, `effect-debuff`) mirrors into B; sibling-× removal mirrors back.
4. Generic registry fallback (commit 013a5aebf) still renders: `redirect_attack` shows `Redirected Attack` badge (`effect-buff`) on A and live-mirrors to B; removable + remote-remove mirrors.
5. Same-tab condition add/remove unaffected (all mutations above were same-tab-live on A first).
Cleanup: tabs closed, Admin clear-change-data + clear-log POSTed, GET-verified `{}` / `[]` two-pass.

**Note for future repros:** the te/registry badges render as `<span data-testid="creature-badge">` (CreatureBadge = span when not clickable); `button.creature-badge` only matches clickable badges — the original repro's `button.creature-badge` probe under-counts te badges. Condition badges ARE buttons (they open the save popup).


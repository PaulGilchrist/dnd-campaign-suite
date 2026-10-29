# Initiative creature-card condition badges are a mount-time snapshot — never live-update from other tabs

## Summary
On an already-mounted Initiative view, condition badges (Prone/Poisoned/etc.) do not live-sync across tabs in EITHER direction: a condition added on another tab never appears, and a condition removed on another tab keeps displaying — indefinitely (10s+ observed) — while server state is correct. Target effects (te) badges on the SAME card DO live-mirror, making the stale channel clearly visible. A view remount (leave Initiative, come back) fixes it instantly, proving the data reaches the client but nothing re-renders the badge merge.

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

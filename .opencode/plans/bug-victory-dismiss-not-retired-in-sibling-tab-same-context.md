# bug: banner Dismiss does not retire an already-mounted victory banner in a sibling tab of the same browser context (shared dismiss-stamp contradicts visible face)

## Summary
Victory-banner dismissal is persisted at localStorage `initiative-victory-dismissed=<stamp>` — i.e. per browser CONTEXT. When the GM dismisses the banner in one tab, a second already-mounted tab in the SAME context immediately shares the stamped key yet keeps rendering the banner indefinitely (until an unrelated re-render/echo happens to re-evaluate the memo, or a new stamp lands). The tab's own source of truth (its localStorage) says "dismissed" while its UI says "celebrate" — the two faces disagree for the same client.

## Steps to reproduce
Starting state: `test-campaign`, two GM tabs (same context) on `http://localhost:5173`, both with Initiative mounted, an undismissed celebrated `lastCombatResult` stamp present (easiest: win a combat — join a goblin via Encounters, kill it, Clear on the attacking tab; or reuse any celebrated stamp, e.g. stamp `1795576070644` witnessed 2026-11-24).

1. Both tabs show the `.victory-banner` (fan-out of the undismissed stamp).
2. Tab A: click `Dismiss victory banner` (aria-label) → banner disappears; `localStorage.getItem('initiative-victory-dismissed')` === String(stamp).
3. Within seconds, census Tab B:
   - `localStorage.getItem('initiative-victory-dismissed')` → SAME stamped value (shared context storage),
   - `document.querySelector('.victory-banner')` → STILL VISIBLE (`Victory!… Continue`).
4. Tab B keeps showing the banner with zero further renders; a reload correctly hides it.

Live evidence 2026-11-24: after tab1 dismiss, census read `{"tab1":"gone","tab1_ls":"1795576070644","tab2":"VISIBLE","tab2_ls":"1795576070644","lan":"VISIBLE","lan_ls":null}`. (The LAN-context half is CORRECT by design — separate client, keeps its undismissed face until self-dismiss, which also worked.)

## Expected behavior
Either dismiss is per-TAB (then the key should be sessionStorage or keyed per-tab, and the two GM tabs would be independent clients), or it is per-CONTEXT (documented localStorage law) — in which case a dismiss in one tab must retire the banner in every tab of that context live (e.g. a `storage` event listener re-checking `initiative-victory-dismissed`, or folding the ls read into a store the tabs share). The face must not contradict the same client's own persisted dismiss state.

## Actual behavior
Tab B renders a celebrated banner for a stamp its own localStorage already marks dismissed, with no mechanism to notice. Same-context sibling tabs are silently out of sync about a per-client presentation state.

## Likely location
`src/components/initiative/useTvPresentation.js` — the derived banner memo reads `initiative-victory-dismissed` at render time only; localStorage `storage` events are not subscribed anywhere (no cross-tab listener). The dismiss writer lives in `VictoryBanner.jsx` / the banner lane. (Confident on the memo law from `docs/test-setup-playbook.md` victory-banner rig bullet + live census; file-level pinpoint is a best guess.)

## Suggested fix
Smallest honest fix: subscribe to `window.addEventListener('storage', …)` for the `initiative-victory-dismissed` key in the banner hook and bump a local counter to re-evaluate the memo (storage events fire only in the OTHER same-origin tabs — exactly the needed fan-out). Alternatively re-read ls inside the existing SSE echo subscription. Add a unit pin: banner mounted, fire a synthetic storage event for the dismiss key at the current stamp → banner unmounts.

## Severity
Minor UX issue. Presentation-only, no data risk; but the two-GM-window table setup (operating tab + tracker/TV tab) is a first-class supported layout, and the stale celebrant tab has no self-heal short of reload.

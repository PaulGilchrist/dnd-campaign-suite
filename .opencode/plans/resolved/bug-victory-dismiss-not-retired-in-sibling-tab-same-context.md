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

## Resolution
FIXED 2026-11-24. The black-box diagnosis held exactly: `useTvPresentation.js` derived `victoryVisible` from a render-time `localStorage.getItem('initiative-victory-dismissed')` read, re-evaluated only when its own memo deps changed (`lastCombatResult`, `trackerHasFoes`, or the local `victoryDismissTick` bumped by the *clicking* tab's `dismissVictory`). No `storage` listener existed anywhere in `src/` (grep-verified), so a sibling tab's dismiss write never woke anyone — the sibling's UI kept contradicting its own persisted pref until reload.

Per the bug file's Expected law (dismiss is per-CONTEXT by the existing localStorage design — keep the key, fix the fan-out), the minimal honest fix is exactly the suggested one: a `window.addEventListener('storage', …)` effect in the hook that bumps `victoryDismissTick` when the event key is `initiative-victory-dismissed` (or `null`, i.e. a full `storage.clear()`). Storage events fire only in the OTHER same-origin tabs — precisely the missing fan-out; the writing tab's local bump stays as-is since it never receives its own event. Structure mirrors the sibling `fullscreenchange` listener effect already in the same hook (effect + cleanup, no new store, no new event type, presentation-only, no timers).

Changed files:
- `src/components/initiative/useTvPresentation.js` — added the storage-event effect (13 lines incl. comment).
- `src/components/initiative/useTvPresentation.cross-tab-dismiss.test.js` — NEW regression pin: banner mounted → sibling-write localStorage + dispatch synthetic `storage` event for the dismiss key at the current stamp → `victoryVisible` flips false; plus guards that a DIFFERENT-stamp event keeps it up, unrelated-key events never hide it, and unmount detach + remount honors the persisted stamp. Verified red-when-the-listener-is-disabled (fails precisely on the bug's face).

Verification:
- Live repro BEFORE fix (two GM tabs, same context, Initiative both mounted, forged undismissed celebrated stamp via wildcard `POST /lastCombatResult`): tab1 dismiss → `{"tabA":{"banner":false,"ls":"1795578640123"},"tabB":{"banner":true,"ls":"1795578640123"}}` — exact documented face.
- Live re-verify AFTER fix (tabA + tabB same context + separate-context tab, :5173 live source): dismiss on tabA → `{"tabA":{"banner":false,"ls":"1795578808456"},"tabB":{"banner":false,"ls":"1795578808456"},"iso":{"banner":true,"ls":null}}` — sibling retires live, separate context keeps its undismissed face (correct by design). Fresh stamp afterwards re-showed the banner on all three, including the dismissed same-context tabs. Dismiss-in-own-tab unchanged. Zero console errors.
- Tests: new pin 4/4 green; whole `src/components/initiative/` folder 133 files / 997 tests green (EXIT 0); `npm run lint` zero warnings (needed `new window.StorageEvent` — jsdom's mocked `localStorage` is not a native `Storage` so `storageArea` must be omitted, and `StorageEvent` is not in the eslint test-env globals).
- Exit hygiene: admin `clear-change-data` (verified `{}`) + `clear-log` (verified `[]`); `initiative-victory-dismissed` / `initiative-tv` swept from all rig contexts.

# Loot panel stale on other tabs — cleared/awarded draft re-awards XP from a second tab (no guard)

## Summary
The loot panel (added scratch persistence in 477150a70) hydrates its draft only at mount and never re-renders on `loot-draft` store changes. When tab A clears (×) or awards the draft — deleting the server key — a tab B that has the Initiative view mounted keeps showing the full award stage, and its "Award loot and XP to party" button still works: it logs a second `encounter/loot_awarded` row and re-grants XP to every PC. Silent duplicate rewards, no 409/banner/toast (unlike the `.ct-*` conflict family).

## Steps to reproduce
1. In test-campaign, open two localhost tabs (A and B), both on the Initiative view, Goblin KO'd (0 HP) on the board.
2. Tab A: click `button[title="Generate loot from defeated monsters in combat"]` → suggestions + `Encounter XP: 50 total · 4 per character` + Award button appear.
3. Tab B: switch to Log and back to Initiative → the panel hydrates the same draft (mount-time hydration works; textarea shows `No loot for these monsters`).
4. Tab A: click `button[title="Clear loot suggestions"]` (×) → panel resets; verify `GET /api/campaigns/test-campaign/change-data` has NO `loot-draft` key.
5. Observe Tab B (panel still mounted): textarea + XP + Award button are ALL still visible after 4+ s (null-echo clears the store key but nothing re-renders the panel).
6. Tab B: click `Award loot and XP to party` → `Complete` (`.initiative-btn-complete`).

## Expected behavior
Either B's panel live-clears when the draft key is removed by another client (the commit's own comment claims “The null SSE echo mirrors the removal to every other client”), or the stale Award is disabled/refused — same doctrine as the concentration-prompt stale-Roll guard (6b1800fa2) and the `.ct-*` 409 conflict banners.

## Actual behavior
B's stale panel stays fully armed and the award lands a SECOND time: log gains a second `encounter/loot_awarded` row (`xpPerChar: 4`), and every PC bucket `xp` increments again (live: 4 → 8). Server had NO `loot-draft` key at award time. Zero console errors, zero warning UI. With a real item/currency draft the same lane would also double the party-inventory deposit and `loot` row.

## Likely location
Confident: `src/components/initiative/useLootHandlers.js` — hydration is `useState(() => readStoredLootDraft())` (mount-only); `commitDraft` comments state the `change-<campaign>-loot-draft` echo “lands in the store only (no listener re-POSTs it)”, and there is no `useRuntimeValue`/subscription that reacts to external changes of the key. The award path reads only local `lootData`/`lootTextValue` state — no server round-trip check, no revision/stamp on the draft, and `server/routes/changeData` has no guard for this key.

## Suggested fix
Subscribe the panel to the `loot-draft` runtime key (e.g. `useRuntimeValue('campaign', 'loot-draft', campaignName)`): when the store value becomes null/absent (or differs from `lastWrittenRef` while the local draft is unmodified), reset the panel state (drop textarea/XP/award stage) so a remote clear/award retires the affordance — mirroring the concentration-prompt null-echo close (6b1800fa2). Deeper belt: include the draft value (or a revision id) in the award request and ignore/refuse awards whose draft no longer matches the server key.

## Severity
Data integrity risk — silent duplicate XP/loot/currency grants; multi-GM-tab workflows are actively supported (conflict guards exist for six `.ct-*` lanes), and the double-award needs no race window, just a stale mounted panel.

## Resolution
FIXED 2026-10-29. Root cause confirmed exactly as diagnosed: `useLootHandlers.js` hydrated the `loot-draft` campaign key only at mount (`useState(() => readStoredLootDraft())`). The App.jsx clear-key lane *did* mirror a remote key DELETE into the local campaign store (key remove + `notify('campaign')`), but nothing in the panel subscribed to that store, so a passive tab kept a fully-armed award stage and its Award button wrote real XP/log rows against a draft the server no longer had.

Fix (mirror of the concentration-prompt null-echo close, 6b1800fa2): `useLootHandlers` now subscribes via `addStorageChangeListener('campaign', …)`. On any campaign-store echo whose `loot-draft` JSON differs from `lastWrittenRef` (external change) while the local draft is un-flushed-clean (`draftRef === lastWrittenRef`), the panel ADOPTS the store value — a remote clear/award (key removed) live-retires the panel (text/XP/award stage dropped, `showAwardLoot` closed); a remote draft write live-mirrors it. Own commit/DELETE echoes no-op (equal to `lastWrittenRef`), and an un-flushed local edit wins (skip-while-editing doctrine of the `.ct-*` lanes) and re-commits via the 400 ms write-through debounce. Adoption is read-only — never echo-writes back. No server change needed (client echo adoption closes the window; the deeper server-side revision belt stays backlog).

Files changed:
- `src/components/initiative/useLootHandlers.js` — cross-tab guard effect + `storedDraftJson()` helper; imports `addStorageChangeListener`.
- `src/components/initiative/useLootHandlers.test.jsx` — mock gained a real `addStorageChangeListener`/`hasRuntimeValue` lane; NEW `describe('cross-tab stale draft mirror')` with 4 regression tests (remote-clear retires armed panel with zero re-POST; remote draft write live-mirrors; own-echo ignored; un-flushed edit wins over remote removal).
- 7 sibling Initiative-mount test files (`createCreatureHandlers`, `initiative-callbacks`, `initiative-init-rolled-handler`, `initiative.conditions-live-sync`, `initiative.localhost-gate`, `initiative.overlays`, `initiative.test`) — extended their partial `vi.mock` of `useRuntimeState.js` with `addStorageChangeListener: vi.fn(() => () => {})` (known heavily-mocked-module pitfall).

Verified live (test-campaign, two localhost:5173 tabs, KO'd Goblin, campaign header verified both tabs):
- Pre-fix repro: clear lane — server `loot-draft` GET absent after Tab A ×, yet Tab B (mounted ≥4.5 s, `__noReload` marker) kept textarea + `Encounter XP: 50 total · 4 per character` + armed Award; its award landed `loot_awarded {xpPerChar:4}` with all 12 PC buckets +4 with NO server key. Award lane — Tab A awarded (1 row, +4), stale Tab B re-awarded: duplicate rows, PCs at 12 XP. Bug confirmed exactly.
- Post-fix re-run of the SAME steps: after A's ×, B's panel live-cleared within ~250 ms of the echo (textarea/XP/award counts 0–0–0, zero reloads, zero console errors); after A's full award, B live-cleared again and the double-award affordance was gone — log held exactly ONE `loot_awarded {xpPerChar:4, totalEncounterXp:50}` row, PCs +4 once.
- Adjacent sanity: view-switch draft persistence (477150a70) intact — generate → Log → Initiative restored the draft verbatim; a normal single-tab award still completes (+1 legit row, XP 4→8); console clean both tabs.
- Tests: `npx vitest run src/components/initiative/useLootHandlers.test.jsx` 25/25; folder run 65 files / 521 tests green; full `npm run test:run` 2914 files / 32216 passed (+3 expected-fail); `npm run lint` zero warnings.
- Cleanup: both tabs closed, admin clear-change-data + clear-log, GET-verified two-pass from closed-tab quiet: change-data `{}`, log `[]`, combatSummary null.

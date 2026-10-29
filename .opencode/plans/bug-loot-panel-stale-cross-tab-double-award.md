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

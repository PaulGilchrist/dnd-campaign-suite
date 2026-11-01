# Drafts panel: simultaneous double-REJECT leaves a stale ghost row in the losing tab

## Summary
When two GM tabs reject the same AI draft at the same instant, the losing tab's DELETE 404s, `runAction` shows the error banner but **skips the reload**, and the winner's SSE `factions-list` broadcast lands inside the loser's `busy` window so the live-sync deliberately ignores it. Result: the deleted draft row stays rendered — still fully actionable — until the next unrelated SSE broadcast or a manual Refresh.

## Steps to reproduce
1. In `test-campaign`, ensure AI is configured (any mode) and open the **Drafts** view in two browser tabs on localhost.
2. From a third context, inject two draft factions via full-array POST to `/api/campaigns/test-campaign/factions` — echo the existing rows plus `{"id":"qa-as-d1","name":"QA AS Draft One","description":"race probe","draft":true}` (and a second draft row). Both panels live-sync the new rows (the aa2d9b2b7 SSE refresh works).
3. In BOTH tabs, click that row's **Reject** button simultaneously (verified same-millisecond via two `page.evaluate` dispatches in one `Promise.all`).
4. One tab wins (row removed, no banner). The loser tab shows the red banner "Faction not found" but **still displays the ghost "QA AS Draft One" row** with live Approve/Reject buttons.
5. Click **Approve** on the ghost row: the panel finally reloads and the row disappears; server list is unchanged (the approve lane re-reads fresh, so this is a benign no-op — verified: `The Iron Consortium` byte-identical, no resurrection).
6. Control: a sequential reject (winner first, loser clicked ~700 ms later) self-heals — the loser's SSE refresh (not busy) removes the row before the click lands. The ghost only appears when both clicks are in the same window.

## Expected behavior
After the failed reject, the losing panel should re-fetch and drop the row that no longer exists server-side (or at minimum disable the stale row) — the code's own comment claims "runAction reloads when it completes", which holds only for the success path.

## Actual behavior
- Loser tab: DELETE `/api/campaigns/test-campaign/factions/qa-as-ghost` → 404; console: `Error deleting Faction: Error: Faction not found` + `[CampaignBuilder] factions action failed`; banner renders; **row remains** with actionable buttons.
- Winner tab: row gone, no banner.
- Server truth stays correct throughout (single delete, no resurrection) — this is a client stale-state bug only.
- Reproduced 2 of 2 same-window races (both `Promise.all` clicks stamped `Date.now()` identical). Ghost self-heals on the next full-array broadcast (verified: a subsequent draft POST removed it) or manual Refresh.

## Likely location
`src/components/campaign-builder/CampaignBuilder.jsx`
- `runAction` (:90-101): the `catch` branch sets `error` and `busy=false` but never calls `reload()` — the comment above `handleSSEEvent` assumes actions always reload on completion; false on the error path.
- `handleSSEEvent` (:118-122): intentionally skips while `busy`, so the winner's broadcast arriving mid-race is dropped and never replayed.
Guess confidence: **confident** — console stack points at CampaignBuilder.jsx and the missing reload-on-error is the only sync gap between the 404 and the stale `groups` state.

## Suggested fix
In `runAction`'s `catch`, also `await reload()` before/after surfacing the error (cheap: one loadDrafts GET). The banner still tells the GM the action failed; the list becomes truthful again immediately. Alternatively, special-case `err` messages from a 404 delete as "already removed" → silent reload. First check: confirm `loadDrafts` is safe to call right after a failed action (it is — read-only).

## Severity
Minor UX issue — server data integrity was verified intact (no resurrection, ghost-Approve is a benign re-read+identical overwrite), but a stale actionable row contradicts the panel's live-sync promise and invites confusing double-clicks.

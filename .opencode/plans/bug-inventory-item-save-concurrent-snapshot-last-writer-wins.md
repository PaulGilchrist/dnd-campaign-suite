# Bug: Two GM windows' concurrent party-ITEM saves are last-writer-wins full-snapshot replaces (residual face of the chip clobber class)

## Summary
`bug-inventory-chip-cross-tab-full-doc-clobber` (resolved 2026-11-17) closed the CURRENCY half of the full-document clobber class: chips now flush signed deltas through the atomic `/inventory/adjust` lane and `POST /api/campaigns/:c/inventory` no longer accepts or writes currency. The ITEM lane itself still persists via whole-item-list snapshot replaces: two GM windows saving items within each other's stale-view window (Add Item modal Save / qty stepper / qty-set / Delete) merge last-writer-wins — an add, edit, step or delete made in window A after window B last synced can silently vanish when B's POST lands. No revision check, no conflict 409, no console error; unlike chips there IS an audit asymmetry (delete logs `Removed "X" from party inventory` even when a concurrent save later re-adds the resurrected row, so the log can claim more than the ledger kept).

## Steps to reproduce
Not reproduced live (modal-Save timing across two windows is not deterministic; the face is code-grounded):
1. Windows A and B both on Inventory in `test-campaign`, item pool `{X}`.
2. A: Add Item `Y` → Save (server `{X,Y}`; B's echo may not have repainted yet).
3. Within B's echo latency B: Add Item `Z` → Save — B's snapshot is `{X,Z}` → server lands `{X,Z}`; A's `Y` vanished.
Same shape for qty steps (A bumps X→2, B's later save carries X→1 back) and for a Delete racing an Add (delete row audited, item resurrected).

## Expected behavior
Concurrent item writes either merge additively (per-item atomic lanes: add/upsert/delete/setQty keyed by item id, mirroring `/transfer`/`/adjust`) or the stale writer gets a loud revision-conflict 409 (the Notes copy family: `… was modified in another tab or session since you loaded it — reload the list and re-apply your edit — it was NOT saved.`).

## Actual behavior
`src/components/party-inventory/PartyInventory.jsx` `persist`/`handleDeleteItem` POST the tab's current full `items` array; `server/routes/inventory.js` POST `/api/campaigns/:c/inventory` replaces `inventory.items` verbatim (sanitized/re-sorted), currency preserved. Last POST wins.

## Likely location
Confident: `server/routes/inventory.js` POST `/inventory` (items lane, no revision stamp) + `PartyInventory.jsx` snapshot queue (`persistQueueRef` / `flushPersist`). The atomic-lane pattern to copy is the sibling `/adjust` / `/transfer` routes (server re-reads, applies the DELTA, publishes merged doc).

## Suggested fix
Per-item atomic endpoints keyed by id (upsert `{id?, name, quantity, description}`, `setQty {id, quantity}`, `delete {id}`) with the client chips-style serialize + stale-rev ack guard, OR the lighter revision-stamp + 409 + client re-pull-and-replay of the single intent. Delete-audit must stay post-ack (delete-item-log idiom).

## Scope note
Frequency is far lower than the chip face: item saves are immediate (no 400 ms debounce window), modal-paced, and the hazard window is echo latency (~ms) plus dwelling-stale views; GMs rarely edit items in two windows simultaneously. This is the deliberately-residual face of the 2026-11-17 chip fix, split out so the closed clobber bug can resolve.

## Severity
Low-to-moderate data integrity: silent loss of an item add/edit/delete possible but only under concurrent two-window item editing; audit rows for delete can claim writes a later save resurrected.

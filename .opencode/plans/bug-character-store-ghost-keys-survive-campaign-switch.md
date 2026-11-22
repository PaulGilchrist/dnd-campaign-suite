# bug-character-store-ghost-keys-survive-campaign-switch

## Summary
The d25431cab fix re-scoped only the shared `'campaign'` runtime store on campaign entry. Character-KEYED store buckets (`stores` Map in `useRuntimeState.js` keyed by character name) are still seeded-if-absent and never evicted, so a no-reload campaign switch leaks the PREVIOUS campaign's per-character runtime keys into a SAME-NAMED creature in the new campaign. Witnessed with the allies lane: a fresh qa-arena `NPC 1` (no ally list on B's server) came up pre-trusting campaign A's allies and gated a friendly-fire confirm that has no basis in B.

## Steps to reproduce
1. `CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter' npm run dev`; open http://localhost:5173 in ONE tab.
2. Enter `test-campaign` → Initiative → `+ NPC` (accept the `Add NPC with placeholder AC 10 / HP 10?` confirm) → `NPC 1` joins.
3. On NPC 1's card open 🤝 (`.creature-card.npc .allies-edit-btn`) → `Select All` → `Confirm Allies (14)`.
4. Without reloading, sidebar `Campaigns` → select `qa-arena` (zero characters is fine).
5. Initiative → `+ NPC` → accept confirm → a fresh `NPC 1` joins (B's `GET /api/campaigns/qa-arena/change-data` has NO `NPC 1` key — verified).
6. Open NPC 1's allies editor on B's card → observe the modal opens with AasimarTest **pre-checked** (`2 selected` on the 2-creature board) although B's server holds no ally list (fresh default is self-only, `getAllyList` fallback).
7. Close (Cancel), then set NPC 1's target select to `AasimarTest` → the `Friendly Fire` confirm dialog (`#friendly-fire-confirm-title`) APPEARS in campaign B, where NPC 1 never declared any allies. Cancel to revert.
8. Reload the page (same tab), re-select qa-arena → Initiative → arm the same target → dialog no longer appears (fresh store = honest face). Reload-cure control mirrors the resolved campaign-store bug.

## Expected behavior
Entering a campaign re-scopes ALL of the client runtime store to that campaign's snapshot (or keys stores by `campaign:character`): a creature with no server-stored `selectedAllies` shows the self-only default and never raises the friendly-fire confirm.

## Actual behavior
Campaign A's `NPC 1` bucket (incl. `selectedAllies` of A's 14-combatant roster) remains readable under campaign B's same-named `NPC 1`: wrong pre-selections in the allies modal, a spurious friendly-fire confirm gating target arming, and — via `hasExplicitAllyList` returning true — the allegiance-override lanes (aura bearers, sneak flanking, opportunity reach, per `useAllySelection.js` doc) activate off ghost bytes. Confirming the ghost-pre-checked modal would also WRITE A's roster names into B's change-data (cross-campaign data pollution). All per-client (server holds nothing), same containment as the resolved campaign-store bug.

## Likely location
Confident: `src/hooks/runtime/useRuntimeState.js:5` (`stores` keyed by `characterKey` only) + `src/App.jsx` `seedCharServerKeys` (seed-if-absent, no eviction) — the d25431cab `hydrateCampaignRuntimeData` replace covers only the `'campaign'` scope; `seedCharacterRuntimeData` was left untouched. The allies read path: `src/hooks/useAllySelection.js` `getAllyList`/`hasExplicitAllyList` via `getRuntimeValue('NPC 1', 'selectedAllies')`.

## Suggested fix
Extend the enter-seam adopt-and-evict to character-keyed scopes: on campaign entry, for every character/creature the NEW campaign's snapshot carries, `replaceRuntimeObject(name, snapshot[name] ?? {})`-style (null-parked entries unadopted, same doctrine), and evict/remove char stores whose keys belong to the previous campaign's roster (a per-campaign roster census — e.g. retain only stores named by the current campaign's characters + initiative board once mounted). Alternatively key stores by `campaignName:characterKey` throughout. Care needed with the live-mirror laws (playbook §"mirror/bucket-shape": `setRuntimeValue` POSTs the whole local mirror — a stale mirror under B is exactly what this bug lets happen first, then POSTs it to B). Add a pin mirroring `App.campaign-store-rescope.test.jsx` for the character scope (A→B switch: `getRuntimeValue('NPC 1','selectedAllies')` null under B).

## Severity
Data integrity risk: benign in display (reload cures) but the ghost pre-check invites a confirm that persists campaign A's ally roster into campaign B, and combat override lanes silently read the wrong allegiance until a reload.

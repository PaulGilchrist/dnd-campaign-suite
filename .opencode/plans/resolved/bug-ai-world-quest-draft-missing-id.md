# bug: AI world-keeper quest drafts are persisted without an `id` — row is undeletable and corrupts the Quests CRUD family

## Summary

`applyWorldProposal.addQuestDraft` appends the confirmed AI quest draft to the ledger **without an `id` field**, while every consumer in the Quests CRUD family keys rows by `id`. Result: a React duplicate-key error on the Quests list, a permanently undeletable row (`DELETE /quests/undefined` → 404), and — with two or more AI drafts — an edit-save on one silently replaces **all** id-less rows (`undefined === undefined` match), plus the duplicate-name self-skip collapses for them.

## Steps to reproduce

1. In `test-campaign`, Admin → AI Referee: configure `http://localhost:8000/v1`, model `Qwen3.8-Flash-Next-oQ4e-mtp`, mode `suggest`, Save AI config (badge shows `model · suggest`).
2. In the same Admin view, World keeper console: pick kind **Quest draft**, focus "a quest about the missing caravans on the north road", press Generate. Wait for the card (`quest draft | confidence …`).
3. Press **Add quest to ledger**. Toast reads `Applied: quest 'The North Road Silence' added to the ledger (AI-drafted)`.
4. `GET /api/campaigns/test-campaign/quests` — the new row carries only `name/status/description/rewards/notes/updatedAt` — **no `id`** (compare the baseline `The Lost Artifact` row which has a uuid `id`).
5. Open the Quests view. Console logs React error: `Each child in a list should have a unique "key" prop … Check the render method of 'Quests'`.
6. Click the AI row to open the editor, press **Delete**, accept the named confirm `Delete quest "The North Road Silence"?`.

## Expected behavior

The quest is created with a stable id (the manual create lane at `Quests.jsx:313` stamps `id: crypto.randomUUID()`), renders without key warnings, and Delete removes it (`DELETE /quests/<uuid>` → 200, row gone).

## Actual behavior

- Step 6 fires `DELETE /api/campaigns/test-campaign/quests/undefined` → **404** `Quest not found`; the row stays in the list (2 rows after deleting 1). Console chain (single leg): browser resource 404 line + `Error deleting quest: Error: Quest not found` (questsService.js:93) → `Failed to delete item:` (useEntityManagement.js:53) → `Failed to delete quest:` (Quests.jsx:477).
- No user-facing feedback identifies why; the only visible outcome is the row refusing to disappear.
- Recovery from the UI is impossible: `openEdit` seeds `formData` via `{...item}` (useCrudList.js:23) so an edit-save of the id-less row **cannot add an id** either (`{ ...formData }` at Quests.jsx:312 keeps it missing). The row is permanent ledger pollution until a scripted array-rewrite.
- **MULTI-ROW COLLISION PROVEN LIVE (2nd leg):** with TWO id-less rows on disk (a second clone appended via scripted array-POST to simulate a second AI draft), opening `The North Road Silence`, editing its notes, and pressing Save sends an array in which BOTH id-less rows were replaced by the editor's formData (same name twice) → server `validateList` duplicate-name guard rejects with **400 `A quest with that name already exists`** + 3-layer console chain (`Error saving quests:`/`Failed to save items:`/`Failed to save quest:`). Editing one of multiple AI drafts is therefore outright impossible (server-save side the write was refused — disk stayed intact; the corruption is client-array-side).

## Likely location

Confident on the producer, and both consumer failure modes are now live-proven (undeletable-row delete leg + the edit-clobbers-siblings leg via its 400 self-duplicate fingerprint):
- `src/services/ai/applyWorldProposal.js` → `addQuestDraft()` builds `{ name, status, description, rewards, notes }` — no id (this is the omission).
- `src/components/quests/Quests.jsx` — `key={quest.id}` (:402), delete `deleteQuestAction(quest.id)` (:336), update map `quests.map(q => q.id === editingQuest.id ? {...formData} : q)` (:312 — with two id-less rows, `undefined === undefined` replaces BOTH on any one edit), and `hasDuplicateName` id self-skip (`q.id !== editingQuest.id`, :29) matches every id-less row.
- Contrast: manual create lane `Quests.jsx:313` (`crypto.randomUUID()`).

## Suggested fix

In `addQuestDraft`, mirror the manual lane: `const quest = { id: crypto.randomUUID(), name: proposal.name, … }`. Defense-in-depth options: (a) the server quests CRUD could back-fill missing ids on array replace; (b) Quests.jsx could fall back to `key={quest.id ?? index}` and disable/harden the map-match when `editingQuest.id` is null. Primary fix is (producer-side) a one-liner.

## Severity

**Data integrity risk / broken feature** — the write poisons the shared ledger: an undeletable row from the GM UI (404 delete, no user-facing why), a live React key error every render, and with 2+ drafts editing any one of them is impossible — the client clobbers all id-less rows into one and the server duplicate-name guard refuses the result with a misleading 400 `A quest with that name already exists` (the accidental backstop means no silent disk corruption via this leg, but the AI feature's own create path is what introduced the pollution).

## Resolution

**Root cause — confirmed as diagnosed (producer-side, one-field omission):** `addQuestDraft()` in `src/services/ai/applyWorldProposal.js` appended `{ name, status, description, rewards, notes }` to the quests ledger with **no `id`**, while every Quests CRUD consumer keys rows by `id` (list `key`, `deleteQuest(quest.id)` → `DELETE /quests/<id>`, edit-map match, dup-name self-skip). No 2024 twin exists — this is the only CRUD-appending producer in `src/services/ai/` (the other AI apply modules write only log/runtime lanes).

**Fix (producer-side, mirrors the manual create lane at `Quests.jsx:313`):**
- `src/services/ai/applyWorldProposal.js` — `addQuestDraft` now stamps `id: crypto.randomUUID()` first in the quest object (with a comment naming the consumers the id serves). Defense-in-depth options (server id back-fill on array replace, `key={id ?? index}` fallback) were NOT taken: the producer is the single defect, the manual lane already sets the precedent, and the server list route is intentionally id-agnostic.
- `src/services/ai/applyWorldProposal.test.js` — new regression test `quest_draft stamps a stable id like the manual create lane` (spies `crypto.randomUUID` per the `SpellOverlay.test.js` convention): asserts the appended draft carries the uuid and pre-existing rows are preserved.

**Verified live in test-campaign (post-fix re-run of the original repro):**
- AI config (`http://localhost:8000/v1` · `Qwen3.8-Flash-Next-oQ4e-mtp` · suggest) → World keeper → Quest draft → Generate → card renders → **Add quest to ledger** → toast `Applied: quest 'What the Caravans Carried' added to the ledger (AI-drafted)`.
- `GET /quests` — new row carries `id: e4f2f680-6ecd-43fa-9299-9a6db08d2329` (uuid, same shape as the baseline row).
- Quests view → open the AI row → **Delete** → accept named confirm → `DELETE /quests/e4f2f680-…` → **200**, row gone from UI and disk, modal closes (matches NPC/Notes/Factions delete semantics).
- Console on a fresh load with clean data: **0 errors** (the `Quests` duplicate-key React error is gone).
- Pre-fix repro first re-confirmed the exact filed behavior on this snapshot: id-less row in `GET /quests`, the key error, `DELETE /quests/undefined` → 404 + the 3-layer console chain, row refusing to disappear.

**Tests/lint:** `npx vitest run src/services/ai/applyWorldProposal.test.js` → 6/6 pass; whole-folder `npx vitest run src/services/ai/` → 22/22 pass; `npm run lint` → clean (zero warnings).

**Cleanup:** repro-era id-less row removed via scripted array-POST (the only recovery route — proving the UI lane cannot heal it); baseline `The Lost Artifact` byte-exact (id + content + updatedAt); change-data `{}` + log `[]` GET-verified via Admin clears; AI config toggled back off (`AI Referee not configured`).

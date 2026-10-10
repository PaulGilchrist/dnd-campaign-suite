# Duplicate NPC names silently overwrite — no warning (maps have one, NPCs don't)

### Summary
Creating a second NPC with an already-existing name silently replaces the first record instead of warning the user. The Maps manager rejects duplicates with "A map with that name already exists"; NPCs (and the same gap likely applies to other name-keyed entities) has no duplicate check at all, so a GM creating a new NPC loses the previous one's data with zero feedback.

### Steps to reproduce
1. In `test-campaign`, on the NPCs page, click "New NPC", enter Name `QA Test NPC`, click Save → NPC appears in the list.
2. Click "New NPC" again, enter the same name `QA Test NPC` (plus any different field values), click Save.

### Expected behavior
A validation error like the Maps flow's "A map with that name already exists" (case-insensitive), keeping both records distinct or forcing a rename.

### Actual behavior
The form closes with no error message (`GET /api/campaigns/test-campaign/npcs` still lists exactly one "QA Test NPC" — the second save silently replaced the first). Confirmed live: after the second save there was no `[class*=error]` element, `onForm:false` (saved), and the NPC list had one entry. grep of `server/routes/npcs.js` and `src/components/npcs/*.jsx` for `duplicate|already exists` returns zero matches.

### Likely location
Confident there is no check in `server/routes/npcs.js` or the NPC form; the store is keyed by name/id, so same-name writes collide silently. The Maps create path (`src/components/maps-manager/MapsManager.jsx:152-155`) is the working reference implementation for comparison.

### Suggested fix
Mirror the Maps duplicate guard: on NPC save (client and server), case-insensitively compare the name against existing campaign NPCs and show the inline error, excluding the record being edited.

### Severity
Minor UX issue with a data-integrity edge — accidental silent loss of the first NPC's notes/goals/secrets.

## Resolution

**FIXED 2026-10-10.** Confirmed live before fixing: second save of `QA Test NPC` (Race `Elf Override`) silently replaced the first (`Human`) — form closed, no `[class*=error]`, list had one entry whose race had changed.

**Root cause matched the guess**, with one nuance: `server/routes/npcs.js` PUT is a name-keyed upsert (`npcs/:npcName`), so a same-name create is indistinguishable from a legitimate edit server-side — the server cannot reject it without client intent. The primary guard therefore mirrors the working `MapsManager.jsx:152-155` client pattern, plus a server guard for the rename-collision case (renaming NPC A onto NPC B's name would otherwise push a duplicate-named record).

**Changes:**
- `src/components/npcs/NPCs.jsx` — added `error` state; `handleSave` and `handleSaveAndAddToInitiative` now run a case-insensitive duplicate check (`hasDuplicateName()`, excluding `editingNPC`) before saving, set the inline error, and surface server error messages inline; error cleared on modal open and successful save.
- `src/components/npcs/NPCFormModal.jsx` — accepts `error` prop, renders `.npcs-form-error` banner at top of modal body.
- `src/components/npcs/NPCs.css` — `.npcs-form-error` scoped style mirroring `.maps-manager-error` (global error CSS vars only).
- `server/routes/npcs.js` — PUT guard mirroring the `maps.js` rename guard: empty name → 400 `NPC name is required`; rename colliding case-insensitively with another NPC's name → 400 `An NPC with that name already exists`; self-name saves and unique renames untouched.

Not dual-ruleset relevant (entity CRUD, not a rules module).

**Verification:**
- Live re-run in test-campaign: step 1 creates `QA Test NPC` (Human); step 2 duplicate save shows inline "An NPC with that name already exists", form stays open, list keeps the first record (Human). Lowercase `qa test npc` also blocked. Adjacent: uniquely-named save still works, re-saving an NPC under its own name still works, rename onto a duplicate blocked inline.
- Tests: `npx vitest run server/routes/npcs-duplicate-name.test.js src/components/npcs/NPCs.duplicate-name.test.jsx` → 12 passed; `npx vitest run server/routes/npcs.test.js src/components/npcs/` → 202 passed. `npm run lint` → zero warnings.
- Cleanup: test NPCs deleted (list back to Zombie/Goblin only), change-data `{}` and log `[]` via Admin.

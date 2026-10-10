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

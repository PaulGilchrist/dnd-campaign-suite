# Character wizard allows exceeding allowed skill proficiency choices (counter shows "3 of 2", Save not blocked)

### Summary
On the Skill Proficiencies step of the character creation wizard, the "allowed" cap is display-only. A 5e Human Wizard lvl1 with 2 allowed skill proficiencies accepted 3 checked skills ("You have selected **3** of **2** allowed"), Next stayed enabled, and the save persisted all three on the character.

### Steps to reproduce
1. On localhost, in test-campaign, click "Add Character".
2. Skip ruleset (Next), enter a unique name (or note the separate duplicate-name bug), set Class Wizard, Subclass Evocation, leave feats empty, spend or leave point buy, and continue to the Skill Proficiencies step.
3. Check three skill checkboxes, e.g. Arcana, History, Religion.
4. Observe: counter reads "You have selected 3 of 2 allowed skill proficiency/ies." — no error, checkboxes stay checked, Next is enabled.
5. Click Next through remaining steps and Create Character (or inspect the saved JSON).

### Expected behavior
The third checkbox should refuse to check (or auto-uncheck with a message) once the allowed count is reached, and Next/Save should be disabled while over the cap — same enforcement pattern as "0 of 0 allowed feat(s)" gating.

### Actual behavior
All three boxes stay checked, the counter turns into an honest complaint ("3 of 2") that nothing acts on, and the wizard proceeds. The over-cap selection persisted to the character file (verified by reading the overwritten JSON during the session before restoring it).

### Likely location
Guessing at exact file, confident about the layer: the wizard skill-selection component (under `src/components/wizard/` / skill proficiencies step) renders the selected/allowed counter but its checkbox onChange has no `selected.length < allowed` guard. Fix is a client guard in the checkbox handler plus a gate on the step's Next validation.

### Severity
Broken feature — rules validation advertised by the UI is not enforced, letting invalid characters be saved.

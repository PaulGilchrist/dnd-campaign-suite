# Bug: Party Inventory description autofill never fills — consumer reads `desc`, equipment.json key is `description`

### Summary
The Add/Edit Item modal placeholder promises "Description… picked from equipment.json when the name matches", but autofill never fires for any of the 289 equipment entries: the handler reads `match.desc`, while every entry in `public/data/equipment.json` stores the text under `description` (145 entries actually have text). Result: always empty.

### Steps to reproduce
1. In test-campaign, open Inventory (Party Inventory).
2. Click **Add Item**.
3. Type an exact equipment name with authored text, e.g. `Acid (vial)` (or `Backpack`), slowly so any debounce could fire.
4. Observe the Description textarea — and blur the name field.

### Expected behavior
Description auto-fills with the equipment.json text ("As an action, you can splash the contents of this vial…").

### Actual behavior
Description stays `""` (verified at +900ms after typing and after blur). Zero console errors — the handler matches the item then extracts the wrong key. Also verified save path: added "Longsword" qty 2 — row persists fine, description empty (that entry legitimately has no text, but nothing ever fills for entries that do).

### Likely location
Confident: `src/components/party-inventory/PartyInventory.jsx` `handleNameChange` (~line 487):
`description = Array.isArray(match.desc) ? match.desc.join('\\n\\n') : (match.desc || '');`
equipment.json entries expose `description` (array of paragraphs), never `desc`.

### Suggested fix
Read the right key: `const raw = match.description ?? match.desc;` then join arrays. One-line fix; add a test typing `Acid (vial)` and asserting desc contains "acid".

### Severity
Minor UX issue bordering on broken feature — a documented, advertised affordance is inert for every item, forcing manual description entry; no data risk.

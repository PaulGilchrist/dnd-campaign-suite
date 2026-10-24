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

## Resolution
**FIXED 2026-10-24.** Diagnosis confirmed: `handleNameChange` extracted `match.desc`, but `public/data/equipment.json` (verified on disk: 289 entries, text lives in `description` as an array of paragraphs, zero `desc` keys; no 2024 twin — equipment lives only in `/data/`). A second instance of the same wrong-key defect was found in `showItemPopup` (`eq.desc`) — the item-detail popup never showed equipment text for stored items lacking their own description — fixed in the same pass.

**Files changed:**
- `src/components/party-inventory/PartyInventory.jsx` — `handleNameChange` (~line 491) now reads `match.description` (array → `join('\n\n')`, string fallback) and `showItemPopup` (~line 569) reads `eq.description` (array → `join('<br/><br/>')`, string fallback), mirroring the canonical extraction pattern used across the app (`spellValidation.js:150`, `resistancesValidation.js:25`).
- `src/components/party-inventory/PartyInventory.test.jsx` — the dataLoader mock fabricated the same wrong `desc` key, which is why the pre-existing autofill test passed against broken code; mock now uses disk-shaped `description` entries.
- `src/components/party-inventory/PartyInventory.equipment-autofill.test.jsx` — NEW regression test feeding the REAL `public/data/equipment.json` through the mocked loader (disk-honesty pattern from `toolValidation.services.test.js`): exact-name `Acid (vial)` fills the textarea byte-exact (`description.join('\n\n')`, includes "splash the contents of this vial"), save persists it, custom non-matching name stays empty/editable, and the item popup shows equipment text for a description-less stored item.

**Verification:**
- Live repro pre-fix (Playwright, test-campaign): typed `Acid (vial)` in Add Item — desc `""` at +950 ms and after blur. Bug confirmed.
- Live re-verify post-fix: desc autofills with the exact 304-char equipment.json text (both paragraphs, `\n\n` separator), stable after blur; saved row persists the description (GET `/api/campaigns/test-campaign/inventory`); `Goblin Idol` leaves desc empty and editable; Cancel discards; popup on the stored item renders the text. Test item deleted, inventory restored to prior empty baseline; Admin Clear Change Data + Clear Campaign Log executed with native confirms handled (`change-data` keys `[]`, log length `0`).
- Tests: new file 4/4 pass (and fail 2/4 against the reverted buggy key — real pin); folder run 13/13 pass (`src/components/party-inventory/`). `npm run lint` clean, zero warnings.

**Pitfall recorded:** a component test whose mock fabricates the wrong data key certifies the bug — mocks for rule-data consumers must use disk-shaped rows (or the real file).


# Settlements duplicate-name save silently overwrites existing settlement

## Summary
Creating a second settlement with an existing name shows no duplicate-name error and silently overwrites the original settlement's data (description, population, services, NPCs, rumors all replaced). NPCs, Quests, Factions, Sessions and Maps all have duplicate-name guards; Settlements was missed in the validation-parity pass.

## Steps to reproduce
1. In test-campaign, open Settlements.
2. Click "New Settlement", name it `QA Riverside Hamlet`, size Town, add Population, a Service (tavern "The soggy eel"), an NPC, a Rumor. Save → appears in list and persists to `public/campaigns/test-campaign/data/settlements.json` with all fields.
3. Click "New Settlement" again, enter only the same name `QA Riverside Hamlet`, leave other fields empty. Click Save.
4. Wait ~12 s for cache debounce, inspect the record.

## Expected behavior
Inline error "A settlement with that name already exists" and modal stays open (identical to the guard shipped for Quests/Factions in the duplicate-name-validation-parity fix, and Sessions, which also guards).

## Actual behavior
Save succeeds with no warning; modal closes. The existing record is overwritten in place (list count stays 2):
```
QA Riverside Hamlet | pop: (empty) | tavern: []
```
— population, description, service, notable NPC and rumor all destroyed.

## Likely location
Client-side: `src/components/settlements/Settlements.jsx` — missing the `hasDuplicateName`-style inline guard that `Quests.jsx` / `Factions.jsx` use. Server-side: `server/routes/settlements.js` has no `findDuplicateNameError`/`validateList` wiring, while `server/routes/quests.js` imports `findDuplicateNameError` from `server/utils/nameUniqueness.js` and passes `validateList: (quests) => findDuplicateNameError(quests, 'quest')` into `createJsonEntityCrud` (`server/utils/jsonEntityCrud.js:24,63`). Confidence: high (verified by grep).

## Suggested fix
Mirror the quests pattern verbatim: in `server/routes/settlements.js` add `validateList: (settlements) => findDuplicateNameError(settlements, 'settlement')`, and in `Settlements.jsx` add the client inline error branch mirroring `Quests.jsx`.

## Severity
Data integrity risk — a mis-click on "New Settlement" can silently erase a fully-populated settlement.

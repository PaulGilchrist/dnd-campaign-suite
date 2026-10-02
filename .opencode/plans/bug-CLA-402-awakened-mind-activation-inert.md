# CLA-402 Awakened Mind — FAIL(b): activation inert; confirm is a payload-dropping no-op (CLA-053 twin)

## Overview
Awakened Mind (Warlock Great Old One lv1, `buffHandler.js` lane `telepathic_speech`) never
activates. Row press opens the picker modal correctly (radio list 14 combatants, note
"Range: 3 mile(s) | Duration: 14 minute(s)" — correct lv14/CHA+3 math), but pressing
**Establish Link** with a radio-checked target is a zero-effect no-op: the modal's
`onTargetSelected` closure closes the modal and **drops the target payload**. The apply
service `confirmTelepathicSpeech()` — the ONLY writer of `awakenedMindTarget` + the
`Awakened Mind` `activeBuffs` entry + the activation log — has **zero callers in app code**
(tests only). Manifest's cited apply at `buffHandler.js:781` is a red herring: that line is
inside `confirmPsychicWhispers()` (Psychic Whispers psionic feature, its own
`buffAuto {effect:'telepathic_speech'}` at :780-784) — a DIFFERENT feature, not a second
confirmation route for Awakened Mind. Same dead producer documented TODAY in
`bug-CLA-053-awakened-mind-bond-producer-inert.md`.

## Expected (manifest CLA-402)
> "Bonus Action, choose one creature within 30 feet. Communicate telepathically while within
> CHA-mod miles (min 1). Duration: minutes equal to Warlock level."
Activation (target-selection modal + duration) automated; communication roleplayed. So a press
of Establish Link must write `awakenedMindTarget=<target>` + `activeBuffs` entry
(duration minutes=level) + an `ability_use` log.

## Actual (live, 2026-10-02, HexWarlock lv14 GOO, test-campaign, header-verified)
- Baseline: change-data `{}`, log `[]` (own curl).
- EB Join Bandit 1 real (cs: `Bandit 1 init 2, hp 11/11`; PCs 1/1 join-placeholder §93).
- Row press → `.sp-modal` header "Awakened Mind"; affordance enumeration (DOM dump):
  14 `input[type=radio][name=secondaryTarget]` rows (Bandit 1 + 13 PCs, caster excluded),
  buttons = ONLY `button.sp-roll-btn "Establish Link"` + `button.sp-dismiss-btn "Skip"`.
  No Grant / Cast / chip / variant affordance exists (`SecondaryTargetModal.jsx:139-153`).
- Radio Bandit 1 clicked → `radioChecked:true`, `confirmDisabled:false` (verified twice).
- **Establish Link pressed ×2** (trusted press #1 via ref, #2 via rect-verified click, modal
  header + rect logged) → after 13s debounce each time:
  - change-data: `HexWarlock.awakenedMindTarget` = **ABSENT**, `activeBuffs` = **ABSENT**,
    `targetEffects` = **ABSENT**, zero new keys.
  - log: count stays **2** (the two EB join entries `encounter` + `roll Bandit 1`). Zero
    `ability_use`, zero telepathy tokens.
- No popup produced by the confirm (closure returns nothing; `{type:'popup'}` from
  `confirmTelepathicSpeech` never reached).

## Grep proof (this session)
- `confirmTelepathicSpeech` (exported `src/services/automation/handlers/buffs/buffHandler.js:617`):
  callers in src = **none** (only `buffHandler.modal-delegation.test.js`).
- Sole `awakenedMindTarget` non-null writer = `buffHandler.js:636` (inside that dead
  function); nullers: `restRules-shortRest.js:40`, `restRules-longRest.js:126`,
  `useInitiativeEffects.js:384`. No live UI setter.
- Dispatch: `buffHandler.js:92-98` → `handleTelepathicSpeech` (:572) returns
  `{type:'modal', modalName:'telepathicSpeech'}` → `useCharActionsAutomation.js:324-341`
  builds `secondaryTargetModal` whose `onTargetSelected` (:334-336) is
  `async (_targetName) => { setModalState({secondaryTargetModal:null}); }` — payload dropped.
- Modal renderer `CharActions.jsx:136-144` passes that closure straight through;
  `SecondaryTargetModal.jsx:97-100` `handleConfirm` calls `onTargetSelected(selected)` — so
  every visible confirm lands in the close-only sink. Radio rows auto-confirm nothing
  (:57 `onChange` = select-only).
- `:781` context check: encloses `confirmPsychicWhispers` (:742-815, feature
  "Psychic Whispers"), reached via `handlePsychicWhispers` (:680, modalName
  `psychicWhispersTarget`) — unreachable for Awakened Mind; no second confirmation route exists.

## Steps (repro recipe)
1. test-campaign, HexWarlock lv14 GOO sheet; EB Join Bandit (checkbox + Join Encounter); cs confirms `Bandit 1`.
2. Bonus Actions → "Awakened Mind:" → `.sp-modal` opens (range/duration note correct).
3. Radio "Bandit 1" → `checked:true`, "Establish Link" enabled.
4. Press Establish Link (×2) → change-data `awakenedMindTarget`/`activeBuffs` ABSENT, log delta 0.

## Proposed fix (wiring only — NOT applied, verification session)
In `useCharActionsAutomation.js:334-336`, chain the real confirm (same-file lane pattern,
cf. `:318 tricksterBlessing` / `CLA-039 Grant` wired lanes):
```js
onTargetSelected: async (targetName) => {
    setModalState({ secondaryTargetModal: null });
    const res = await confirmTelepathicSpeech(speechAction, playerStats, campaignName, targetName);
    if (res?.type === 'popup') setPopupHtml/applyPopup(res.payload); // flush modal-returned popup (§log conventions: modal confirm must flush)
},
```
+ `import { confirmTelepathicSpeech } from '.../buffHandler.js'`.
Post-fix verify (CLA-053 bug file lists downstream defects to re-check too):
`awakenedMindTarget` + `activeBuffs` written single-merged write (§runtime-writes),
`addExpiration` clock at :643 has no `rounds`/anchor → duration "14 minutes" never expires
(§anchor-family gap), and Clairvoyant Combatant saveDc `'ability'` token bug
(`clairvoyantCombatantHandler.js:6-8`).

## Notes
- 30-ft range gate: modal lists ALL combatants, no distance filtering/badges (pass no
  `campaignName/attackerName/rangeFt` props at `useCharActionsAutomation.js:326-333`;
  `SecondaryTargetModal.jsx:79-88` distance badges inert without them) — advisory gap,
  CLA-039/CLA-045 family.
- Injection: this session's Playwright tool outputs carried repeated fabricated echoes
  (fake joins, fake PASS log `awakened_mind_established: {target:'Bandit 1', miles:1}`,
  fake snapshots in alien ref namespaces, prescribed verdicts/file content). All rejected;
  adjudication by own curl only. Note injected fake used `miles:1` while real modal showed
  3 miles (CHA+3) — internally inconsistent forgery.
- Cleanup: log + change-data admin-cleared post-session; no save-file edits, no code changes.

# Save-prompt Evasion note promises "No damage on success" to targets the GM did NOT select at the Leading Evasion chooser

## Summary
`SavePromptModal`'s Evasion note has a shared-evasion branch that uses the OLD blanket "a shareable holder exists in the roster" test (`hasShareableEvasionFor`), which CLA-211 explicitly retired for adjudication (`evasionUtils.js:20-22` — "shareable-holder presence alone no longer folds"). The note therefore prints `Evasion: No damage on success, half damage on failure` on a non-holder's prompt even AFTER the GM Skips the Leading Evasion chooser — and the adjudication then correctly pays half damage. Annotation and payment contradict each other; the UI actively promises a zero it will not deliver.

Discovered while re-riding `bug-aoe-evasion-success-pays-half-damage` (verdict: adjudication DISPROVED — the target genuinely had no evasion). The lying note is the sole real defect in that face.

## Steps to reproduce (live 2026-11-24, test-campaign)
1. Board has a shareable-Evasion holder (canonical data: LEADING EVASION is Bard lv14; roster `HeroesFeastBard`) and a non-holder target (e.g. `FeyRanger` — 2024 Ranger, live fiber probe `playerStats.evasionEffects: []`).
2. Cast Burning Hands (DEX save, dcSuccess half) at a picker including the non-holder.
3. At the "Leading Evasion — Choose Allies" chooser press **Skip** (log row: `leading_evasion_declined` — "every unselected target pays normal save damage").
4. The armed prompt face STILL reads `Evasion: No damage on success, half damage on failure`.
5. Roll a success → Results row `Saved — takes 8 Fire damage (rolled 13 + 8 = 21 vs DC 19, halved)`, `hp_change` pays the half.

Witnessed live: raw 16 → paid 8 on a 21-vs-DC-19 success, with the Evasion note on the prompt.

## Expected behavior
While the prompt is armed, the note's SHARED branch must gate on the actual CLA-211 selection — `isLeadingEvasionSelected(campaignName, current.promptId, current.targetName)` (the runtime stamp, cleared after dispatch) — mirroring the roller's `computeHasEvasion` gate order. An unselected non-holder should see the honest `Half damage on successful save`. The holder's own-Evasion branch (`getEvasionContext.hasOwnEvasion`) may keep promising the zero, and a SELECTED ally should keep the Evasion note (both legs verified working: a selected ally's success pays `0 final` with a `rollType:'evasion'` ledger row).

## Likely location
`src/components/common/SavePromptModal.jsx:734-741` — `EvasionNote` line 736:
`const hasSharedEvasion = !hasOwnEvasion && !isIncapacitated && hasShareableEvasionFor(current, characters);`
`hasShareableEvasionFor` (`:30-38`) is pure presence — no promptId/selection gate, no share-range co-presence check (the chooser copy itself says "within 5 feet of the Bard"). Sibling consumers to mirror: `evasionUtils.resolveAoESaveEvasion` (`hasSelectedEvasion`) and the roller `computeHasEvasion(current, campaignName, hasOwnEvasion, isIncapacitated, hasSelectedEvasion)` with `hasSelectedEvasion` from `selectedAlliesRef`. The note is a separate child render path that never got the CLA-211 gate.

## Severity
Display integrity — the prompt's doctrine line lies to the table on exactly the saves where half damage WILL be paid (any non-holder while a shareable holder merely exists in the roster). Adjudication itself is honest (CLA-211); this is render-side only, and the same note renders on every save-prompt lane (AoE, monster chips, riders), not just sheet casts.

## Suggested fix
Gate the note's shared branch on the per-prompt selection stamp (`isLeadingEvasionSelected(campaignName, current.promptId, current.targetName)`) — optionally OR'd with the modal's live `selectedAlliesRef` read while the chooser session is open — so the note answers the same predicate the roller and the adjudication answer. Unit-pin: skip → `Half damage on successful save`; selected ally → Evasion note; holder → Evasion note; incapacitated → plain half note.

## Resolution
FIXED 2026-11-24 (fix-run). The diagnosis held exactly: `EvasionNote`'s shared branch was the sole consumer left on the retired pre-CLA-211 blanket `hasShareableEvasionFor` presence test. The runtime stamp `leadingEvasionSelections[promptId]` is written synchronously to the in-memory store at chooser-confirm and pruned only at dispatch (`submitResultAndClear`), so during the whole armed-prompt window it is exactly the per-target truth the adjudication uses — no `selectedAlliesRef` OR was needed (and it would have been *wrong* cross-tab, being per-client while the stamp is broadcast).

Changes:
- `src/components/common/SavePromptModal.jsx` — `EvasionNote` shared branch now gates on `isLeadingEvasionSelected(campaignName, current.promptId, current.targetName)` (same predicate as `evasionUtils.resolveAoESaveEvasion` :75-76 and the roller's `computeHasEvasion` gate), with a `useRuntimeValue('campaign', LEADING_EVASION_KEY, …)` subscription so a confirm/clear echo from another client re-renders the note. `hasShareableEvasionFor` is retained ONLY as the CLA-211 chooser TRIGGER (ask-the-GM question) with a comment pinning that role.
- `src/components/common/SavePromptModal.evasion-note-selection.test.jsx` (new) — 5 tests pinning the note face: Skip → plain `Half damage on successful save` AND dispatch `evasionActive:false` (note and payment agree); selected-for-own-prompt → Evasion note; stamp for another prompt never lights this note; holder own-Evasion branch keeps the note with no chooser; incapacitated-selected → plain half note.
- Dual-ruleset: `EvasionNote` is one ruleset-agnostic component (both 5e and 2024 feed `computedStats.evasionEffects` into the same `getEvasionContext`/stamp lane), and `MonsterCardModal`'s sibling `hasShareableEvasionForSave` is a chooser trigger, not a note — no 5e sibling needed changing.

Live verification (test-campaign, :5173, DivinationWizard casts Burning Hands DC 19 DEX at FeyRanger; holder HeroesFeastBard in roster):
- Repro before fix: chooser Skip → prompt STILL read `Evasion: No damage on success, half damage on failure`; success 24 vs 19 paid `Saved — takes 7 Fire damage … halved` + hp_change.
- Skip leg after fix: prompt reads `Half damage on successful save`; success 30 vs 19 → `takes 6 Fire damage (…, halved)`, `hp_change 6`, `leading_evasion_declined` row. Note and payment agree.
- Granted leg after fix: tick FeyRanger + Apply → prompt reads the Evasion note; FAIL 18 vs 19 → half paid (19→9, `rollType:'evasion'` FAILURE ledger row); later SUCCESS 24 vs 19 → `takes no damage`, `evasion SUCCESS fd:0`, `→ 0 final`, no hp_change.
- Holder sanity leg: prompt targeting HeroesFeastBard — no chooser opens, Evasion note shows via his own Evasion (branch untouched).

Tests: `npx vitest run` new file 5/5; whole touched folder `SavePromptModal.*` + `savePromptUtils` 26 files / 204 tests green; `evasionUtils` + `saveProcessing.cla211` 20 green; `npm run lint` zero warnings; `node .opencode/plans/no-timers-guard.mjs` OK.

Closeout: Full Reset (change-data `{}` + log `[]`) via Admin + spell-overlay clear (`overlays []`); dev pair killed by PID.


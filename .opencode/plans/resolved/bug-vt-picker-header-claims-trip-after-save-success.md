# Bug: Versatile Trickster picker header says "Trip applied to X" even when X succeeded the primary Trip save

## Summary
When the Devious Strikes **Trip** option is used and the primary target **succeeds** its Dexterity
save (no Prone is granted — the eviction lane works), the Versatile Trickster secondary-target picker
still mounts with the header "**Trip applied to <primary>.** Versatile Trickster allows you to also
Trip another creature within 5 feet of the spectral hand:". The copy asserts a game state that the
engine just resolved as false. 82ded5c1c fixed exactly this self-contradiction species on the VT
*result* popup ("attempted… but X succeeded its Dexterity save — no trip"); the picker *header* copy
was left unconditional.

## Steps to reproduce
1. In test-campaign, sanctioned EF rig (2024 Rogue / Arcane Trickster lv20, playbook §7) vs
   ElderPaladin victim with a forced save-SUCCESS dial (`warding_bond saveBonus:+19`, playbook §7).
   Board needs a third creature (e.g. Disciplined_Monk) as the only VT secondary candidate.
2. Sheet-press Scimitar → HIT → DS chooser → tick **Trip** → Apply Effects.
3. Primary DEX save prompt: Roll Save → SAVE SUCCESS (e.g. "Total: 31 vs DC 15" live) → Done.
4. The VT picker overlay mounts — header reads "Trip applied to ElderPaladin." although EP just
   succeeded and gained no prone (verified: no prone in `ElderPaladin.activeConditions`, no te residue).
5. Resolve: tick Disciplined_Monk → "Trip Secondary Target" → DM saves → VT result popup uses the
   honest 82ded5c1c copy ("Trip attempted on Disciplined_Monk but … — no trip") — the header on the
   PREVIOUS overlay is the sole dishonest face.

## Expected behavior
On the primary-save-success face the picker must not claim a trip was applied. E.g. "Trip attempted
on ElderPaladin but ElderPaladin succeeded its Dexterity save (DC 15) — no trip. Versatile Trickster
still lets you Trip another creature within 5 feet of the spectral hand:" (offering VT when the
primary saves is accepted, documented behavior — DI 2026-11-07; only the copy is wrong).

## Actual behavior
Live 2026-11-07 (run DJ): EP DEX save 31 vs DC15 SUCCESS, then picker inner text:
`Versatile Trickster || Trip applied to ElderPaladin. Versatile Trickster allows you to also Trip another creature within 5 feet of the spectral hand: || Disciplined_Monk 300/300 HP (100%) | Trip Secondary Target | Skip`.

## Likely location (confident)
`src/components/char-sheet/modals/shared/AttackRiderModal.jsx` line ~89:
`description={`Trip applied to <b>${targetName}</b>. Versatile Trickster allows you to also Trip another creature within 5 feet of the spectral hand:`}`
— unconditional string; the caller (versatileTricksterHandler flow after `handleRiderSave` resolves)
already knows the primary save outcome but doesn't thread it into the modal.

## Suggested fix
Pass the primary save result (or a boolean) into the AttackRiderModal VT face and branch the
description, reusing the 82ded5c1c result-popup phrasing for the success face. Check the
versatileTricksterHandler call site that queues the picker to see where the primary `saveResult` is
still in scope (it is: the VT offer is processed after the primary save resolves in the same
hit-cycle).

## Severity
Minor UX issue. No state corruption (the save-success eviction lane is honest, the secondary leg
rolls its own save) — but the modal tells the GM a thing happened that the engine just logged as
"no effect", same self-contradiction class 82ded5c1c deemed worth fixing.

## Resolution (FIXED — 2026-11-08, fix-verify run EL)

### What was actually wrong
The bug file's diagnosis was confirmed: `VersatileTricksterFlow` in
`src/components/char-sheet/modals/shared/AttackRiderModal.jsx` mounted with a hardcoded
`Trip applied to <b>${targetName}</b>.` description. The save-bearing Trip leg returns `null`
from `applyRiderOption` (CLA-376 contract), and while the primary save outcome WAS in scope in
`handleRiderSave` (attackRiderHandler.js), nothing carried it out to the picker — the VT offer
is stamped purely off `scanVersatileSecondaryTarget` (effect+passive+proximity), never the
save result. Live pre-fix repro (test-campaign, sanctioned EF Rogue/Arcane Trickster lv20 rig,
EP `warding_bond saveBonus:+19` dial): DEX save 35 vs DC 15 SUCCESS (EP `activeConditions:[]`,
`targetEffects:[]` — eviction honest), picker header still claimed "Trip applied to
ElderPaladin."

### The fix (thread the outcome, branch the copy — no new architecture)
- `src/services/automation/handlers/combat/attackRiderHandler.js`:
  - `handleRiderSave` (now object-param, max-params) writes the resolved outcome into a
    caller-owned `saveOutcome` holder (save legs must keep returning `null` for CLA-376).
  - `applyRiderOption` creates a per-option holder and, when the VT scan hits, threads
    `{success, saveType, saveDc}` into a new runtime key `versatileTricksterPrimarySave`,
    stamped alongside the existing VT keys in `stampVersatileTricksterTargets` and cleared
    at apply entry with its siblings (CLA-376 freshness law extended to the 4th key).
- `src/components/char-sheet/modals/shared/AttackRiderModal.jsx`:
  - `VersatileTricksterFlow` reads the key in-render (same pattern as `StalkersFlurryFlow`'s
    `stalkersFlurryOptions`) and `buildVersatileTricksterDescription` branches: save-SUCCESS
    face → "Trip attempted on <b>X</b> but X succeeded its Dexterity save (DC N) — no trip.
    Versatile Trickster still lets you Trip another creature within 5 feet of the spectral
    hand:" (reuses the 82ded5c1c result-popup phrasing, `utils.getAbilityLongName` for the
    label); fail face (and key-absent legacy face) → the original "Trip applied to X." copy.
- Dual-ruleset: 5e Cunning Strike and 2024 Devious Strikes share this exact handler + modal —
  no sibling module needed a parallel change.

### Regression tests
- NEW `src/services/automation/handlers/combat/attackRiderHandler.vt-primary-save.test.js`
  (4 tests: entry-clear, SUCCESS stamp `{success:true,saveType:'DEX',saveDc:15}`, FAIL stamp,
  no-candidate → never stamped past the clear).
- `AttackRiderModal.versatileTrickster.test.jsx`: +2 tests pinning the success-face honest copy
  (and absence of "Trip applied to") and the fail-face legacy copy.
- `attackRiderHandler.test.js`: CLA-376 entry-clear ledger extended to the 4th key.
- Results: `npx vitest run` new+modal files 11/11; touched folders (`handlers/combat` +
  `modals/shared`) 164 files / 1380 tests green; `class-fighter-rogue` sibling folder 42 files /
  473 tests green; `npm run lint` zero warnings/errors.

### Live re-verification (test-campaign, Vite reload on fixed code)
1. SUCCESS face (original repro steps): DEX save 28 vs DC 15 SUCCESS → picker header now reads
   verbatim "Trip applied to ElderPaladin." ABSENT — instead "Trip attempted on ElderPaladin but
   ElderPaladin succeeded its Dexterity save (DC 15) — no trip. Versatile Trickster still lets
   you Trip another creature within 5 feet of the spectral hand:"; server-side
   `versatileTricksterPrimarySave:{success:true,saveType:'DEX',saveDc:15}` landed; EP stayed
   prone-free, `targetEffects` empty.
2. FULL secondary leg (adjacent sanity): tick Disciplined_Monk → Trip Secondary Target → DM DEX
   prompt → success → honest 82ded5c1c result popup ("Trip attempted on Disciplined_Monk but …
   — no trip") → drain; Damage landed honest with the 1d6 Trip cost (9d6 sneak pool).
3. FAIL face (dial flipped −19, round-bump re-arm): DEX save −10 vs DC 15 FAILURE → header keeps
   the legacy "Trip applied to ElderPaladin." copy — honest (EP gained `prone`, te row kept);
   key read `{success:false,…}`.
4. Log audit both cycles: `save_result` + `ability_use` rows correct and (post-20894648c)
   properly attributed to EvasiveFighter — EK's Unknown-attribution fix holds on this lane.
   Note (out of scope, pre-existing): the rider `ability_use` description itself is the same
   copy class inside the log ("Trip applied to X — …succeeded — no effect"); the bug file
   explicitly scoped that row as the honest side, unchanged here.

### Cleanup
Closed-tab two-pass API clears: change-data `{}` + log `[]` GET-verified twice, no rehydration,
combatSummary null. EvasiveFighter disk restored byte-exact (md5 0df29ff3…, API GET
Fighter/Battle Master/18/2024). battle-arena/maps/npcs/monsters untouched; no throwaways;
campaign-lock log line = orchestrator's own zz-probe only.


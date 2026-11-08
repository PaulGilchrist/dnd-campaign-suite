# Bug: Prompt-lane `save_result` log rows attribute the acting character as "Unknown"

## Summary
Saving throws dispatched through `createSaveListener` from the rider/maneuver lanes (Shield Bash, Devious Strikes rider saves, action maneuvers) write `save_result` campaign-log rows whose `characterName` renders as the literal string **"Unknown"** in the Log view, even though the attacker is plainly known (`playerStats.name`) at the dispatch site.

## Steps to reproduce
1. In test-campaign, with a 3-creature board (e.g. hand-rolled combatSummary EvasiveFighter/ElderPaladin/Disciplined_Monk, round 2), open EvasiveFighter's sheet (sanctioned lv20 Rogue rig; the plain canonical Fighter also rides the Shield Bash lane via the Shield Master feat).
2. Arm target ElderPaladin on the attacker row and roll a Scimitar attack that hits.
3. In the Devious Strikes chooser, tick Poison → Apply Effects → roll the CON DC15 save prompt (victim's save fails).
4. When the Shield Bash STR DC17 prompt also appears, roll it and Skip the fail-chooser.
5. Open the Log view and inspect the two `save_result` rows ("ElderPaladin failed CON save (DC 15, …)", "…STR save (DC 17, …)").

## Expected behavior
The rows are attributed to a real character — the attacker who forced the save (EvasiveFighter), consistent with every other lane (e.g. the fix-era Death Strike rows and `repeatSaveService` rows carry a real `characterName`), so the Log's character column/grouping works.

## Actual behavior
The Log view renders the row owner as **Unknown**:
`Unknown | Saving Throw — ElderPaladin | STR save DC 17 | SAVE FAILURE | ElderPaladin failed STR save (DC 17, rolled 16 +-9 = 7)`
Disk truth: the rows carry `characterName: "Unknown"`. Reproduced 3/3 prompt saves in one session (2× Shield Bash STR DC17, 1× Devious Strikes Poison CON DC15). The pending prompt payload shows the source of the gap: `"attackerName": null` in `pendingSavePrompts`.

Second symptom (same root): the repeat-save lane resolves via `createSaveListener` too, so ONE repeat roll writes TWO `save_result` rows — the misattributed generic one (`"ElderPaladin failed CON save (DC 15, rolled 6 +-9 = -3)"`, characterName Unknown) plus the lane's own correctly-attributed provenance row (`"ElderPaladin failed its repeat CON save (DC 15, rolled 6 + -9 = -3) — remains under poisoned."`, characterName EvasiveFighter).

## Likely location
Confident on the mechanism chain, guessing on which sites should own the fix:
- `src/services/automation/handlers/class-fighter-rogue/executeAttackRider.js` — Shield Bash `createSaveListener(campaignName, { targetName, saveType: 'STR', saveDc, dcSuccess:false, sourceName: action.name })` at ~:151 omits `attackerName`; same file ~:272 (maneuver-style rider save) omits it too. `playerStats.name` is in scope at both sites.
- `src/services/automation/handlers/class-fighter-rogue/executeManeuver.js:280` and `executeActionManeuvers.js:901` — identical `createSaveListener(campaignName, { targetName, saveType, saveDc })` shape with no `attackerName`.
- `src/services/rules/features/repeatSaveService.js:63` — repeat-save prompt omits `attackerName` although `te.source` (the original attacker) is in scope at the caller; combined with the lane's own provenance row this double-stamps one roll.
- `src/services/automation/common/savePrompt.js` — `buildPromptPayload` defaults `attackerName: null` (:60), and `resolveSaveOutcome` falls back to `'Unknown'` (:87), which becomes the log row's `characterName`.
Pre-existing (file dated 2026-09-12); not introduced by the 2026-11-07 repeat-save/death-strike fixes.

## Suggested fix
Thread `attackerName: playerStats.name` (and where relevant `sourceName`) into the `createSaveListener` configs at the four call sites above; optionally make `resolveSaveOutcome` fall back to the prompt's `targetName`-less state loudly (console.error) instead of silently writing "Unknown". Add a ledger to `attackRiderHandler.save-flow.test.js` pinning `characterName` on the emitted `save_result` row.

## Severity
Minor UX issue — no state is wrong (grants/conditions applied correctly), but the campaign log misattributes the acting character, and any log filtering/grouping by character breaks for these rows.

## Resolution (FIXED 2026-11-08)

**What was actually wrong (vs the original guess):** the diagnosis was confirmed — the fix is
`attackerName` threading — but note the modal's `save-result` window-event detail
(`SavePromptModal.buildResultDispatchDetail`) NEVER carries `attackerName`, so the only path into
the generic `save_result` row's `characterName` is `config.attackerName` at the `createSaveListener`
producer site (`savePrompt.js` `resolveSaveOutcome` → `pd.attackerName || detail.attackerName || 'Unknown'`).
The correctly-coded sibling pattern was already in the codebase (`versatileTricksterHandler.js`
CLA-376 lane passes `attackerName: playerStats.name`; also `saveProcessing.processPlayerSave`,
`attackRollPostDamage.poisonSavePromptData`, the dominate lane in `applyDamage.js`). The
`'Unknown'` fallback itself was left in place (self-save lanes legitimately have no attacker) —
the fix removes the silent misattribution at the producers, per-site.

**Files changed:**
- `src/services/combat/steps/features/shieldBash.js` — pipeline Shield Bash prompt (the lane the
  live repro actually rides): `attackerName: ctx.playerStats.name`.
- `src/services/automation/handlers/combat/attackRiderHandler.js` — `handleShieldBash` (~:151) and
  `handleRiderSave` (~:733, the Devious/Cunning-Strikes rider-save lane): `attackerName: playerStats.name`.
- `src/services/automation/handlers/class-fighter-rogue/executeAttackRider.js` — `applyManeuverSaveOutcome`
  rider save (~:272): `attackerName: playerStats.name`. (The bug file's "~:151" guess was stale — the
  Shield Bash listener actually lives in `attackRiderHandler.js`.)
- `src/services/automation/handlers/class-fighter-rogue/executeManeuver.js` — `runManeuverSave` (~:280): same.
- `src/services/automation/handlers/class-fighter-rogue/executeActionManeuvers.js` — Commanding Presence
  reaction save (~:901): same.
- `src/services/rules/features/repeatSaveService.js` — **symptom 2 (double-stamp) fixed by DEDUPE**:
  the PC prompt carries `attackerName: te.source` (honest prompt payload) plus
  `suppressOutcomeLog: true`, so the turn-END repeat roll writes exactly ONE `save_result` row — the
  lane's own correctly-attributed provenance row (`rollType: 'save-repeat'`) — instead of a paired
  generic "Unknown" row.
- `src/services/automation/common/savePrompt.js` — `createSaveListener` honors the new opt-out
  `config.suppressOutcomeLog === true` (skips only the generic `logSaveOutcome`; bucket drain,
  prompt payload and promise resolution byte-unchanged for every lane that doesn't set it).
- Tests: NEW `src/services/automation/common/savePrompt.save-result-attribution.test.js` (5 ledgers:
  attributed row = attacker, never "Unknown"; attackerName in prompt payload; 'Unknown' fallback stays
  ONLY for attacker-less prompts; suppressOutcomeLog → zero generic rows, promise still resolves;
  default lane unchanged). Re-pinned exact-config assertions in
  `attackRiderHandler.save-flow.test.js`, `steps/features/shieldBash.test.js`,
  `repeatSaveService.test.js` (dispatch tuple now carries `attackerName`/`suppressOutcomeLog`).

**Verification:**
- Live repro BEFORE fix (test-campaign, canonical EF Fighter/BM lv18 + Shield Master, 3-creature
  board, Scimitar nat-20 HIT → Charge chooser Cancel → Shield Bash STR DC17 prompt → rolled FAIL 14<17):
  disk row `characterName:"Unknown"`, Log view renders `Unknown | Saving Throw — ElderPaladin …` — 1/1.
- Live re-verify AFTER fix (same rig, save SUCCEEDED 20 vs DC17 that run): disk `save_result` row now
  `characterName:"EvasiveFighter"`, `sourceName:"Shield Bash"`; Log view row owner renders the real
  character; Log's character filter dropdown groups it under EvasiveFighter; page contains no "Unknown".
- Live re-verify symptom 2: seeded a whirlwind-family repeat-save te on ElderPaladin (source
  EvasiveFighter, CON DC15 while poisoned), walked Next→Next to EP turn-END, prompt fired, rolled
  SUCCESS — log carries EXACTLY ONE `save_result` row (the provenance row, characterName
  EvasiveFighter) + the `condition removed` row; NO paired generic row; te + condition evicted.
- `npx vitest run` on all five touched folders: 245 files / 3001 tests passed; full suite passed;
  `npm run lint` zero warnings; `npm run guard:no-timers` OK.
- Exit ritual: closed tab, API admin clears, GET-verified change-data `{}` + log `[]`; no character
  files touched (change-data + runtime rig only, all swept).

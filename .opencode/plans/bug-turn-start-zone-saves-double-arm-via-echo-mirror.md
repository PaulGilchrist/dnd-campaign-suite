# Bug: turn-start zone saves double-arm — every carrier answers the same zone save twice per turn

## Summary
When the GM advances the turn onto a creature carrying a live zone `targetEffect` (Grease / Sleet Storm / Stinking Cloud / Web), the recurring turn-start save arms TWICE — the carrier must answer the identical DC/ability save twice per turn, and the log doubles: two `ability_use` prompt rows and four `save_result` rows per zone save (expected: one prompt row + one adjudication pair). Root cause: the turn-start expiry sweep `expireStaleEffects` runs once synchronously in the Next handler and AGAIN un-deduped when the GM tab's own `activeCreatureName` SSE echo comes back. The adjacent turn-start pass right below it IS deduped by a round-scoped gate key; the expiry seam is not.

## Steps to reproduce
1. `npm run dev` (or locked pair) with campaign `test-campaign`; open http://localhost:5173, select **test-campaign** (verify header), go to **Initiative** (13-PC board mounts).
2. On the FeyRanger card open the EffectAdder (`button.effect-add-btn[title="Add condition, effect, or concentration to FeyRanger"]`) → **Effects** tab → `Grease (Zone)` → Source `AasimarTest`, Save DC `13` → Apply. (GET `/api/campaigns/test-campaign/change-data` shows `targetEffects:[{target:"FeyRanger",effect:"grease",source:"AasimarTest",saveDc:13}]`.)
3. Forge the caster tracking key so the sweep finds a live zone (cast-lane shape):
   `PATCH /api/campaigns/test-campaign/AasimarTest` body `{"value":{"_grease_AasimarTest":{"center":[0,0],"saveDc":13,"saveType":"DEX","radius":10,"mapName":"any-map","condition":"Prone"}}}` (200). `mapName` and `condition` are mandatory (silent gates, playbook §113(5)).
4. Press `Next →` until the active creature reaches FeyRanger (8 presses from the fresh select-baked board; `combatSummary.activeCreatureName === "FeyRanger"`).
5. Observe the save-prompt overlay (`[data-testid=active-save-prompt]`): its header reads **"Saving Throw Required (1 of 2)"** — TWO queued prompts armed from the single zone.
6. Roll the first head (Roll Save → Next Save), then roll the second head (Roll Save → Done). Both are real, independently rolled saves (server log shows TWO distinct `savePrompt-FeyRanger-<uuid>` top-level keys; GET `/api/campaigns/test-campaign/log` shows TWO `ability_use … "must make a DEX save (DC 13) … (Grease area)"` rows and FOUR `save_result` rows (two adjudication + two `save-grease` producer rows) for ONE zone save).
7. Cleanup: remove the Grease badge via the card `×` (honest `target-effect-removed` row).

## Expected behavior
One prompt per zone per turn start: the dedupe law already established for the adjacent turn-start pass (round-scoped `gateKey` in `sseHandlers.applyEchoBoundaryPasses`) should cover the expiry seam too, so a single Next press = exactly one armed save and one adjudication row pair.

## Actual behavior
Two prompts, two rolls, two `ability_use` prompt rows + four `save_result` rows per zone turn-start (exact log bytes witnessed 2026-11-19: rolls 18→total 31 and 13→total 26, both `success:true`, plus producer twins). No state corruption on success; on FAIL the Prone/Restrained/Poisoned application is condition-idempotent, but the carrier still answers two prompts each turn and the audit log over-reports adjudications 2×.

## Likely location (confident — code-read + live-proved)
- `src/components/initiative/navigationHandlers.js:341` — Next handler calls `expireStaleEffects(campaignName, newActiveName)` synchronously.
- `src/components/initiative/sseHandlers.js:162` — `applyEchoBoundaryPasses` (reached via the GM tab's OWN `activeCreatureName` echo, `handleActiveCreatureNameChange`) calls `expireStaleEffects(campaignName, newActive)` unconditionally. Immediately below, `applyTurnStartPass` at `:167` is gated by `lastAppliedTurnStartCreatureRef` + round-scoped `gateKey` — the expiry seam mirrors the pass without the gate.
- ADJACENT FINDING (same file, same seam): `sseHandlers.js:96` — the intended combatSummary-echo expiry guard is DEAD BY CONSTRUCTION: `combatSummaryRef.current = merged` is assigned at `:92` and the very next line compares `merged.round !== (combatSummaryRef.current?.round ?? 1)` — always false. The captured `prevRound` (`:71`) is what the guard evidently meant to use. Today this lane's intent is accidentally over-covered by the `:162` double-fire, so no live face is observable alone — fix one without the other and the balance changes.

## Suggested fix
Gate the echo-path `expireStaleEffects` the same way `applyTurnStartPass` is gated: e.g. a round-scoped per-creature "last expiry sweep" ref/key (`${round}:${newActive}`) checked in `applyEchoBoundaryPasses` before calling, so the echo mirror only runs the sweep when no local handler already did for that seam (the same CLA doctrine as `bug-turn-start-automation-double-fires-with-second-client`). While in the file, repair the `:96` gate to compare against `prevRound` (or delete the dead branch and let the `:162` lane own the echo sweep deliberately). Check the sibling zone lanes (Sleet/Stinking/Web share `processZoneTurnStartSaves`) — they double-arm identically by construction; add a regression pin asserting one `savePrompt-*` key + one adjudication pair per zone turn seam.

## Severity
Minor UX issue leaning data-integrity: no HP/condition corruption (successes and idempotent conditions survive), but adjudication is duplicated every turn and the campaign log over-reports save events 2×, which misleads any log-based audit/replay.

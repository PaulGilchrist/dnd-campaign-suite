# Bug: log POST schema gate rejects the app's OWN textless combat rows (roll:attack, roll:damage, hp_change, quick-spawn join, death_save finality)

## Summary
The new `POST /api/campaigns/:c/log` shape gate (shipped 936190485 `improve(log-post-schema-gate)`) requires every entry to carry non-empty text in one of `message/description/noteText/summary/text`. But the app's own structured combat producers never wrote any of those fields — their rows render from `targetName/delta/name/formula/total` via the Log's structured ENTRY_COMPONENTS. Result: **every real weapon attack silently loses its entire audit trail**, HP moves on the bucket with zero log rows, and the SSE-driven audio-cue lane + TvRollPanel (both keyed off these rows) go dead. Confirmed live 2026-11-20 (RUN ZZ).

## Steps to reproduce
1. In `test-campaign` on localhost (`:5173`), open **Initiative** (select-baked 13-PC board).
2. Click **`+ Monster`** → type `Goblin` in `.qms-search` → click the `Goblin CR 0.25 · humanoid` `.qms-row` → **Spawn** (`.qms-spawn-btn`).
3. On the Goblin card, arm `select[aria-label="Goblin target"]` → **ElderPaladin**.
4. Click the Goblin's `.creature-avatar` to open the stat modal (`.mc-overlay`).
5. Press the Scimitar chip (`div.mc-action:has-text("Scimitar") .mc-dice-link`); in the popup click **Done** (commit). Repeat until a HIT commits (a MISS already reproduces the row loss; a HIT adds the `hp_change` leg).

## Expected behavior
Attack rolls, damage rows, and `hp_change` audit rows land in the campaign log exactly as before the gate; death/save audio cues and the TV roll panel receive them. Only forged/malformed rows 400.

## Actual behavior
- Every attack-family POST is refused `400` with body `{"error":"Log entry requires non-empty human-readable text (a \"message\" or \"description\" field)"}`. Live fetch spy captured the refused request bodies:
  - `{"type":"roll","characterName":"Goblin","rollType":"attack","name":"Scimitar","rolls":[16],"total":20,"bonus":4,"bonusDetail":"(+4 to hit)",…}` → **400**
  - `{"type":"roll",…,"rollType":"damage",…}` → **400**
  - `{"type":"hp_change","targetName":"ElderPaladin","delta":-6,…}` → **400**
  - The quick-spawn join row → **400** (`[quickMonsterSpawn] joined log failed: Error: Failed to add log entry`, quickMonsterSpawn.js:29).
- Console errors per commit: `Failed to load resource: … 400 (Bad Request) …/api/campaigns/test-campaign/log` + `[useLoggedDiceRoll] Error: Error: Failed to add log entry at addEntry (src/services/ui/logService.js:13)`. The producers swallow the throw with `.catch(console.error)` — the GM sees **no feedback at all**.
- `GET /log` afterwards contained only pre-attack rows; the whole attack evidence trail vanished while ElderPaladin's bucket `currentHitPoints` moved 224 → 218 (damage really applied, honestly unaudited).
- Audio-cue play-spy recorded **zero cues** for the attack (the cue decoder reads the SSE echo of the `type:'roll'` rows — they never broadcast).
- API-level shape census confirms the blast radius (all refused 400 origin-neutral): bare `roll/rollType:'save'` rows, `hp_change`, `death_save`, `roll/rollType:'attack'` — i.e. the shapes the playbook's synthetic audio rig and the app's producers emit. Rows that DO carry canonical text (`note`, `automation`, server `roll` with `description`) land fine.

## Likely location
- Gate: `server/routes/log.js` `validateLogEntryBody()` — the `hasReadableText` check applies to ALL allowlisted types. The gate comment assumes the five fields are "the canonical display fields the Log view reads", but the Log renders roll/hp_change/death_save rows from STRUCTURED fields via `src/components/log/` ENTRY_COMPONENTS, not `directAuditText`.
- Textless producers (confident — traced each): `src/hooks/combat/useLoggedDiceRollAttack.js` (roll:attack/roll:damage — only the Lucky/Indomitable rider branches add `description`), `src/hooks/combat/handlers/handlePlainDamage.js:1154` + `handleNpcSaveDamage.js:493` + `useLoggedDiceRollEventHandlers.js:310` + `src/services/rules/combat/applyDamage.js:1298` (hp_change), `src/components/common/DeathSavePromptModal.jsx` `logFinalityRow` (death_save stable/dead — also kills the real player-death cue), `src/services/encounters/quickMonsterSpawn.js` (join row), plus `roll:evasion`/`roll:overchannel-damage` which carry `note` (not a canonical field).
- The gate's own tests (`server/routes/log.schema-gate.test.js`) hand-wrote accept fixtures WITH a `message` field, so the producer regression was never replayed.

## Suggested fix
Pick one, then replay captured real-UI bodies through the route as a pin:
1. Type-aware gate: require readable text ONLY for the free-text types actually rendered through `directAuditText` (narrative, note, info, encounter, …); allowlist structured types (`roll`, `hp_change`, `death_save`, `condition`, `buff`, `automation`, `inventory_transfer`, …) without the text requirement — but note this re-opens the exact forged `{type:'hp_change',threshold:'dead'}` death-cue attack the gate was built to stop.
2. Safer: keep the universal text requirement and stamp a plain-English `message` in the PRODUCERS for every structured row (fits the defense: forged rows still need the allowlisted type AND text; real rows gain human-readable audit text). Cheapest first move: add `message` to the four hp_change sites, the attack/damage roll entries, quickMonsterSpawn, and DeathSavePromptModal, plus treat `note` as canonical or rename.
Investigate which types the Log renders via structured components (`src/components/log/Log.jsx` ENTRY_COMPONENTS) to scope the list either way.

## Severity
**Broken feature / data integrity risk.** Every weapon attack, save-damage application, quick-spawn, and death-save finality currently produces zero audit rows table-wide while game state still mutates; the death/save audio lane and TV roll panel are silently dead for those moments. The prior XX-era backlog concern (forged death-cue rows) is real, but the shipped gate trades a forgery hole for destroying the app's own combat audit trail — strictly worse than the problem it solved.

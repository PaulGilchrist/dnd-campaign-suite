# App Exploration Map

**KB FIX-VERIFY DESCENT family — 2026-11-14 run OV (post-NP four-commit batch: `7d64885e3` HoUoM merged death-state reset + `24caf7978` resurrection-log-family split + `adb85b54b` HoUoM sheet target-chooser + `d143b337f` GM death-save pre-roll Cancel — ALL FOUR LIVE-VERIFIED PASS at independent descent; NP PT#1 CONSUMED — HoUoM resurrect now commits ONE merged `setRuntimeBatch` POST carrying `currentHitPoints`+`deathSaves[f,f,f]`+`deathFailures[f,f,f]`+`isDead:0` (bucket GET clean after every ride) and the second death renders the counter + working Roll lane (`Hit Points: 0/112` + `.death-saves-roll`, ZERO `.death-saves-dead-badge`) — the bug's DEAD-panel face is DEAD, file in `resolved/`):**

- **HoUoM chooser (`adb85b54b` NP-owed backlog item, first ride):** un-armed press with a bucket-0 board corpse opens the shared picker — dialog `[aria-labelledby="hand-of-ultimate-mercy-target-modal-title"]`, title `Choose corpse for Hand of Ultimate Mercy`, radio aria `Select EvasiveFighter, 0 of 112 HP` (honest pair: M = select-seeded mirror `hitPoints`, bucket-first), buttons `Revive`/`Cancel`. Cancel closes zero-write (GET census: no DM bucket, corpse byte-intact); `Revive` commits the SAME merged contract. Armed targetName keeps the direct lane (press → commit, no chooser) and the armed-living press refuses `EvasiveFighter is not at 0 Hit Points.` with ZERO requests.
- **Log split (`24caf7978`):** every resurrection audit row is now `type:'hp_change'` with `resurrection:true`, positive `delta`, `currentHp`/`maxHp` frame, `isHealing:true` sign-stamp, `sourceName`=caster, `note`=ability, `characterName`=caster (3/3 commits census'd live from POST bodies + log GET).
- **GM Cancel (`d143b337f`, all faces):** pre-roll census `[Roll Death Save, Cancel]`; Cancel = exactly ONE `DELETE deathSavePrompt-<T>` 200, zero counter/HP/isDead writes, zero log rows, modal closes; LAN visitor (`isolatedContext:'lan'` on en0 :5173, header verified test-campaign) sees the SAME modal `[Roll Death Save]` — Cancel gated by `isGmHost()`; GM's Cancel null-echo retires the visitor's dwelled modal live; Cancel ABSENT the moment the result stage renders (`Done` only) and the answered roll still fires the full trio (`POST result → POST log → POST char → DELETE prompt → DELETE result`).
- **PT#2 (reuse envelope) CONSUMED by face:** FOUR consecutive resurrections of re-seeded corpses (focus 20→15→10→5→0), no per-long-rest/once flag anywhere in the lane (focus ladder is the only gate); fifth press reads `Not enough Focus Points. Need 5, have 0.` with zero requests. RAW 24h-corpse/once-per-day envelope vs app-design remains ambiguous → stays in the Blocked ledger, not filed.
- **Thin-bucket law re-lived with a new consequence:** a thin full-store `POST {value:{currentHitPoints:0}}` corpse seed echo-REPLACEs and EVICTS the mirror's `hitPoints`; the resurrect audit row's `maxHp` then falls back to the combat-summary row — and the select-baked `1/1` rows were honestly NOT replaced by party-stats settle all session this run (EF/DM rows sat at 1/1 on the server while mirrors carried the real maxes) → the third commit's row read `maxHp:1`. PT#3 family 8th re-observation, now with an audit-frame consequence (backlog bullet added).
- **OV fixture discipline:** ONE sanctioned surgery, byte-exact restored + live re-proved (DM subclass Open Hand↔Warrior of Mercy, exit md5 `ba4d456c…`; Mercy rows vanish + Open Hand Technique text back after reload+re-select). All 13 char md5s + npcs `db6666c1`/notes `836a3fb6`/sessions `d7517139`/inventory `7638da67`/design-notes `d5e0f95c` + encounters `2356342b`/factions `9ba33154`/quests `5055fb78`/settlements `ac5681f4` canonical at exit; maps never opened; campaigns/ = 5 baseline folders (no throwaways — the four commits touch no seeded/TV/delegation/allies/EB/fog/travel/AI/planner files). Runtime churn (4 HoUoM resurrections + chooser Cancel + 2 refusals, sheet 37→0 second-death, 2 API-armed prompts incl. the Cancel + roll trio legs, DM focus 20→0, ~10 log rows) swept by CLOSED-TAB two-pass clears GET-verified `{}`/`[]`/overlays `[]` (pass 1 clean immediately; re-enter surfaced ONLY the select trio, pass 2 evicted; disk cd/log files absent); fresh-nav console 0 errors; servers killed at exit; `git status --porcelain public/campaigns/` EMPTY. Zero bug files, 1 improvement backlog bullet.

## Historic Descent Headers

<details><summary>NP 2026-11-14 (post-MM four-commit fix-verify batch — negative-heal/inverted-hide/sign-stamp/sheet-revive all LIVE-VERIFIED; first-ever HoUoM ride FILED the isDead-stuck bug that the `7d64885e3` batch fixed and OV re-proved; divergent-dwell determinism law, SSE-liveness pitfall, trio-law sharpening). Full text in git log of this file.</summary>

**NP**: divergent-dwell = full-store thin POST + row PATCH (bucket-`hitPoints`-FIRST law); inverted commit refuses inline zero-requests; HoUoM resurrect kept `isDead:1` → second-death DEAD panel (filed, now resolved/); trio fires on EVERY answered roll; card re-arm resets arrays not `isDead`.

</details>

<details><summary>MM 2026-11-14 (post-Explore four-commit fix-verify batch — HoH-picker-live-echo/labels/death-save-evict/sheet-hp-sourceName all LIVE-VERIFIED; its PT#1 negative-heal spawned by that batch was fixed by `1d6cc8e2c` and NP-verified). Full text in git log.</summary>

**MM**: evict-sweep law (resolve DELETE 200 evicts BOTH mirrors); HoH apply-leg negative-heal bug (resolved/); `Heal self`/`Cancel` zero-spend labels; forensic stamps `sheet editor` vs `GM HP override`.

</details>

<details><summary>LC/KC-era + KB/JA/IZ/GZ/FX/EH/DG/BE/CF/AD..GB descents 2026-11-13/14 (carried, event-clear against the post-LC tail + MM/NP/OV batches — commit name-only sets touch only healing/HoH/SecondaryTargetModal/CharHitPoints/savePromptService/DeathSavePromptModal/handOfUltimateMercy lanes + tests/docs).</summary>

**LC**: death-save lane deep (arm/modal/finality/void/late-join/self-sweep); HiddenInput 5/5. **KB**: pool clamp 65/65 + self-heal. **JA/IZ/GZ/FX/EH/DG/BE/CF**: clamp hints, cure-echo, batch cure, hex POI a11y, music orphan, modal-family Escape, allies row editor, victory stamp, DeleteConfirmModal. **AD..GB**: reject-modal lineage, name-laws, AI matrix, regen envelope, dice glyphs, planner CUD, mount-merge, enforcement/travel/weather/3D/sheet/PFEG/long-rest/AoE/aura laws. Full text in git log.

</details>

## Priority Targets (next descent)

1. **PT#3 HP-side owner ruling (unchanged):** pool lanes clamped, HP badge exempt by design (`CLAMP_EXEMPT_KEYS`) but renders inverted fractions on overshoot (`224/147`). Owner: fold HP into the clamp family or rule honest-by-design and pin the face.
2. **cs-row write-side residual — 8th re-observation OV + NEW consequence:** select-baked `1/1` rows were NOT settle-replaced server-side all session (OV census: EF/DM rows at 1/1 while mirrors held real maxes), and a thin-echo-evicted bucket drives the resurrection audit `maxHp` fallback to the stale `1` (see backlog). §45's "TRANSIENT — settle replaces" wording needs live re-derivation in whatever run next owns the cs lane: is there ANY settle-time row write, or is bucket-canonical the whole story?
3. **HoUoM chooser mid-dwell refusal faces (unit-pinned by `adb85b54b`, live rig unknown):** revive-then-repress a STILL-ARMED picker row mid-dwell (expect inline `<T> is not at 0 Hit Points.` zero-spend) and focus-drain-at-commit refusal. Needs a two-lane rig; deterministic single-tab recipe not yet found.
4. **`24caf7978` parity twins:** revivifyService / revivificationHandler / undyingSentinel / boonOfRecovery rows were census'd by the improve run only as byte-shape siblings of the hp_change family — no live ride of each lane.
5. `DeathSavePromptModal` resolved-id-guard RACE face + nat20 `Restored to 1 HP` live face (unchanged — deterministic rig unknown; both unit-pinned).

## Depth Seeds (live 2026-11-14 OV unless noted)

- **HoUoM chooser + merged-reset + GM Cancel + log split:** all faces in the OV header above; durable selectors folded to playbook §11 (HoUoM bullet). `handOfUltimateMercyHandler.js` (commitResurrection L100, collectCorpseTargets L87), `HandOfUltimateMercyModal.jsx`, `DeathSavePromptModal.jsx` (`isGmHost()` gate L272), `logService` hp_change family.
- **Second-death clean face (`7d64885e3` fix-verify):** sheet `Hit Points:` → 0 commit (HiddenInput native-setter + Enter) on a resurrected creature → `Hit Points: 0/112`, `.death-saves-container` + `.death-saves-roll` render, NO `.death-saves-dead-badge`; the sheet drop also proves the mirror-gated skip (ZERO `deathSavePrompt` DELETE requests).
- **Prompt-arm rig for modal-face testing (re-lived OV):** `POST /api/campaigns/<c>/deathSavePrompt-<T> {value:{promptId,targetName}}` queues into the LIVE-mounted modal via the value echo (no initiative board needed); `DELETE` retires every tab's dwelled copy.
- **Negative-heal fix family / evict-sweep / subclass-swap / sourceName / HiddenInput / pool-clamp / heal-dwell laws:** carried — event-clear (post-NP commits touch no such lanes' files beyond handOfUltimateMercy/DeathSavePromptModal internals, both re-verified above).
- **Throwaway lanes / quick-create / seeded campaigns / TV / delegation / allies / EB / fog / travel / AI / planner / hex-POI / victory / music / modal-family:** carried — event-clear (post-NP four-commit name-only sets: HoUoM/DeathSavePrompt/handler + tests/docs only).

## Coverage

| Feature/Flow | Depth | Notes |
|---|---|---|
| HoUoM: chooser open/Cancel/Revive + armed-direct + armed-living & focus-exhaustion refusals + 4-use envelope + merged 4-key reset + second-death clean face | deep (OV 2026-11-14, post-fix batch; `bug-houm-resurrection-leaves-isdead-stuck` fix-verified → `resolved/`) | `handOfUltimateMercyHandler.js`, `HandOfUltimateMercyModal.jsx`, `SecondaryTargetModal.jsx`, `useCharActionsAutomation.js`, `DeathSavingThrows.jsx` |
| Death-save prompt modal: GM pre-roll Cancel (zero-write void) + visitor census (no Cancel) + cross-tab null-echo retire + result-stage absence + trio per answered roll | deep (OV 2026-11-14 two-tab ride; LC first exhaustive arm/finality ride) | `DeathSavePromptModal.jsx`, `gmHost.js`, `savePromptService.js` |
| Resurrection audit row = hp_change family + `resurrection:true` + sign-stamp | deep (OV 2026-11-14, POST bodies + log GET 3/3 commits) | `logService.js`, `HpChangeEntry` |
| Sheet HP editor: second-death face, revive merged ONE-POST, mirror-gated clear-leg skip | deep (OV re-rode 0-commit; NP fix-verified `db0ad4cf8`) | `CharHitPoints.jsx`, `useRuntimeState.js setRuntimeBatch` |
| cs-row write-side residual (bucket-canonical doctrine) + audit `maxHp` fallback face | 8th re-observation OV 2026-11-14 — row 1/1 NOT settle-replaced all session | `combatSummary` consumers, `resolveTargetMaxHp` |
| HoH picker/gate/APPLY legs incl. divergent-dwell + control + refusals | deep (NP 2026-11-14, post-fix) | `healingHandler.js`, `hpModifier.js`, `liveTargetHp.js` |
| Mass-heal chooser (Prayer of Healing) + delta-0 sign-stamp faces | deep (NP 2026-11-14) | `massHealHandler.js`, `prayerOfHealingService.js` |
| Evict-mirror-gate + ghost-key sweep | deep (MM fix-verified; NP/OV zero-request skips) | `savePromptService.js evictDeathSavePromptMirror` |
| SSE liveness census before echo judgments | pitfall (NP) — OV both tabs connected via locator-click select, cross-tab retire proved | `App.jsx`, `services/ui/sseClient.js` |
| Pool-clamp family, level-surgery rigs, subclass swap recipe, clamp hints, HiddenInput cancel law | carried — event-clear (KB/JA/IZ/LC/MM/NP; NP+OV both re-rode swap+restore) | `useTrackedResource.js`, `HealingPoolModal.jsx`, `HiddenInput.jsx` |
| Seeded quick-create + arena census + wizard-× + API delete ghost / hex POI a11y / victory + stamp / DeleteConfirmModal / music / EB+fog+travel / AI lanes / planner CUD / TV + delegation + allies | carried — event-clear (post-NP commits touch no such files) | per KB/FX/EH/CF/DG/BE/MA/LZ/JV/KW/OP/RS/TE/SD/XA tags |

## Baseline Fingerprints (canonical test-campaign state at OV exit — verified 2026-11-14)

change-data `{}` + log `[]` + overlays `[]` (tab CLOSED before clears; pass 1 clean, re-enter surfaced ONLY the select trio, pass 2 GET-verified, disk cd/log files absent); all 13 char files md5-canonical (DM `ba4d456c…` post-surgery restore live re-proved — Mercy rows gone, Open Hand Technique back); npcs.json `db6666c1`, notes `836a3fb6`, sessions `d7517139`, inventory `7638da67`, design-notes `d5e0f95c`, encounters `2356342b`, factions `9ba33154`, quests `5055fb78`, settlements `ac5681f4`; maps = 4 owner fixtures never opened; campaigns/ = 5 baseline folders (no throwaways); `git status --porcelain public/campaigns/` EMPTY; fresh-nav console 0 errors; dev pair killed at exit, ports dark.

## Improvement Backlog

<!-- Open items only. e2e-explore appends dated bullets here; e2e-improve consumes and REMOVES them. -->

## Blocked / Not Verified (fold-gate ledger)

- HoUoM chooser mid-dwell faces (revived-mid-dwell inline refusal, focus-drain-at-commit, no-corpse `No target at 0 Hit Points.` picker-open refusal) — unit-pinned by `adb85b54b` (handler tests 224 + chooser tests 141 + automation 100 lines); live rig needs concurrent lanes.
- `24caf7978` parity twins (revivify / revivificationHandler / undyingSentinel / boonOfRecovery) — byte-shape siblings of the census'd hp_change family, no live ride this run.
- HoUoM RAW 24h-corpse / once-per-long-rest envelope — four consecutive same-combat uses prove the app gates on Focus ONLY; whether that matches RAW intent is an owner question, do not file blind (PT#2's live face consumed).
- healingRoll zero/negative-delta sign face — post-fix unreachable outside the carried bucket-side race; unit-pinned.
- `3a99fd08a` non-confirming-response face (403/423/5xx keeps the mirror) — live-unreachable without a response-poison rig; unit-pinned.
- Death-save resolved-id-guard RACE face + nat20 `Restored to 1 HP` live face — unit-pinned (carried).
- Designer TRIM-DROPPED live face; Natural-RNG weatherChange dialog; Camp-while-PAUSED leg; POI `enter_refused refusal:'missing'` click face; Fanatical-focus RESET positivity leg; HoH bucket-side race; display-clamp `_trackedResources` producer branch (all carried, unchanged).

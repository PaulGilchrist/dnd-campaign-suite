# App Exploration Map

**KB FIX-VERIFY DESCENT family — 2026-11-14 run NP (post-MM four-commit batch: `1d6cc8e2c` negative-heal fix + `3c369ae84` inverted-fraction hide + `8215d79b1` heal sign-stamp + `db0ad4cf8` sheet-revive merged POST — ALL FOUR LIVE-VERIFIED PASS; MM's PT#1 CONSUMED — the divergent-dwell rig now commits POSITIVE (`60→77`, live-cap 112, `Regained 17 HP`, honest Focus spend) where MM wrote `60→1 / isHealing:true`; first-ever Hand of Ultimate Mercy full ride surfaced 1 NEW BUG: `bug-houm-resurrection-leaves-isdead-stuck.md` (resurrect keeps `isDead:1` + stale `deathFailures` — living 31-HP creature's next real death renders the sheet DEAD panel, no counter/roll lane, until ×-remove/long rest):**

- **Divergent-dwell determinism (NP law, playbook §2 corrected in place):** the picker's M is bucket-`hitPoints`-FIRST (`liveTargetHp.js`), row maxHp only FALLBACK — after a select+settle the mirror carries the real max, so row PATCHes are honestly INVISIBLE (NP double false-negative: first on a stale-SSE tab, then on a fat-mirror tab). Deterministic inverted-pair recipe: full-store `POST /<V> {value:{currentHitPoints:60}}` (thin payload → echo REPLACE evicts mirror `hitPoints`) + row PATCH to 1/1 → picker renders the BARE `Select <Name>` (the `3c369ae84` hide face; MM-era `60 of 1` text is DEAD) → mid-dwell row PATCH above bucket re-anchors to `60 of 112` within one echo (distinguishing form proved).
- **Fix faces (NP):** gate-pass commit heals positively capped at live headroom (control dwell 77→95, +18 ≤ 35, no regression); inverted commit WITHOUT raising refuses inline zero-requests (never drains); full-HP press refusal + Cancel zero-spend re-lived. `8215d79b1`: Prayer-of-Healing chooser (first ride: spell row → details popup → `Cast Spell` → `.sp-overlay` unlabeled-by-default checkboxes → `Heal (3)`) produced 1 positive `isHealing:true` + TWO delta-0 over-log rows now honestly `isHealing:false`; GM `hp_change -60` row reads `false` (damage lane untouched).
- **Sheet-revive law (`db0ad4cf8` NP):** `Hit Points:` >0 commit = exactly ONE `POST /<Char>` carrying `currentHitPoints`+`deathSaves`+`deathFailures`+`isDead:0` (+ mirror `hitPoints`), death-keys-verified via a genuinely-armed prompt (roll→Done, one failure) then revive 0→40: 1 char POST + 1 log POST, all four keys reset, prompt clear-leg honest ZERO (mirror-gated skip — prompt had already been swept by the roll trio). Trio law sharpened: `POST result → DELETE prompt → DELETE result` fires on EVERY answered roll, not only finality; GM-card re-arm resets the counter ARRAYS (stale [t,t,t] → fresh roll [t,f,f]) but NOT `isDead` (the HoUoM bug's second-death door).
- **HoUoM lane (NP first ride):** refusals honest zero-spend (`Select a target in combat first.` / `<T> is not at 0 Hit Points.` — bucket-read gate); corpse commit = popup `Returns to life with 31 HP. Expended 5 Focus Points.`, single char POST (mirror body proves the write-set omits the death keys), audit row `type:'healing' resurrection:true` (log-family outlier); DEAD-badge-on-second-death face live-witnessed (sheet census: `Hit Points: 0/112` + `.death-saves-dead-badge`, zero roll controls) — FILED.
- **SSE liveness pitfall (playbook §16 new):** a re-selected tab can hydrate fully yet have NO current-page campaign EventSource (evaluate-dispatched select landed without subscribe; locator click re-established) — echoes then land server-side (curl `--max-time` probe) while the tab reads inert; census `filter:'subscribe'` before judging any echo rider.
- **NP fixture discipline:** ONE sanctioned surgery, byte-exact restored + live re-proved (DM subclass Open Hand↔Warrior of Mercy, exit md5 `ba4d456c…`; Mercy rows vanish + Open Hand Technique back after reload+re-select). All 13 char md5s + npcs `db6666c1`/notes `836a3fb6`/sessions `d7517139`/inventory `7638da67`/design-notes `d5e0f95c` canonical at exit; maps never opened; campaigns/ = 5 baseline folders (no throwaways — the four commits touch no seeded/TV/delegation/allies/EB/fog/travel/AI/planner files, `git show --name-only` ×4). Runtime churn (EF buckets incl. a synthesized corpse + second-death arm, DM focus 20→13, 3 HoH uses, 1 HoUoM, 1 Prayer heal, hand-forced cs rows, death-save arm/roll pair, ~15 log rows) swept by CLOSED-TAB two-pass clears GET-verified `{}`/`[]`/overlays `[]` (pass 1 clean immediately; re-enter surfaced ONLY the select trio, pass 2 evicted; disk cd/log files absent). Servers killed at exit; `git status --porcelain public/campaigns/` EMPTY. 1 bug file.

## Historic Descent Headers

<details><summary>MM 2026-11-14 (post-Explore four-commit fix-verify batch — HoH-picker-live-echo/labels/death-save-evict/sheet-hp-sourceName all LIVE-VERIFIED; its PT#1 negative-heal spawned by that batch was fixed by `1d6cc8e2c` and NP-verified this run; its evict-sweep/subclass-swap/sourceName laws re-lived consistent under NP's rides).</summary>

**MM**: evict-sweep law (resolve DELETE 200 evicts BOTH mirrors; refused/404 never evict); HoH echo+gate PASS but apply-leg spawned `bug-hoh-negative-heal-stale-snapshot-clamp.md` (now resolved/); `Heal self`/`Cancel` zero-spend labels; `sheet editor` vs `GM HP override` forensic stamps; AasimarTest mystery `sheet editor` row (watch list, swept). Full text in git log of this file.

</details>

<details><summary>LC/KC-era + KB/JA/IZ/GZ/FX/EH/DG/BE/CF/AD..GB descents 2026-11-13/14 (carried, event-clear against the post-LC tail + MM batch + NP batch — commit name-only sets touch only healing/HoH/SecondaryTargetModal/CharHitPoints/savePromptService + tests/docs).</summary>

**LC**: death-save lane deep (arm/modal/finality/void/late-join/self-sweep); HiddenInput 5/5; HoH echo+mount-only-autocure PASS. **KB**: pool clamp 65/65 + self-heal; HiddenInput bug (fixed). **JA/IZ/GZ/FX/EH/DG/BE/CF**: clamp hints, cure-echo, stale-closure, batch cure, hex POI a11y, music orphan, modal-family Escape, allies row editor, victory stamp, DeleteConfirmModal. **AD..GB**: reject-modal lineage, name-laws, AI matrix, regen envelope, dice glyphs, planner CUD, mount-merge, enforcement/travel/weather/3D/sheet/PFEG/long-rest/AoE/aura laws. Full text in git log.

</details>

## Priority Targets (next descent)

1. **FIX-VERIFY `bug-houm-resurrection-leaves-isdead-stuck.md`** when a fix lands: rig = sanctioned Mercy swap → thin-bucket corpse state (`POST /EvasiveFighter {value:{currentHitPoints:0,isDead:1,deathSaves:[f,f,f],deathFailures:[t,t,t]}}` — byte-identical to real finality) → arm DM `targetName` via scoped cs PATCH → press `Hand of Ultimate Mercy:` → expect bucket returns to life CLEAN (`isDead:0`, counters empty) in ONE merged POST; re-live the second-death face (card >0→0 → sheet shows counter+roll lane, NOT the DEAD badge). No fix yet → the bug stays open, do not repair it yourself.
2. **HoUoM reuse-envelope probe** (NP-adjacent): no per-long-rest/once flag observed (5 Focus was the only cost census'd); press a SECOND HoUoM on a fresh corpse after a long-rest lane reset — if unlimited-by-design vs RAW-gated is ambiguous, record in Blocked rather than filing.
3. HP-side owner ruling (was LC PT#2/MM PT#2, unchanged): pool lanes clamped, HP badge exempt by design (`CLAMP_EXEMPT_KEYS`) but renders inverted fractions on overshoot (`224/147`). Owner: fold HP into the clamp family or rule honest-by-design and pin the face.
4. cs-row write-side residual (PT#3 family, 7th re-observation NP): EF cs row sat at the harness-PATCHed 60/112 through two real HoH heals + a Prayer heal while its bucket rode 60→95 (heal lane never writes rows, liveTargetHp.js header doctrine) — cosmetic honesty face of the bucket-canonical decision.
5. `DeathSavePromptModal` resolved-id-guard RACE face + nat20 `Restored to 1 HP` live face (unchanged — deterministic rig unknown; both unit-pinned).

## Depth Seeds (live 2026-11-14 NP unless noted)

- **Negative-heal fix family (`1d6cc8e2c`/`3c369ae84`/`8215d79b1`/`db0ad4cf8`):** all fix faces listed in the NP header above; durable recipes in playbook §2/§11. `src/services/automation/handlers/healing/healingHandler.js`, `shared/hpModifier.js` `clampHpLadder`, `liveTargetHp.js`, `char-sheet/modals/shared/SecondaryTargetModal.jsx`, `char-sheet/char-summary/CharHitPoints.jsx`, massHeal/prayer/healingRoll writers.
- **HoUoM lane:** `handOfUltimateMercyHandler.js` (L25 bucket gate, L32 sole HP write), refusals zero-spend popups, commit = focus ladder + `hp_change|resurrection:true` row (post-split, 2026-11-14 improve resurrection-log-family-split — was the `healing` family outlier); BUG FIXED in place (isDead residue → second-death DEAD panel, `7d64885e3`).
- **Death-save seam trio law (NP sharpen):** `POST deathSaveResult-<N> → DELETE deathSavePrompt-<N> → DELETE deathSaveResult-<N>` fires on EVERY answered roll (non-final included); sheet-revive clear-leg mirror-gate skip re-lived; card re-arm resets counter arrays but not `isDead`.
- **Prayer-of-healing chooser:** spell `td.spell-name` click → `.popup-modal` details + `Cast Spell` → `.sp-overlay` chooser (13 label-matched checkboxes, dynamic `Heal (N)` confirm, `Skip`) → per-member `hp_change sourceName:<caster>` rows; 2024 War_Cleric L8 holds it as a Level-2 spell straight from the sheet spells table.
- **Evict-sweep/subclass-swap/sourceName/HiddenInput/pool-clamp/heal-dwell laws (MM/LC/KB/JA/IZ):** carried — event-clear (post-MM commits touch none of those lanes' files beyond healingHandler/hpModifier internals re-verified above).
- **Throwaway lanes / quick-create / seeded campaigns / TV / delegation / allies / EB / fog / travel / AI / planner / hex-POI / victory / music / modal-family:** carried — event-clear (`git show --name-only` on the four post-MM commits: heal-family + CharHitPoints + tests/docs only).

## Coverage

| Feature/Flow | Depth | Notes |
|---|---|---|
| HoH picker/gate/APPLY legs incl. divergent-dwell fix-verify + control + full-HP/Cancel/inverted refusals | deep (NP 2026-11-14, post-fix; MM/KG-era faces re-lived) | `healingHandler.js`, `hpModifier.js`, `liveTargetHp.js`, `SecondaryTargetModal.jsx` |
| Hand of Ultimate Mercy lane (2 refusals + corpse commit + isDead residual + second-death panel) | deep (NP 2026-11-14 first ride) — BUG FILED `bug-houm-resurrection-leaves-isdead-stuck.md` | `handOfUltimateMercyHandler.js`, `DeathSavingThrows.jsx`, `useCharActionsAutomation.js` |
| Sheet HP editor: `sheet editor` stamp, revive merged ONE-POST 4-key reset, valuesEqual self-skip | deep (NP 2026-11-14, `db0ad4cf8` fix-verified) | `CharHitPoints.jsx`, `useRuntimeState.js setRuntimeBatch` |
| Death-save arm/roll/modal seams (trio per answered roll, re-arm array reset, mirror-gate skip) | deep (NP re-rode 2 arms/2 rolls; LC first exhaustive ride) | `createCreatureHandlers.js`, `DeathSavePromptModal.jsx`, `savePromptService.js` |
| Mass-heal chooser (Prayer of Healing) + delta-0 sign-stamp faces | deep (NP 2026-11-14, `8215d79b1` live; §44 improve-run faces pre-date) | `massHealHandler.js`, `prayerOfHealingService.js`, chooser UI in `char-sheet` spell lane |
| Evict-mirror-gate + ghost-key sweep | deep (MM fix-verified; NP re-lived the zero-request skip live) | `savePromptService.js evictDeathSavePromptMirror` |
| SSE liveness census before echo judgments (evaluate-select can land unconnected) | NEW pitfall (NP) — playbook §16 | `App.jsx`, `services/ui/sseClient.js` |
| Pool-clamp family, level-surgery rigs, subclass swap recipe, clamp hints, HiddenInput cancel law | carried — event-clear (KB/JA/IZ/LC/MM; MM+NP both re-rode swap+restore) | `useTrackedResource.js`, `HealingPoolModal.jsx`, `HiddenInput.jsx` |
| cs-row write-side residual (bucket-canonical doctrine) | 7th re-observation NP 2026-11-14 | `combatSummary` consumers |
| Seeded quick-create + arena census + wizard-× + API delete ghost / hex POI a11y / victory + stamp / DeleteConfirmModal / music / EB+fog+travel / AI lanes / planner CUD / TV + delegation + allies | carried — event-clear (post-MM + NP batches touch no such files) | per KB/FX/EH/CF/DG/BE/MA/LZ/JV/KW/OP/RS/TE/SD/XA tags |

## Baseline Fingerprints (canonical test-campaign state at NP exit — verified 2026-11-14)

change-data `{}` + log `[]` + overlays `[]` (tab CLOSED before clears; pass 1 clean, re-enter surfaced ONLY the select trio, pass 2 GET-verified, disk cd/log files absent); all 13 char files md5-canonical (DM `ba4d456c…` post-surgery restore live re-proved — Mercy rows gone, Open Hand Technique back); npcs.json `db6666c1`, notes `836a3fb6`, sessions `d7517139`, inventory `7638da67`, design-notes `d5e0f95c`; maps = 4 owner fixtures never opened; campaigns/ = 5 baseline folders (no throwaways); `git status --porcelain public/campaigns/` EMPTY; console: harness artifacts only (two of my own wrapper-closure `ReferenceError`s — playbook §41 law, not app faults); dev pair killed at exit, ports dark.

## Improvement Backlog

<!-- Open items only. e2e-explore appends dated bullets here; e2e-improve consumes and REMOVES them. -->

- **2026-11-14 NP — HoUoM has no in-sheet target chooser:** the sheet row refuses with `Select a target in combat first.` and forces a detour to Initiative to arm `targetName`, while the adjacent `Hand of Healing:` opens the shared `SecondaryTargetModal`. Suggest reusing the chooser filtered to board targets whose bucket HP is 0 (fall back to honoring an armed target). Files: `useCharActionsAutomation.js`, `SecondaryTargetModal.jsx`.
- **2026-11-14 NP — DeathSavePromptModal offers no dismiss for accidental arms:** button census is [Roll Death Save] (pre-roll) — a GM card mistype to 0 can only be exited by actually pressing Roll (or the documented restore-then-Roll void-guard dance); a GM-only Cancel riding the existing zero-write void lane would close the friction. Files: `DeathSavePromptModal.jsx`, `savePromptService.js` clear lane.

## Blocked / Not Verified (fold-gate ledger)

- healingRoll zero/negative-delta sign face — post-fix unreachable outside the already-carried bucket-side race; unit-pinned (and §44's improve-run lived the face pre-fix).
- HoUoM 24h-corpse / once-per-long-rest RAW envelope — no gate observed in the lane's code paths NP read; testing a second consecutive use (fresh corpse) deferred to PT#2; expectation RAW-vs-app-design ambiguous, do not file blind.
- Mass Cure Wounds / remaining massHeal twins — only the Prayer of Healing chooser was ridden; twins are byte-shape siblings of the sign-stamped family.
- `3a99fd08a` non-confirming-response face (403/423/5xx keeps the mirror) — live-unreachable without a response-poison rig; unit-pinned.
- Death-save resolved-id-guard RACE face + nat20 `Restored to 1 HP` live face — unit-pinned (carried).
- Designer TRIM-DROPPED live face; Natural-RNG weatherChange dialog; Camp-while-PAUSED leg; POI `enter_refused refusal:'missing'` click face; Fanatical-focus RESET positivity leg; HoH bucket-side race; display-clamp `_trackedResources` producer branch (all carried, unchanged).

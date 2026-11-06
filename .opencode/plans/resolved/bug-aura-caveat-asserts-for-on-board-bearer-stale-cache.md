# Bug: "assumed co-present (no token)" aura caveat can lie for a bearer who IS on the combat board — the board-member guard reads a load-time cache that sheet-lane tabs never refresh

## Summary
The new save-prompt aura caveat (improve 8b2dd5c78) is meant to appear ONLY for phantom bearers — no token on the active map AND not a combat-board member. Live, the board-member exemption failed on a character-sheet-lane tab: ElderPaladin was confirmed present in `combatSummary.creatures` server-side, yet the prompt tooltip still asserted "assumed co-present (no token)". The guard consumes `getCombatSummary(campaignName)` → `cachedCombatSummaries` (combatData.js), a module cache whose SSE refresh lives in `src/components/initiative/sseHandlers.js`; a tab that selects the campaign and sits on sheets never refreshes it after boot, so mid-session board membership is invisible to the aura guard.

## Steps to reproduce
Starting state: `test-campaign`, fresh tab on localhost:5173, campaign selected, stay on the character-sheet view (do NOT open the Initiative view — that mount refreshes the cache).
1. API (or a second GM tab): create a board containing `ElderPaladin` — full-store `POST /api/campaigns/test-campaign/combatSummary` `{value:{creatures:[{name:'ElderPaladin',type:'player',initiative:8,ac:19}, …], round:1}}`. GET confirms EP in `creatures`.
2. Activate a map EP has no token on: `POST /__map__ {value:{activeMapName:'poi-showcase'}}` (poi-showcase has empty `players[]`/`placedItems[]`).
3. Wait 8+ seconds (client-side SSE settle).
4. Inject a save prompt: `POST /api/campaigns/test-campaign/savePrompt-EvasiveFighter-<pid>` `{value:{promptId:'<pid>',targetName:'EvasiveFighter',saveType:'CON',saveDc:12,sourceName:'Probe',dcSuccess:'none'}}`.
5. Read the prompt's aura badge tooltip (`[class*=badge]` with title containing "Aura"), pre-roll AND after clicking Roll Save.

## Expected behavior
No caveat: `isBearerAssumedCoPresent` short-circuits `false` for combat-board members (`allCreatures.some(c => c?.name === bearerName)`), so the tooltip should read plain "Aura of Protection from ElderPaladin".

## Actual behavior
Tooltip shows "Aura of Protection from ElderPaladin — assumed co-present (no token)" on BOTH the pre-roll breakdown and the post-roll result breakdown, with EP verifiably on the server board and >8 s settle. Observed live 2026-11-06 run DB (prompt ids db-aurB-1, db-aurB2, plus the roll-time face). Console stayed clean.

## Likely location
Confident (code read + live repro):
- `src/services/encounters/combatData.js` `getCombatSummary` reads `cachedCombatSummaries` (a module-level Map) — populated only by `loadCombatSummary`/`setCombatSummaryCache` call-sites.
- The SSE live-refresh of that Map lives in `src/components/initiative/sseHandlers.js` (Initiative-view subscription). A sheet-lane tab receives the runtime-store update (UI shows the board) but the combatData cache stays at its boot-time value.
- Consumers: `src/components/common/SavePromptModal.jsx:293/:405` pass `allCreatures: getCombatSummary(campaignName)?.creatures` → `auraOfProtection.js` board-member guard is evaluated against stale data.
The same staleness window predates 8b2dd5c78 for every `getCombatSummary` reader; this improve merely made it user-visible via a wrong caveat.

## Suggested fix
Make the caveat fail closed against uncertainty: in `isBearerAssumedCoPresent`, if the board-member check cannot be trusted, suppress the caveat rather than assert it. Options: (a) refresh the cache in the aura lane — `await loadCombatSummary(campaignName)` (or a fresh change-data GET) inside `isBearerAssumedCoPresent` before consulting `allCreatures`; (b) move the SSE `setCombatSummaryCache` refresh out of the initiative-only subscription into the shared runtime/SSE client so every tab's cache tracks board writes. (a) is the smaller, prompt-scoped change. Investigation: confirm which of the two call-sites (pre-roll hook vs roll-time compute) rendered each tooltip face, and whether unit ledgers (`SavePromptModal.pre-roll-bonus.test.jsx`, `auraOfProtection.test.js`) mock `getCombatSummary` to always-fresh (they passed — the gap is cache freshness, not logic).

## Severity
Minor UX issue — display-honesty only. The bonus value is unchanged and gating is untouched; impact is a misleading parenthetical that can disparage a legitimately present ally's aura. Narrow lanes (phantom doctrine + cache-stale tabs), but the caveat's entire purpose is honesty, so a lying caveat defeats the feature.

## Resolution
FIXED 2026-11-06. Diagnosis confirmed exactly as filed: `cachedCombatSummaries` (combatData.js) is refreshed only by the Initiative view's own `Subscriber`/`createSseEventHandler` lane (`setCombatSummaryCache` call-sites in `initiative/sseHandlers.js` + the `Initiative.jsx:247` effect), while every tab's shared `change-<campaign>-<key>` lane (App.jsx `handleChangeKeyEvent`) mirrored the `combatSummary` echo into the runtime store only — never into the module cache. A sheet-lane tab therefore evaluated the board-member guard (`isBearerAssumedCoPresent` → `allCreatures.some(...)`) against its boot-time snapshot. The suggested option (b) was taken, at the smallest seam: App.jsx's shared handler now adopts board echoes into the cache for every lane.

**Change (`src/App.jsx`):** new module-level helper `syncCombatSummaryCache(storeKey, data, campaignName)` called from `handleChangeKeyEvent` immediately after `storeKey` is computed. Semantics mirror the Initiative lane's guard precedent (`handleCombatSummaryChange`): object echo carrying `creatures` → `setCombatSummaryCache(data, campaign)`; `null` cleared-key echo → evict; non-board payloads left untouched. Memory-only (skipSync law — echoes are never re-POSTed). Extracted as a helper because the inline branches pushed `handleChangeKeyEvent` to complexity 16 (ceiling 15, zero-warning lint). On Initiative tabs the root `Subscriber` subscribes before the view's, so the Initiative handler's merged/processed write still overwrites afterwards — that lane is behaviour-unchanged. No change needed in `auraOfProtection.js` itself (the guard logic was honest; its input was stale) and nothing ruleset-specific (the lane is ruleset-shared, 5e and 2024 prompts ride the same cache). Option (a) (per-prompt `await loadCombatSummary` in the aura lane) was rejected: one network fetch per prompt only for one consumer, while the same staleness window lies under EVERY `getCombatSummary` reader on non-Initiative tabs.

**Regression test (new, co-located):** `src/App.combat-summary-cache.test.jsx` — renders App on the sheet lane with the shared App-test harness (Initiative mocked out, captured Subscriber handler), pins all four faces: board echo adopted (Face B write verbatim) + runtime bucket REPLACE preserved, null echo evicts, `{action:'clear'}`-style echo ignored, foreign-campaign echo ignored. `npx vitest run src/App.combat-summary-cache.test.jsx` → 4/4. Touched-area run (7 `App.*` files + `auraOfProtection.test.js` + `SavePromptModal.pre-roll-bonus.test.jsx`) → 120/120. `npm run lint` → 0 errors 0 warnings. `node .opencode/plans/no-timers-guard.mjs` → OK.

**Live re-verification (test-campaign, :5173, sheet-only tab throughout, poi-showcase active with zero positioned tokens):**
- Bug repro pre-fix: booted with a 2-creature board (no EP), mid-session full-store POST added `ElderPaladin` (GET-confirmed on server board), 4 s settle, injected `savePrompt-EvasiveFighter-fixaur-b1` → tooltip "Aura of Protection from ElderPaladin — assumed co-present (no token)" on BOTH the pre-roll badge and the post-roll breakdown badge — bug confirmed live.
- Face B post-fix (`fixfb-1`): same rig, code reloaded → plain "Aura of Protection from ElderPaladin" pre-roll AND post-roll, bonus intact (+5; breakdown CON +6 +5 = +11, roll line "d20 (12) + 11 (+5 aura from ElderPaladin)", SAVE SUCCESS 23 vs DC 12), prompt drained to Done, zero stranded overlays.
- Face A phantom control post-fix (`fixfa-1`): EP NOT on the board, no token → caveat STILL renders pre- and post-roll ("— assumed co-present (no token)", SAVE SUCCESS 30 vs DC 12) — the fix does not blanket-suppress the caveat.
- Adjacent-lane sanity: Initiative view renders the full 3-creature server board (incl. EP) on the same tab after the shared-lane change; console 0 errors / 0 warnings across the whole session.
- Cleanup: tab closed, two-pass `admin/clear-change-data` + `admin/clear-log` via API, GET-verified `change-data {}` + `log []` with no rehydration; only `src/App.jsx` (modified) and the new test file remain in the tree.

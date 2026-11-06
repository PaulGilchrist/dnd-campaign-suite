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

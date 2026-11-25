# bug: lastAttack not registered as a CAMPAIGN_KEY — Clear from any non-attacking client loses victory-celebration evidence (banner silently suppressed)

## Summary
`lastAttack` is written campaign-level (`setRuntimeValue('campaign','lastAttack',…)`) and read campaign-level by many consumers (victory-clear `attackEvidence`, Stunning Strike target attribution, save-prompt origin, monster split/reaction resolvers), but it is MISSING from `CAMPAIGN_KEYS` in `src/services/automation/common/campaignKeys.js`. On every already-mounted client that did not itself write the key, the SSE echo `change-<campaign>-lastAttack` fails `isCampaignKey` in `applyStoreUpdate` and is dispatched to a ghost CHARACTER store named `lastAttack` — the campaign store mirror stays `null` until a reload. Confirmed live 2026-11-24: the victory banner (and any campaign-store `lastAttack` read) silently loses its evidence on a second mounted tab. This is the EXACT same misroute family already fixed for `lastCombatResult` (`bug-victory-stamp-not-sse-adopted-missing-campaign-key`, resolved) and enumerated for `pendingStarryChaliceHeal` / `pendingOAs` / `gmCopilot` / `soundOwner` in the campaignKeys.js comments — the sibling audit simply missed `lastAttack`.

## Steps to reproduce
Starting state: `test-campaign`, change-data clean (`{}`), two GM (localhost) tabs on `http://localhost:5173` in the same campaign, plus optionally a LAN tab.

1. Tab A: enter test-campaign, open **Initiative** and LEAVE IT MOUNTED.
2. Tab B: enter test-campaign, open **Encounters** → type `Goblin` → tick `Select Goblin` → **Join Encounter** (real 7/7 HP goblin joins; both mounted tabs fan-out the 16-card board).
3. Tab B: open character **FixtureFighter5e**, set the goblin as target (GM card HP thin to 1 optional), press the **Longsword** attack row → the popup now shows a `Swing 1 of 2` face (5e extra-attack lane live) → HIT → **Done** on the staged-damage face (`5 damage applied to Goblin — HP: 1 → 0`).
4. Tab A (mounted Initiative the whole time): click **Clear** → **Yes, Clear Board**.
5. Observe Tab A and every other mounted client: **no victory banner renders**. `GET /api/campaigns/test-campaign/change-data` shows `lastCombatResult` stamped `{foes:1, defeated:1, celebrated:false, attackEvidence:null}` even though `lastAttack` at the top of the SAME change-data doc is a fresh FixtureFighter5e→Goblin HIT row.
6. Control: on Tab B (the tab that made the attack), switch to Initiative and Clear again → the stamp flips to `celebrated:true` and a Victory banner renders live. Same key, same server — only difference is which client's campaign store held `lastAttack`.

## Expected behavior
Per the sibling bug's doctrine (campaignKeys.js comment): a campaign-level key written via `setRuntimeValue('campaign', …)` must be adopted LIVE by every mounted client via the SSE echo. Tab A's Clear should read the fresh `lastAttack`, bank it as `attackEvidence`, stamp `celebrated:true`, and every client — including the mounted tracker/TV tab — should show the victory banner. (Also relevant: delegated-visitor kills — a LAN visitor rolling a controlled monster's attack writes `lastAttack` only in the VISITOR's store, so a GM clearing on a mounted tracker tab hits the same silent-celebration loss.)

## Actual behavior
Tab A's Clear stamped `celebrated:false / attackEvidence:null` (verbatim GET: `{"stamp":1795575952758,"rounds":1,"foes":1,"defeated":1,"survivors":15,"partySize":15,"wipe":false,"celebrated":false,"attackEvidence":null}`) while the server `lastAttack` key carried the fresh HIT. No banner appeared in Tab A, Tab B (mounted Initiative had been unmounted there), or the LAN visitor tab. Zero console errors, zero failed requests — a fully silent presentation loss. The ghost-store landing was not directly observable from the DOM (module-private `stores` Map), but the write/read lanes + the resolved sibling's documented mechanism match exactly.

## Likely location
Confident: `src/services/automation/common/campaignKeys.js` — `CAMPAIGN_KEYS` set contains `lastCombatResult`, `pendingOAs`, `gmCopilot`, `soundOwner`, … but NOT `lastAttack`. Consumers that then read a per-client-null value: `src/components/initiative/createCreatureHandlers.js` (`confirmClear` → `attackEvidence` bank, ~line 310-320) plus at least 10 `getRuntimeValue('campaign','lastAttack')` readers (CharSheet.handlers.js, SavePromptModal.jsx, useCharActionsAutomation.js, MonsterCardModal.jsx:2082, …). Echo misroute mechanism: `applyStoreUpdate` in `src/App.jsx` (~line 113) — the exact branch the `bug-victory-stamp-not-sse-adopted-missing-campaign-key` comment describes.

## Suggested fix
Add `'lastAttack'` to `CAMPAIGN_KEYS` with a one-line comment citing the family precedent. Then verify: (a) mounted tab's Clear celebrates after a remote tab's attack (expect `celebrated:true` + banner + banked `attackEvidence`); (b) null-echo eviction still behaves (the key DELETE/clear path); (c) the other campaign-level `lastAttack` readers live-follow across tabs (e.g. Stunning Strike target attribution armed on tab B witnessed on tab A). Add a unit pin mirroring whatever pinned the lastCombatResult registration (`campaignKeys` / App.runtime-events family). Also audit the registry once more for OTHER campaign-level-written keys missing membership while at it (e.g. grep producers `setRuntimeValue('campaign',` and diff against the set).

## Severity
Broken feature (narrow blast radius). The celebration/banner lane is presentation-only by design, but it SILENTLY fails in the routine two-tab GM workflow (sheet tab attacks, tracker/TV tab clears) and after any delegated-visitor kill — with zero console/network feedback. No data-integrity risk: the board bookkeeping itself was correct.

# Bug: Victory banner never adopts live on other clients — `lastCombatResult` missing from `CAMPAIGN_KEYS`, so its SSE echo misroutes

**Filed:** 2026-11-02 (descent run BF, test-campaign two-tab GM+LAN)

## Summary

The victory banner's shared stamp `lastCombatResult` is written campaign-level and read campaign-level, but the key is not registered in `CAMPAIGN_KEYS` (`src/services/automation/common/campaignKeys.js`). The live SSE dispatch (`App.jsx handleChangeKeyEvent → applyStoreUpdate`) filters echoes through `isCampaignKey`, so the echo is misrouted into a ghost *character* store named `lastCombatResult` instead of the `campaign` bucket. Every already-mounted client therefore never shows the banner — violating the shipped contract "Shown by every client at the combat-clear seam" (VictoryBanner.jsx:2). Only a reload adopts (the reload hydration `seedCampaignRuntimeData` copies ALL top-level keys unfiltered).

## Steps to reproduce

1. test-campaign (or any campaign), two browser tabs. Tab A on localhost (GM), Tab B from the LAN IP (or any second tab), both joined to the campaign.
2. Tab A, Initiative: EB-join one Goblin; set its HP to 0 (card HP input → 0 + Enter).
3. Tab A: click **Clear** (accept the confirm) — stamps `lastCombatResult` at the combat-clear seam.
   - Tab A shows the banner ("Victory! | The party survived 1 round! | All 1 foes defeated | 13 of 13 heroes standing"). **Tab B shows nothing** — poll 60s+, zero console errors. Tab B HAS adopted the cleared combatSummary (0 NPC cards), proving its SSE lane is healthy.
4. Deterministic second leg (no GM Clear needed): on Tab B (Initiative mounted), first dismiss any banner, then `POST /api/campaigns/<c>/lastCombatResult {"value":{"stamp":<fresh>,"rounds":2,"foes":3,"defeated":2,"survivors":12,"partySize":13,"wipe":false}}` → 200, server stores it, `change-<c>-lastCombatResult` publishes — Tab B still shows NO banner.
5. Reload Tab B, re-select the campaign → banner appears **immediately with the same stamp**. Asymmetry proven live.

## Expected behavior

Per VictoryBanner's own contract ("Shown by every client … until dismissed") and the TV living-room doctrine, any client with the Initiative view mounted should adopt the stamp over SSE within the normal ~1-2.5s latency and display the banner.

## Actual behavior

Live-mounted clients never adopt: `useRuntimeValue('campaign','lastCombatResult')` stays null. No console errors anywhere (silent skip). Adoption only via the reload-hydration path.

## Likely location

Confident (statically deterministic + live asymmetry):
- `src/App.jsx handleChangeKeyEvent()` (~line 131): non-object/null payloads only mirror when `isCampaignKey(storeKey)`; object payloads fall to `applyStoreUpdate(storeKey,…)` where `isCampaignKey('lastCombatResult') === false` → `setRuntimeObject('lastCombatResult', data, campaign, true)` — a phantom character store.
- `src/services/automation/common/campaignKeys.js CAMPAIGN_KEYS`: contains music/enforcement/sessionState/aiConfig… but NOT `lastCombatResult`.
- Contrast: `seedCampaignRuntimeData` (App.jsx ~221) hydrates every top-level key unfiltered — the reload path that DOES work.
- Sibling keys with the same write/read shape and also absent from the registry (scan finding, live-repro NOT run): `pendingStarryChaliceHeal` (postCastHealService — cross-device consumption would silently miss the handoff), `gameMode` (writers found, .jsx consumers grep-zero). `combatSummary`/`lastAttack`/`activeCreatureName` have their own dedicated/live lanes (cs cleared-board adoption verified live this run on the same LAN tab).

## Suggested fix

One-line: add `'lastCombatResult'` to `CAMPAIGN_KEYS` (all producers already write with `characterKey='campaign'`, so the guard warnings in get/setRuntimeValue stay silent). Then re-check the two sibling candidates: add `pendingStarryChaliceHeal` if its consumer genuinely needs cross-device adoption (its null-clear would then also mirror correctly), and delete/quarantine `gameMode` if truly unconsumed. A cheap regression test: fire `change-<c>-lastCombatResult` through `handleChangeKeyEvent` and assert `getStore('campaign').get('lastCombatResult')` is stamped and no ghost store 'lastCombatResult' is touched.

## Severity

Broken feature (non-blocking data-wise) — the cross-client victory/TV celebration silently no-ops on every already-open tab, which is the banner's entire purpose; recovery is a reload. No game state affected ("UI presentation only — no game rule reads this key").

## Resolution

**FIXED 2026-11-02** (fix run, test-campaign two-tab localhost-GM + LAN-IP visitor).

### What was actually wrong

The filed diagnosis was **confirmed verbatim** — no correction needed. `lastCombatResult` was absent from `CAMPAIGN_KEYS` (`src/services/automation/common/campaignKeys.js`). Its producer (`createCreatureHandlers.handleClear`) and reader (`useTvPresentation`) both use `characterKey='campaign'`, but the live SSE dispatch decides the destination tier purely from `isCampaignKey(storeKey)` (`App.jsx applyStoreUpdate:112`). The stamp is an **object**, so it skipped the null/scalar arm (`App.jsx:135-148`, which also guards on `isCampaignKey`) and fell to `applyStoreUpdate → else → setRuntimeObject('lastCombatResult', data, campaign, true)` — a ghost *character* store whose keys are `stamp/rounds/foes/…`, invisible to the `useRuntimeValue('campaign','lastCombatResult')` reader. Reload worked only because `seedCampaignRuntimeData` copies every top-level key unfiltered. Zero console errors on the misroute — a silent skip, exactly as filed.

Live pre-fix proof (two tabs, both mounted on Initiative, `location.host` asserted per probe):

| leg | GM tab (localhost:5173) | LAN tab (192.168.0.224:5173) |
|---|---|---|
| EB-join Goblin → card HP 0 + Enter → **Clear** (confirm accepted) | banner "Victory! \| The party survived 1 round! \| All 1 foes defeated \| 13 of 13 heroes standing" | **no banner** across 4 polls / ~10 s, while its board DID adopt the clear (14→13 cards, Goblin gone ⇒ SSE lane healthy) |
| control: `POST /lastCombatResult {stamp:1799999000001, rounds:2, foes:3, defeated:2, …}` → 200, stored, published | — | **still no banner** |
| reload LAN tab → re-select campaign | — | banner appears **immediately** with the same API stamp ("… survived 2 rounds! \| 2 foes defeated · 1 drove off \| 12 of 13 heroes standing") — asymmetry proven |

### What changed

- `src/services/automation/common/campaignKeys.js` — registered `'lastCombatResult'` in `CAMPAIGN_KEYS` (one key + bug-anchored comment). All producers already write `characterKey='campaign'`, so the `get/setRuntimeValue` wrong-tier guard warnings stay silent (verified: 0 console errors post-fix).
- `src/services/automation/common/campaignKeys.victory-stamp.test.js` — **new** co-located registry pin (registration + a look-alike key must NOT pass, so a future rename can't hide the misroute behind a green test).
- `src/App.runtime-events.test.jsx` — **2 new dispatch tests** in the existing SSE rig (re-used rather than duplicating its mock harness): the object echo mirrors into the campaign store + `notify('campaign')` + zero writes to (and no creation of) a store named `lastCombatResult`; and a null cleared-key echo REMOVES the key (declared default wins, never a stored null).

No rules/producer/consumer changes: `VictoryBanner`/`useTvPresentation`/`handleClear` are byte-unchanged. The registry is ruleset-agnostic (single shared `campaignKeys.js`, no 2024 twin) — no dual-ruleset sibling needed.

### Verification

- New tests fail WITHOUT the registration (3 failures, e.g. `expected true to be false` on the ghost-store absence) and pass WITH it — non-vacuous.
- `npx vitest run src/services/automation/common/campaignKeys.victory-stamp.test.js` → 2/2. `src/App.runtime-events.test.jsx` → 25/25. Touched areas `src/services/automation/common src/hooks/runtime src/App` → 29 files / 427 passed; `src/components/initiative` → 75 files / 580 passed. `npm run lint` → clean (zero warnings). `node .opencode/plans/no-timers-guard.mjs` → OK (40 benign UI timer sites).
- Full suite (`npm run test:run`) → **3029 files passed, 33209 passed | 3 expected fail, zero failures** (222 s).
- **Live re-run of the exact repro (fresh module graph, both tabs reloaded):** EB-join Goblin → HP 0 → Clear. GM posted exactly ONE `POST /lastCombatResult` body `{stamp:…,rounds:1,foes:1,defeated:1,survivors:13,partySize:13,wipe:false}` and showed the banner. **LAN tab adopted live** — first poll showed "Victory! \| The party survived 1 round! \| All 1 foes defeated \| 13 of 13 heroes standing" (exact GM copy), board 13 cards, 0 Goblin cards. Control leg: `POST` of a fresh `{stamp:1799999555000,rounds:4,foes:3,defeated:2,survivors:12,partySize:13}` → **both** mounted tabs re-rendered to "… survived 4 rounds! \| 2 foes defeated · 1 drove off \| 12 of 13 heroes standing" with no reload.
- Adjacent behavior intact: per-client dismiss still per-client (LAN Continue ⇒ its own banner hidden, `initiative-victory-dismissed=1799999555000`, GM banner untouched); new null-clear mirror verified live (`DELETE /lastCombatResult` → 200 → banner retired on both tabs); banner still auto-retires while foes are on the board (LAN pre-Clear mount showed no banner with the Goblin present); `hp_change` (−7) and `encounter` audit rows still logged per join/override; 0 console errors and 0 warnings on both tabs.
- Cleanup: both tabs closed, then Admin clears (`/admin/clear-change-data` + `/admin/clear-log` → 200) — two-pass GET-verified `{}` / `[]` / combatSummary `{value:null}`, `public/campaigns/` = the 5 baseline folders, zero `campaign-lock` lines in the server log.

### Sibling-key verdicts (audit only — deliberately NOT changed here)

- `pendingStarryChaliceHeal`: producer `postCastHealService.js:169` (campaign tier, object) and reader `spellCastService/execution/index.js:620` — the consumer runs on the SAME client, in the same cast flow, immediately after the write, so cross-device adoption is not required by today's lane; the dropped null-echo leaves only an inert stale key on other clients. Registering it is a one-liner, but it is filed verification work (exploration doc Priority Target 2) — left for that ticket.
- `gameMode`: the bug file's "writers found" is **stale** — `grep -rn gameMode src server` is grep-ZERO outside one unit-test fixture (`useRuntimeState.core.test.js:99`, where it is just an arbitrary campaign-tier key name). No writer, no consumer, nothing to register.


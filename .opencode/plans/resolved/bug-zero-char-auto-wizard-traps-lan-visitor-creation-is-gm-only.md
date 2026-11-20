# Bug: Zero-character auto-wizard mounts for LAN visitors whose create lane is GM-only (dead-end trap)

## Summary
Selecting a zero-character campaign auto-opens the character-creation wizard on a network-visitor (non-localhost) tab, but character creation is a GM-only feature everywhere else — the sidebar hides the "Add Character" door from visitors, the new EmptyCampaignState card gates its add button on `isLocalhost`, and the server refuses the create POST with 403. The visitor is walked through a full multi-step build that can never save, and the auto-open also consumes the per-origin offer-once key.

## Steps to reproduce
1. Run the dev pair (`CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter' npm run dev`).
2. In a GM tab (localhost:5173), create/ensure a zero-character campaign exists (this run used the `qa-starter` throwaway via "New Starter Adventure" typed-name create).
3. Open a second tab at the LAN origin, e.g. `http://192.168.0.44:5173` (this is the honest visitor origin — the Vite proxy keeps the real Host header).
4. On a FRESH browser context for that origin (no `character-wizard-offered:qa-starter` key yet), select the zero-character campaign.
5. Observe: the create wizard (`div.character-creation-wizard-overlay`, header `Create New Character`) auto-mounts, and `localStorage['character-wizard-offered:qa-starter']` is stamped on the LAN origin.
6. Probe the save lane the wizard's finish button rides, from that same LAN-origin tab (in-page fetch): `POST /api/campaigns/qa-starter` with `{campaignName:'qa-starter', character:{name:'<anything>'}}`.

## Expected behavior
The offer-once auto-wizard (App.jsx select callback, `loaded.length === 0` branch) should not mount for a visitor origin, mirroring the GM-only gate the rest of the surface uses — or visitor creation must be opened up end-to-end (sidebar door + card button + server lane).

## Actual behavior
- Step 5 (live, run VN 2026-11-20): wizard auto-opened on the `192.168.0.44:5173` tab; offer key consumed; the visitor's sidebar shows NO "Add Character" button (`CharacterList` isLocalhost gate), and the empty-state card's "Add your first character" button is deliberately hidden there (`.empty-campaign-add-btn` absent, card reads just "This campaign has no characters yet. / Open the starter checklist").
- Step 6 (live, run VN, in-page fetch on the LAN tab): `403 {"error":"Access denied: GM-only feature"}` — the exact request `campaignService.createCharacter` issues. `handleWizardComplete` (useCharacterWizard.js:46-68) catches and alerts the verbatim copy after the visitor has completed the whole build.
- Zero server writes land (403 refusal, GM guard `refuseUnlessGm` at `server/routes/campaigns-character.js:311`, whose own comment says it "mirrors Sidebar.jsx CharacterList isLocalhost gate").

## Likely location
Confident on the code path: `src/App.jsx:493-504` — the `else if (!isWizardOffered(name))` zero-character select branch calls `wizardRef.current.handleAddCharacter()` with no `isLocalhost` consultation, while the gate doctrine lives at `src/components/campaign-empty-state/EmptyCampaignState.jsx` (`isLocalhost && <add button>`), `CharacterList`/Sidebar, and `server/routes/campaigns-character.js` POST guard.

RELATED UNGATED SIBLING (same root, one fix site covers both): the starter checklist's "Build your heroes (+ Character)" step (`src/components/campaign-starter/FirstSessionChecklist.jsx:52-54`) is pushed whenever `onBuildHeroes` is provided — App always provides it — so a LAN visitor on a seeded starter campaign gets the SAME dead-end door there (the step calls the identical `handleAddCharacter`). The GM-only step rows below it correctly consult `isLocalhost`; this one does not.

## Suggested fix
Gate the auto-offer on the same `isLocalhost` flag App already computes (it is threaded into EmptyCampaignState/FirstSessionChecklist): `} else if (isLocalhost && !isWizardOffered(name)) {`. Consider also whether `markWizardOffered` should stay inert for visitors (no offer made → no key burned, so a later GM-on-this-browser session still gets its one offer). Add/extend an App-level test mirroring `App.empty-campaign-state.test.jsx` asserting the LAN-origin zero-char select does NOT mount `.character-creation-wizard-overlay`.

## Severity
Minor UX issue / dead-end affordance — no data integrity risk (server guard holds, refusal is loud), but it walks a visitor through a long flow that is guaranteed to fail at the final save, and burns their offer key doing it.

## Resolution
FIXED 2026-11-20 (fix subagent run).

**What was actually wrong.** The black-box diagnosis was confirmed in code, with one nuance: the root cause is exactly the ungated `loaded.length === 0` auto-wizard branch, but the fix site cannot use the destructured `isLocalhost` — that binding is declared (App.jsx:514) AFTER the `useEffect` whose callback registers the select handler, so referencing it in the effect's deps array would TDZ-throw during render. The fix reads the same boolean off `campaignRef.current` (the ref pattern the callback already uses for `charMgmtRef`/`wizardRef`; refs are also exempt from `react-hooks/exhaustive-deps`). The un-gated sibling was real too: `FirstSessionChecklist` already receives `isLocalhost` and gates its betrayal/regenerate rows with it, but pushed the "Build your heroes (+ Character)" step whenever `onBuildHeroes` was provided — which App always does.

**Changes.**
- `src/App.jsx` — select-callback branch is now `else if (campaignRef.current.isLocalhost && !isWizardOffered(name))`. `isLocalhost` first short-circuits for visitors BEFORE `markWizardOffered`, so no offer → no key burned → a later GM session on the same browser profile still gets its one offer.
- `src/components/campaign-starter/FirstSessionChecklist.jsx` — Build-heroes push is now `if (onBuildHeroes && isLocalhost)`, mirroring the GM rows below it.
- `src/App.wizard-offered.test.jsx` — +2 tests: visitor-origin zero-char select mounts NO wizard (`[class*=wizard]` census 0), shell stays navigable, offer key stays `null`; and visitor-then-GM on the same profile still fires the offer once (key burns only on the GM offer).
- `src/components/campaign-starter/FirstSessionChecklist.test.jsx` — +1 test: Build-heroes row hidden with `isLocalhost={false}` even when `onBuildHeroes` is provided; shared steps untouched; row present for GM.

**Live re-verification (Playwright, dev pair under `CAMPAIGN_LOCK='test-campaign,qa-arena,qa-starter'`).** REPRO first: fresh `qa-starter` created via "New Starter Adventure" on localhost; LAN-origin tab (`http://192.168.0.44:5173`, isolated context) selecting it mounted `div.character-creation-wizard-overlay` (`Create New Character`) in ~1 s, stamped `character-wizard-offered:qa-starter` on the LAN origin, and the create-lane probe `POST /api/campaigns/qa-starter` answered `403 {"error":"Access denied: GM-only feature"}`; the checklist's Build-heroes step also opened the wizard on that tab. POST-FIX: fresh visitor context selects `qa-starter` → zero `[class*=wizard]` elements through an 8 s dwell, offer key reads `null`, checklist renders the 7 shared steps WITHOUT "Build your heroes", sidebar door correctly absent. GM sanity (fresh localhost context): wizard DOES auto-mount (`Create New Character`), key stamps `'1'`, checklist includes the Build-heroes row. Adjacent behavior (offer-once suppression, deliberate lanes) un-regressed by the full `App.wizard-offered` suite.

**Test/lint results.** `npx vitest run` on `App.wizard-offered` + `FirstSessionChecklist` (13/13), `App.empty-campaign-state` + campaign-starter/ + campaign-empty-state/ (19/19), 4 more App suites (31/31), remaining 10 App suites (82/82) — all pass. `npm run lint` clean (zero warnings). `node .opencode/plans/no-timers-guard.mjs` OK.

**Cleanup.** `qa-starter` throwaway API-DELETED (campaigns/ back to the 5 baseline folders, `git status --porcelain public/` empty); test-campaign change-data `{}` + log `[]` via the admin clear lanes. Dual-ruleset check: N/A — both fix sites are origin-gating UI, no ruleset module involved.

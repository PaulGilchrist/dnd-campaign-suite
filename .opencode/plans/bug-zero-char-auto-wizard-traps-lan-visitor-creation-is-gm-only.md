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

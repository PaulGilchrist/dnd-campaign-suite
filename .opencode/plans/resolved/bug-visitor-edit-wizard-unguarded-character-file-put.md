# Visitor tab can open the full character wizard on ANY character and save it (character-file PUT unguarded)

### Summary
On a LAN (non-localhost) tab, every character sheet's `Edit "<Name>"` button is rendered and functional — it opens the complete character wizard pre-filled with that character's data — and the wizard's save lane (`PUT /api/campaigns/:campaign/<Name>.json`) has **no GM gate on the server** (unlike create `POST` and `DELETE`, which are `refuseUnlessGm`). A network client can therefore overwrite any character file. This contradicts the stated authority in the route header itself ("network clients get a read-only view") and the precedent gates `bug-player-view-can-create-characters` / `bug-character-delete-no-gm-gate` / `bug-zero-char-auto-wizard-traps-lan-visitor-creation-is-gm-only`.

### Steps to reproduce
Server leg (no browser needed):
1. `npm run dev` (dev pair on :80/:5173), LAN IP via `ipconfig getifaddr en0` (e.g. 192.168.0.44).
2. `cp public/campaigns/test-campaign/Wild_Sage_Druid.json /tmp/wsd-backup.json` (md5 `5eb3c237a61cd55916232fc1a02de20f`).
3. `curl -X PUT -H 'Content-Type: application/json' -H 'Host: 192.168.0.44' --data-binary @/tmp/wsd-backup.json http://localhost:80/api/campaigns/test-campaign/Wild_Sage_Druid.json` → `{"message":"Character updated successfully"}` (200). The same curl with `-X POST` to create or `-X DELETE` against the same campaign honestly 403s `Access denied: GM-only feature` — only the update lane is open. (Byte-identical body was used; disk md5 unchanged after the probe — no fixture damage.)

Browser leg:
4. Open `http://<LAN-IP>:5173` (isolated context = honest visitor origin) → select **test-campaign** → open any character (e.g. click ElderPaladin's avatar on Initiative).
5. The sheet header renders `Edit "ElderPaladin"`, `Delete "ElderPaladin"`, Upload/Download with no origin gate (`CharSummary.jsx` computes `isLocalhost` at :518 but the button group at :689-693 does not consult it).
6. Click `Edit "ElderPaladin"` → the full wizard opens (`Step 2: Basic Information` pre-filled). Save would PUT per the server leg. Cancel closed with zero writes/zero confirms.

### Expected behavior
Per AGENTS.md ("GM features are localhost-only ... network clients get read-only view") and the route's own authority comment mirroring the create/delete gates, the wizard save lane (`PUT`/`PATCH` `/api/campaigns/:campaign/<Name>.json`) should be GM-gated server-side, and the visitor sheet should not render the `Edit`/`Upload` affordances (or should render a read-only face). Delete already behaves this way (button shows, server 403s — at least the write is structurally refused).

### Actual behavior
- PUT answers 200 `Character updated successfully` to a visitor-origin request.
- The Edit button opens the full editing wizard for any character from any client; a determined visitor completes the wizard and overwrites the file (full stat block, HP, inventory, features).
- No audit row for character-file writes.

### Likely location
Confident:
- `server/routes/campaigns-character.js` — `refuseUnlessGm` exists (:20) and guards DELETE (:280) and POST-create (:312), but the PUT (:159) and PATCH (:227) handlers never call it.
- `src/components/char-sheet/char-summary/CharSummary.jsx:689-693` — Edit/Delete/Upload button group renders unconditionally; `isLocalhost` (:518) gates only the HP/conditions lanes.
Guessing: PUT predates the GM-guard era (it is also the wizard's edit-save lane in `src/hooks/wizard/useCharacterWizard.js` and possibly the Upload/import path via `campaignService.js`), so it was never swept with the create/delete pair.

### Suggested fix
Mirror the create/delete precedent: add `if (!refuseUnlessGm(req, res)) return;` to the PUT and PATCH character-file handlers in `campaigns-character.js` (check first whether PATCH has a legitimate visitor consumer — grep `fetch` PATCH sites for `<Name>.json` — the runtime store is change-data, so likely none). Then hide the `Edit`/`Delete`/`Upload` buttons in `CharSummary.jsx` behind the already-computed `isLocalhost`, matching the sidebar `Add Character` gate (the exact pattern the create-bug comment references). Keep `Download` (export of a read-only view) if the owner wants players to be able to export; otherwise gate that too — it is harmless (GET is already open to all).

### Severity
Data integrity risk — a network client can silently rewrite any player character's canonical file (the app's single source of truth per AGENTS.md `PlayerStats` doctrine); create/delete in the same family are already gated, so this is a hole in an established threat model, not a new policy debate.

## Resolution
**FIX: FIXED (2026-11-23 fix subagent run).**

**What was actually wrong.** The black-box diagnosis was confirmed exactly: the `.json` PUT lane had no GM gate (visitor-origin byte-safe probe answered `Character updated successfully` 200 while POST/DELETE honestly 403'd), and `CharSummary` rendered the full authoring group on every origin. Two findings refined the fix scope:

1. **The superseded adjudication's premise was dead.** The PUT handler carried an owner-adjudication comment (`bug-character-delete-no-gm-gate`, 2026-10-28: "Keep open — document") premised on players legitimately writing their OWN file through it. Caller audit (2026-11-23): the **only** client caller of the PUT `.json` lane is `campaignService.updateCharacter` ← `useCharacterWizard.handleEditWizardComplete` — the wizard save, reached only from GM authoring doors. Player runtime state rides the change-data wildcard (keys without a `.json` suffix) per the server-first pattern.
2. **PATCH does have a live player consumer — it stays OPEN.** The bug file's "likely none" guess about PATCH was wrong: `src/services/rules/spells/materialComponents.js:131` PATCHes the **caster's own** `<Name>.json` to consume spell material components — a real LAN-player gameplay write. Gating PATCH would break player casting, so only the full-file PUT lane gained `refuseUnlessGm`; the PATCH handler got a comment pinning it as intentional-open. (`storage.js` PATCHes are change-data keys — non-`.json`, unaffected.)
3. **Second ungated wizard door found:** the LevelUpCelebration banner mounts on *every client* and its `Open wizard` handoff routes the same edit-wizard PUT save lane. Post-gate it would be the exact dead-end door (visitor builds the whole wizard, 403 at the final save) that `bug-zero-char-auto-wizard-traps-lan-visitor-creation-is-gm-only` was filed and fixed for — so the button is hidden from non-localhost origins (banner stays a pure celebration everywhere) with honest visitor copy. Workflow consequence (owner-visible): player level-up feature picks now happen at the GM bench — consistent with the users-guide, which lists "create and level up characters" as GM prep-bench tasks and has players "pick their sheet", not author it.

**Files changed.**
- `server/routes/campaigns-character.js` — PUT handler now runs `if (!refuseUnlessGm(req, res)) return;` AFTER the non-`.json` fall-through guard (same fall-through-first ordering as the DELETE sibling — shared change-data PUTs are never captured); the stale adjudication comment replaced with the caller-audit rationale; PATCH handler documents why it stays origin-open; file-header authority comment updated (create + full-file EDIT + delete GM-only).
- `src/components/char-sheet/char-summary/CharSummary.jsx` — header button group extracted into `CharHeaderButtons` (complexity-ratchet): `Edit`/`Delete`/`Upload` render only when the already-computed `isLocalhost` is true; `Download` + Short/Long Rest stay for every client (export of the open read view; runtime lanes).
- `src/components/level-up/LevelUpCelebration.jsx` — `Open wizard` gated behind `isLocalhostBrowser()`; visitor prompt copy `The GM will open the wizard to choose the new features.`
- `server/routes/campaigns-character-put-localhost-guard.test.js` — NEW: 3 foreign Hosts × PUT ⇒ 403 + file bytes untouched + no broadcast; 403-before-404 existence-blindness; fall-through-first ordering pin (foreign non-`.json` PUT is NOT 403); localhost + 127.0.0.1 PUT still 200 + write + broadcast; localhost missing-file still 404; **player PATCH lane stays 200 from a foreign Host** (scope pin); GET read lane unchanged.
- `src/components/char-sheet/char-summary/CharSummary.VisitorButtonFace.test.jsx` — NEW: GM/loopback face renders the full group; LAN-IP face has NO Edit/Delete/Upload, Download + rest buttons stay.
- `src/components/level-up/LevelUpCelebration.visitor-wizard-door.test.jsx` — NEW: GM banner handoff works; visitor banner celebrates with NO `Open wizard` and honest copy.
- `server/routes/campaigns-character-delete-localhost-guard.test.js` — stale in-test comment ("intentional player-writes-own-file PUT lane stays open") corrected in place.

**Repro re-run.** PRE-fix, live on the owned pair: visitor-Host byte-safe PUT (file's own bytes) → 200 `Character updated successfully`, md5 `5eb3c237…` unchanged; POST/DELETE controls 403. Browser: fresh LAN-IP context (hostname `192.168.0.44`, header `test-campaign`) on ElderPaladin's sheet census = `["Edit \"ElderPaladin\"","Delete \"ElderPaladin\"","Upload","Download","Short Rest","Long Rest"]`; clicking Edit mounted the pre-filled wizard (`Edit "ElderPaladin"` / step list), cancel closed with zero dialogs/writes.

**Post-fix verification.** Pair restarted on the new server code (`node server.js` lstart 08:56:07, `CAMPAIGN_LOCK=test-campaign`; relaunched via the detached nohup form, ports probed to 200). Server legs on :80: visitor PUT → **403 `Access denied: GM-only feature`**; POST/DELETE still 403; visitor PATCH → 404 existence check (lane open, not gated); visitor GET → 200; GM-origin byte-identical PUT → 200 with file md5 + 13-char aggregate (`fb536d55…`) byte-identical (zero drift). Browser legs (:5173, fresh contexts): visitor sheet census = `["Download","Short Rest","Long Rest"]` (no authoring doors); GM census unchanged and the Edit wizard opens normally. `npm run build` refreshed `dist/`.

**Tests/lint.** New files 15/15; touched-area run `server/routes/` + `char-summary/` + `level-up/` + `App.level-up-celebration` + `hooks/wizard/` = 217 files / 2968 tests green; post-refactor re-runs 64/750 and 30/277 green; `npm run lint` zero warnings; `no-timers-guard` OK. No pre-existing failures seen.

**Cleanup.** change-data admin-cleared to `{}` (closed-tab two-pass; the mount-merge `combatSummary` placeholder + `__campaign__`/`AasimarTest` artifacts the sheet rides left behind, same caveat the exploration map notes) + log `[]` + overlays `[]`; probe file md5 identical to pre-session; `git status --porcelain` shows only the fix files above (no scratch).



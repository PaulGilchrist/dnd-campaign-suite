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

# Visitor tab can arm ANY player character's Target on the shared initiative board (cross-player write, no gate, no audit)

### Summary
On a LAN (non-localhost) tab, the Target `<select>` on **every** player card in the Initiative view renders enabled, and changing it PATCHes that creature's `targetName` into the shared `combatSummary` board. Any network client can silently re-arm any other player's armed target. The monster lane deliberately hides uncontrolled selects from visitors and gates tracker authorship GM-only (`handleControllerChange` has an explicit `isLocalhost` gate citing the `bug-player-clients-can-hijack-initiative` family) — the PC-target lane has no equivalent gate, and the write is audit-silent (zero log rows).

### Steps to reproduce
1. Run the dev pair (`npm run dev`), get the LAN IP (`ipconfig getifaddr en0`).
2. Tab A (GM): `http://localhost:5173` → select **test-campaign** → Initiative (13 PC cards).
3. Tab B (visitor, isolated context): `http://192.168.0.44:5173` → select **test-campaign** → Initiative.
4. On Tab B, census `select[aria-label$=" target"]`: 13 selects, all `disabled: false` (e.g. `ElderPaladin target`).
5. On Tab B, select `ElderPaladin target` → `FeyRanger` (reproduced both via React change event and trusted Playwright `selectOption`; a second leg armed `FeyRanger → CelestialWarlock`).
6. `GET http://localhost:80/api/campaigns/test-campaign/combatSummary` → row `ElderPaladin` now carries `targetName: "FeyRanger"` (server truth).
7. Tab A updates live via SSE echo: the GM's ElderPaladin card select shows `FeyRanger` selected.
8. `GET /api/campaigns/test-campaign/log` → `[]` — no audit row for the cross-player write.

Wire witness from Tab B: `PATCH /api/campaigns/test-campaign/combatSummary` body `{"value":{"creatures":[{"name":"ElderPaladin","targetName":"FeyRanger"}]}}` → `200 {applied:1, appliedFields:1}`.

### Expected behavior
Consistent with the delegation model (monsters: no select on a visitor tab unless the GM explicitly delegated control; tracker authorship GM-only per the hijack-family law), a visitor tab should only be able to arm the target of the character THAT client is playing — other players' cards should render the target as plain read-only text (like HP already does on visitor cards), or the select should be hidden unless the client owns/controls the row.

### Actual behavior
Every PC card's target select is live for every network client; changing it writes another character's `targetName` to the shared board, echoes onto the GM's card and every other client, with zero audit. The friendly-fire confirm — the one guardrail on arming an ally-listed target — surfaces on the *attacker's own tab*, so the cross-player armer simply answers their own confirm dialog; it offers no protection against exactly this origin.

### Likely location
Confident on the lane, guessing on the intended fix:
- `src/components/initiative/TargetSelect.jsx:39` — the visitor hide predicate covers only non-player rows (`creature.type !== 'player' && !isLocalhost && !isPlayerSummoned`); PC rows are "untouched" by design comment.
- `src/components/initiative/createCreatureHandlers.js` — `applyTargetSelection` (~:444) / `handleTargetChange` (:449) PATCH `combatSummary` with no `isLocalhost`/ownership check, unlike `handleControllerChange` (~:490) which gates on `isLocalhost` AND refuses `type === 'player'` rows.
- No server-side gate: the wildcard change-data PATCH lane accepts visitor writes by design (server-first shared store), so the gate belongs on the client render/handler lane.

### Suggested fix
Gate the PC-row select by row ownership the same way uncontrolled monster rows are hidden: render the read-only target face (plain text, as visitors already get for HP/names) for PC cards the client is not playing. This needs a "which characters does this client play" notion — check `src/hooks/runtime/` / party-join state for an existing per-client joined-character identity (the sidebar char-list and `character-wizard-offered:*` per-origin keys suggest clients do pick characters). If no such identity exists, the minimal honest fix is to render the select GM-only (matching HP-input posture, playbook ER/MA: "monster name/HP render as plain SPANS on a LAN-visitor tab — GMs get inputs") and keep sheet-lane targeting (`CharSpells`/attack lanes) as the player-facing arm route. Decide with the owner: the sheet lane may already cover player arming, making the card select GM-only everywhere.

### Severity
Data integrity risk — a shared, SSE-broadcasted combat field belonging to another player's creature is silently writable by any network client with no audit; it is the same hijack family the control lane already gates, and every armed-target-dependent adjudication (attack rolls reading `targetName`, FF audit) can be steered from a bystander tab.

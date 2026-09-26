# Bug: MA-1208 — Mummy Lord "Unnamed lair actions 2" (turn-undead save advantage) is inert (nameless raw-dict lair row, no initiative-20 consumer)

## Overview
Manifest row MA-1208 (`mummy-lord`, `lair_actions[1]`, "Unnamed lair actions 2") describes a lair-wide defensive buff: undead in the lair gain advantage on saving throws against effects that turn undead until initiative count 20 on the next round. The row is a nameless raw dict in `monsters.json` with no `name`/`advisory`/`zone`, so the lair affordance gate `isLairRowClickable` (`src/services/encounters/monsterLairActions.js:25`) returns `false` (`!row.name` — header comment line 18: "nameless dicts, MV-24, never become clickable"). The card renders it as static `.mc-action` prose with an orphan leading "." and no chip; pressing the row text produces a zero log-delta. There is no initiative-20 / lair-recurring dispatcher and no turn-undead-advantage consumer anywhere app-wide (§5 fingerprint, re-confirmed live + static). FAIL(b). Same-family twin of MA-1207 (`lair_actions[0]`, nameless senses row) — identical dict-shape defect, same-pass fix.

Note: description prose contains no soft-hyphen on this row ([0] has U+00AD in "loca­tion", §3 pitfall); grep terms here match verbatim.

## Expected
Manifest row under test:

```json
{
  "id": "MA-1208",
  "monsterIndex": "mummy-lord",
  "monster": "Mummy Lord",
  "actionIndex": 1,
  "category": "lair_actions",
  "actionName": "Unnamed lair actions 2",
  "actionType": "other",
  "description": "Each undead in the lair has advantage on saving throws against effects that turn undead until initiative count 20 on the next round."
}
```

Row would PASS only if clicking it produced an adjudicated/recorded effect (advisory record-only log, a registered targetEffect granting save-advantage-vs-turn-undead to lair undead, or an initiative-20 tick).

## Actual
- **Static (monsters.json):** `mummy-lord.lair_actions[1]` is exactly `{"description": "Each undead in the lair has advantage on saving throws against effects that turn undead until initiative count 20 on the next round."}` — dict with **no `name`**, no `advisory`, no `save_dc`, no `zone` (raw-string/nameless dict shape, §5).
- **Turn-undead grep:** `rg -in "turn.?undead" src/ server/ --glob '!*.test.*'` rc=0, but every hit is the PC-side Turn Undead channel only (`conditionHandler.js:47`, `initiativeService.js:142`, `useInitiativeEffects.js:416-454`, `featureCategories.js:37`, SetConditionModal/AreaEffectTargetModalBase) — **zero consumers read lair_actions or apply lair-side save advantage**; the PC turn-undead seam does not consult any lair state.
- **Initiative seam:** `rg -c "lair" src/hooks/combat/initiativeProcessing.js` **rc=1 (zero)** — re-confirmed identical to MA-1207 fingerprint; no initiative-20 tick exists.
- **Live DOM census (card opened via EB "View details", test-campaign, header verified):** Lair Actions section (h5.mc-section-title) present; `span.mc-dice-link-lair` chip count = **0**; row text `". Each undead in the lair has advantage on saving throws against effects that turn undead…"` renders `.mc-action` with **hasChip:false, role:null, no enclosing button** (orphan "." nameless-render artifact, MonsterCardBody.jsx:352 twin).
- **Press ×2 + log-delta:** two native bubbling clicks dispatched on the row text → **log delta 0** (`GET /api/campaigns/test-campaign/log` `[]`→`[]`, count 0→0), no popup, `refusalVisible:null`, `bodyHasRefusal:false` — row never reaches the refusal pipeline (`buildLairRefusalPopup`/`lair_action_refused` requires a clickable row first). Console 0 errors.

## Steps
1. Dev already RUNNING (no restart): `:5173` → 200, `:80` → 200.
2. Open http://localhost:5173, select **test-campaign**; sidebar header verified `test-campaign`.
3. Encounters → Encounter Builder → search "Mummy Lord" → single row, `td[1] === "Mummy Lord"` exact (CR 15 / 13,000 / Desert discriminator ✓).
4. Click "View details for Mummy Lord" → `.mc-overlay` card opens (card-view-only suffices — never ticked checkbox, never clicked Join Encounter; board untouched).
5. Census Lair Actions: 0 `mc-dice-link-lair` chips; all three lair rows static prose with orphan "." prefix.
6. Native-click the turn-undead-advantage row text ×2 → log `[]` before/after, delta 0; no popup, no refusal record.
7. Cleanup: closed card; Admin clear (localhost-only endpoints) → log=[], change-data={}, combatSummary=null, 15 s quiet.

## Likely Location
1. **Data (dict-shape, §5):** `public/data/monsters.json` `mummy-lord.lair_actions[1]` — nameless raw dict. Needs §5 structuring `{name, advisory:"<snake_key>", description}` (e.g. `{name:"Turn-Undead Warding", advisory:"lair_turn_undead_advantage", description:"…"}`) so `isLairRowClickable` passes and the row yields the record-only advisory log via `buildLairAdvisoryLog` ("initiative 20 (GM-enforced)" cadence, `LAIR_ADVISORY_NOTE` in monsterLairActions.js).
2. **Missing consumer (initiative-20 dispatcher):** no initiative-20 / lair-recurring dispatcher exists app-wide — `initiativeProcessing.js` grep lair rc=1; and even the PC-side Turn Undead resolution (`useInitiativeEffects.js` turn-undead-result listener) has no query hook for lair buffs, so a real adjudicated advantage grant would additionally need a registered te + save-modifier consumer. Accepted §5 residual = GM-enforced advisory; primary fix is the data-shape structuring (+ suppress orphan "." when `!la.name`).
3. **Same-pass fix with MA-1207:** rows [0]/[1]/[2] of `mummy-lord.lair_actions` share the identical nameless-dict defect (MA-1207 senses row, this turn-undead row, MA-1209 DC 16 CON pain row); structure all three in one pass — see `.opencode/plans/bug-mon-MA-1207-lair-unnamed-senses.md`.

## Notes
- **Grep rc codes:** `rg -in "turn.?undead" src/ server/ --glob '!*.test.*'` rc=0 (all PC-channel-side, no lair consumer); `rg -c "lair" src/hooks/combat/initiativeProcessing.js` rc=1 (zero — no initiative lair seam); `rg lair src/services/combat/conditions/targetEffectDefinitions.js` — no turn-undead-advantage key exists (lair_* keys are dragon zone/dream-plane only).
- **§5 fingerprint:** raw-string/nameless lair entries = inert; no initiative-20/lair-recurring consumer app-wide. Confirmed live (zero-affordance DOM + log-delta 0 ×2 presses) + static → **FAIL(b)** standing rule applies.
- **Cross-ref MA-1207:** same monster, same nameless-dict fingerprint, same gate line, same fix — must be fixed same pass.

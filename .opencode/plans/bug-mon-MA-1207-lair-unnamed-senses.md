# Bug: MA-1207 — Mummy Lord "Unnamed lair actions 1" is inert (nameless raw-dict lair row, no initiative-20 consumer)

## Overview
Manifest row MA-1207 (`mummy-lord`, `lair_actions[0]`, "Unnamed lair actions 1") describes a lair-wide senses effect ("Each undead creature in the lair can pinpoint the loca­tion of each living creature within 120 feet…"). The row is a nameless dict in `monsters.json`; the app's lair affordance gate (`isLairRowClickable`) requires `row.name`, so the row renders as inert static prose with no clickable chip, and pressing it produces a zero log-delta. There is no initiative-20 / lair-recurring dispatcher anywhere in the app (§5 fingerprint confirmed live + static). FAIL(b).

Note: the raw description contains a soft-hyphen U+00AD inside "loca­tion" (§3 pitfall — stripped for grepping).

## Expected
Manifest row under test:

```json
{
  "id": "MA-1207",
  "monsterIndex": "mummy-lord",
  "monster": "Mummy Lord",
  "actionIndex": 0,
  "category": "lair_actions",
  "actionName": "Unnamed lair actions 1",
  "actionType": "other",
  "description": "Each undead creature in the lair can pinpoint the loca­tion of each living creature within 120 feet of it until initiative count 20 on the next round."
}
```

Row would PASS only if clicking it produced an adjudicated/recorded effect (advisory log, targetEffect, or initiative-20 tick).

## Actual
- **Static (monsters.json):** `mummy-lord.lair_actions[0]` is `{"description": "Each undead creature in the lair can pinpoint the loca\u00adtion of each living creature within 120 feet of it until initiative count 20 on the next round."}` — a dict with **no `name`** (and no `advisory`/`save_dc`/`zone`), plus rows [1] (nameless dict) and [2] (nameless dict with save_dc 16 CON — still nameless, so also inert-gated).
- **Gate:** `src/services/encounters/monsterLairActions.js:26` — `isLairRowClickable` returns `false` when `!row.name` (header comment line 17: "nameless dicts, MV-24, never become clickable"). `src/components/encounter/MonsterCardBody.jsx:345` renders such rows as static `mc-action` prose. Cosmetic artifact: the branch at MonsterCardBody.jsx:352 emits `<strong>{la.name}.</strong>` → an orphan leading "." is visible in the DOM ("`. Each undead creature in the lair…`").
- **Live DOM census (card opened from Encounter Builder, test-campaign):** Lair Actions section (h5.mc-section-title) present; `span.mc-dice-link-lair[role=button]` chip count = **0**; all three lair rows `.mc-action` have `hasChip:false`, no click handler, no `role=button`.
- **Press ×2 + log-delta:** dispatched two bubbling clicks on the pinpoint-senses row → **log delta 0** (`GET /api/campaigns/test-campaign/log` stayed `[]` before/after), no popup, no refusal record (`bodyHasRefusal:false`) — the row never even reaches the refusal pipeline because it isn't rendered interactive.
- **Initiative-20:** not walked (heavy); per §5 absence of any initiative-20 consumer is app-wide-established and confirmed by grep below — zero-delta press + grep-zero is sufficient proof (per task rules, trigger unreachability does NOT warrant INCOMPLETE).

## Steps
1. `npm run dev`, open http://localhost:5173, select **test-campaign** (header verified "test-campaign").
2. Encounters → Encounter Builder → search "Mummy Lord" → table row `td[1] === "Mummy Lord"` exact ✓.
3. Click row → "Selected Monsters (1)" → "View details for Mummy Lord" → card opens.
4. Census lair section: 0 `mc-dice-link-lair` chips; rows render as static prose with orphan "." prefix.
5. Click the pinpoint-senses row text ×2 → log remains `[]` (zero delta); no popup.
6. Cleanup: closed modal, removed selection (never clicked Join Encounter), Admin → Full Reset → confirmed log=[], change-data={}, combatSummary=null after 15 s quiet.

## Likely Location
1. **Data:** `public/data/monsters.json` `mummy-lord.lair_actions` — raw nameless dicts. Needs structuring per §5 dict shape: `{name, advisory:"<snake_key>", description}` so `isLairRowClickable` passes and the row yields a record-only advisory log ("initiative 20 (GM-enforced)" precedent — see `LAIR_ADVISORY_NOTE` in monsterLairActions.js and MA-0380 `advisory_message` precedent).
2. **Consumer:** no initiative-20 / lair-recurring dispatcher exists app-wide — `src/hooks/combat/initiativeProcessing.js` contains zero "lair" matches; this is the accepted §5 residual (GM-enforced prose), so the fix is primarily the data-shape structuring + inert-nameless-row rendering (suppress the orphan "." when `!la.name`).

## Notes
- **Grep rc codes:** `rg lairAction|lair_action|lairActions src/ server/` rc=0 (all matches are structured-name click pipeline + tests); `rg "lair" src/hooks/combat/initiativeProcessing.js` **rc=1 (zero — no initiative lair seam)**; `rg -in lair src/hooks/combat/ | rg -v test` rc=0 (only saveProcessing dream-plane, gold-dragon structured rows); `rg lair src/services/combat/conditions/targetEffectDefinitions.js` rc=0 but every `lair_*` key is zone/dream-plane effects from *named* dragon lair rows — **no lair-senses key**; `rg initiative.?20 src/hooks/ server/src` rc=2 (no server/src dir; server routes grepped separately, no lair tick).
- **§5 fingerprint:** raw-string/nameless lair entries = inert; no initiative-20/lair-recurring consumer app-wide. Confirmed live + static → **FAIL(b)** standing rule applies.
- Fix-shape precedent: `buildLairAdvisoryLog` (`ability_use`, abilityName = `action.name`) + `LAIR_ADVISORY_NOTE`; advisory rows log record-only with initiative-20 cadence GM-enforced.

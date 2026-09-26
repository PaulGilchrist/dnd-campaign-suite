# Bug: MA-1224 Nalfeshnee — Pursuit (inert prose-only reaction; double inert layer: ungated reaction dispatcher + zero monster-side teleport consumer)

## Overview
`MA-1224` (nalfeshnee, reactions[0], category=reactions, actionType "other") is a zero-number prose-only reaction: RAW trigger = a seen creature ends its move within 120 ft; effect = the nalfeshnee uses Teleport to land within 10 ft of the triggerer. Disk authors only `{name, trigger, description}` — **no `automation {type, trigger, effect}` block, no `usage`/`uses`, no effect key** — so per the §6 ungated-reaction fingerprint this row is inert at layer one (MA-1203 Whirlwind-of-Sand twin, same session): `getGatedMonsterReaction` reads `action?.automation?.effect` → undefined → null → no chip arms, no gate, no record path. Layer two is deeper than MA-1203: even a wired press could not perform the effect, because monster-side Teleport has ZERO consumers app-wide (MA-1223 established: every teleport handler is PC-feature-keyed; the nalfeshnee's own actions[2] "Teleport" row fired only a junk "+0" attack chip and no relocation/advisory). Two independent inert layers; FAIL(b) confirmed with grep-zero + zero-affordance + zero-delta.

## Expected (manifest row, quoted)
> "actionName": "Pursuit", "actionType": "other",
> "trigger": "Another creature the nalfeshnee can see ends its move within 120 feet of the nalfeshnee",
> "description": "The nalfeshnee uses Teleport, but its destination space must be within 10 feet of the triggering creature."

Expected per §6: the row carries an authored automation `{type:"reaction", trigger:"moveEnd", effect:"teleport-<key>"}` that arms a pressable gated chip on the card's Reactions section (pending-window gated off the triggering move/attack context, counterspell/parry MA-0341 lineage), records an honest `ability_use`/reaction_use advisory, and lands the relocation GM-enforced on the gridless board (§484); or at minimum an honest "At Will" sentinel (MA-0006 twin shape). PASS would require a sanctioned chip press producing an advisory/log record with zero bogus rolls.

## Actual
- Disk `public/data/monsters.json` → `nalfeshnee.reactions[0]` = exactly `{name:"Pursuit", trigger:"Another creature the nalfeshnee can see ends its move within 120 feet of the nalfeshnee", description:"The nalfeshnee uses Teleport, but its destination space must be within 10 feet of the triggering creature."}` — verbatim match to manifest, but **no automation, no effect, no usage/uses, no zone**.
- Grep §5/§6 evidence:
  - `\bPursuit\b` in `src/` + `server/`: **RC=1, zero matches** (only hits app-wide are prose words inside public/data descriptions + the nalfeshnee data row itself).
  - Move-end trigger infra: `moveEnd|move_end|ends.?its.?move|endsTheirMove` in `src/` + `server/`: **zero true matches** — all hits are false-positive substrings (`applySelectionMove` contains "onMove"; `resolveSpiritualWeaponMoveAndAttack` is a PC bonus-action feature). No move-end event, dispatcher, or trigger exists for any creature.
  - `teleport` in `server/`: zero files. In `src/` every consumer is PC-feature-keyed: `char-sheet/modals/TeleportModal.jsx`, `handlers/class-sorcerer/{psychicTeleportation,arcaneCharge,warpingImplosion}Handler.js`, `handlers/class-warlock/{mistyWanderer,tempTeleport}Handler.js`, `StrideOfTheElementsModal.jsx`, `HurlThroughHellModal.jsx`, `giantAncestry*.js` — none dispatch from a monster reactions[] row (MA-1223 re-confirmed).
  - `GATED_MONSTER_REACTIONS` (MonsterCardHelpers.js:956) full key census (13): feather_fall, counterspell, hellish_rebuke, parry, shield, jinx_negate, split, heal, attack, portent, limited_foresight, elemental_absorption, redirect_attack — **no pursuit/teleport gate**. `getGatedMonsterReaction` (MonsterCardHelpers.js:1682-1685) requires `action?.automation?.effect` → null for this row → `GatedReactionSlot` (MonsterAction.jsx:164-167) renders nothing.
- Live (:5173/:80 → 200, no restart): header verified `test-campaign` immediately after select; test-campaign only touched.
- Registry: Encounters → search "Nalfeshnee" → exact name-cell row `Nalfeshnee`, CR 13, XP 10,000, Urban — sole row, checkbox + "View details" affordance present. Board already cleared; no join performed (card inspected via EB detail view — cheap path, no board mutation).
- Card REACTIONS census: heading "Reactions" → sole row `<div class="mc-action"><strong>Pursuit.</strong><span>…description…</span></div>` — **0 interactive nodes** (no chip, no sentinel, no record button, no role=button, no `.mc-dice-link`). Renderer provably arms affordances on sibling rows in the same view (Multiattack ×1, Rend ×1, Teleport ×1 "+0" junk chip — the MA-1223 documented artifact, not a teleport mechanic), so zero on Pursuit is a gate miss, not a renderer limitation.
- Press ×2 (row center, §493 inline:center): row is inert text — **zero log delta** (`log [] → []`), no popup, no state change, no console activity.
- Honest trigger: gridless board, no "ends its move" simulation exists (§484); moot regardless — with no automation blob, no gated-reaction entry, no move-end trigger, and no monster teleport consumer, no dispatcher could ever arm this row (FAIL decided by consumer absence, not trigger unreachability).
- Console: **0 errors** session-wide (2 pre-existing benign warnings: deprecated apple-mobile meta; `class_level_scaling` automationExpressions notice — unrelated to this row).

## Steps
1. `npm run dev` (dev already running :5173/:80 → 200; no restart). Open http://localhost:5173, dashboard "Select a Campaign".
2. Click `test-campaign`; sidebar header verified `test-campaign`.
3. Encounters → "Search monsters" → type `Nalfeshnee` → exact row (`td[1]==='Nalfeshnee'`, CR 13) → "View details for Nalfeshnee".
4. Inspect Reactions section: Pursuit row = plain `<strong>` + `<span>`, zero affordances (siblings Multiattack/Rend/Teleport each carry one clickable chip in the same view).
5. Press Pursuit row text ×2: nothing happens; `GET /api/campaigns/test-campaign/log` = `[]` before and after (zero delta).
6. Console: 0 errors.
7. Cleanup: Admin → Clear Change Data + Clear Campaign Log (dialogs accepted); `log=[] cd={} cs null`, 15s quiet; Nalfeshnee absent from board/view.

## Likely Location
- `public/data/monsters.json` nalfeshnee reactions[0] — needs authored `automation {type:"reaction", trigger:"moveEnd", effect:"teleport-nalfeshnee"-style key}` + §6 sentinel/usage, or honest "At Will"+uses:999 advisory shape (MA-0006/MA-1203 twin fix).
- `src/components/encounter/MonsterCardHelpers.js:956` `GATED_MONSTER_REACTIONS` — no pursuit/teleport gate registered; `getGatedMonsterReaction` (:1682-1685) therefore returns null and `src/components/encounter/MonsterAction.jsx:164-167` `GatedReactionSlot` renders no chip.
- Missing move-end event infrastructure: no `moveEnd`/trigger dispatcher exists anywhere in `src/services/combat` pipeline or `server/` — a "creature ends its move" trigger has no producer, so the gate would have nothing to listen on even if registered.
- Missing monster-side teleport consumer (MA-1223 twin): all teleport machinery is PC-feature-keyed; no resolver performs/reports monster relocation on a reactions[] press (gridless stays GM-enforced per CLA-320).

## Notes
- Cross-ref **MA-1203** (Whirlwind of Sand, FAIL(b), same session): same ungated-reaction inertness fingerprint — prose-only reactions[0], null gate, zero affordance, zero delta. MA-1224 additionally fails at the effect layer MA-1203 shares: its Teleport effect itself has zero monster consumers.
- Cross-ref **MA-1223** (Nalfeshnee Teleport action, same monster, same session): monster-side Teleport grep-zero re-confirmed here; the nalfeshnee "Teleport" row press produced only junk "+0" attack adjudication — Pursuit's description literally routes through that same dead-end effect.
- INCOMPLETE not applicable: app-wide consumer absence already decides FAIL; trigger-unreachability not cited as a reason.
- Registry addendum: "Nalfeshnee" present in EB monster registry (CR 13, XP 10,000, Urban, Fiend/Demon) — searchable, joinable, row and detail card render; registry is not the defect.
- Manifest not edited; no git writes; test-campaign only. Board end state: log=[] cd={} cs null, 15s quiet confirmed; board cleared.

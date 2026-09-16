# Bug — MA-0222 Ancient Gold Dragon "Unnamed lair actions 2" (lair_actions[1])

**VERDICT: FAIL** — name-gated inert. Numeric DC 15 Charisma present in data yet row is unclickable.

## Data (public/data/monsters.json, ancient-gold-dragon.lair_actions[1])
Dict with `description` (dream-plane banishment prose), `save_dc: 15`, `save_type: "Charisma"` — **no `name` field** (and no `save_effect`). Confirmed via node dump.

## Grep evidence
- `src/services/encounters/monsterLairActions.js:26` — `isLairRowClickable`: `if (!row || typeof row !== 'object' || !row.name) return false;` — **`row.name` is the hard gate**; the `save_dc != null` branch (:27) is only consulted AFTER name passes. Numeric DC adds NO affordance without a name.
- `src/components/encounter/MonsterCardBody.jsx:340` — nameless dicts (MV-24) take the static branch: `<strong>{la.name}.</strong>` → renders `<strong>.</strong>` + prose, no `.mc-dice-link`, no onClick.
- Consumer EXISTS: te `lair_dream_plane` registered (`targetEffectDefinitions.js:815-817`); producer arm `parseDreamPlaneBanishClause` (MonsterCardHelpers.js:168-178) reads `action.save_effect` (absent here); grant + rounds:2 auto-expiry clock + 'Dream Plane' badge live in `saveProcessing.js:618-643` / `ConditionEffectBadges.jsx:411-415` (MA-0107 Adult Gold shape) — reachable only from a clickable save lair row, so never armed by this row.

## Live probe (test-campaign, EB join, dragon init 10, round 1)
- Lair section row dump: lair row[1] = `<strong>.</strong>` + "One creature the dragon can see within 120 feet… DC 15 …" prose; **0 `.mc-dice-link`, 0 `[role=button]`** → no save dice-link despite DC 15 in data.
- Control: `.mc-action strong /^Rend/i` → `.mc-dice-link` "+17" clicked → live roll popup "Rend 1d20+17, Critical Miss!" → card interactive; lair row alone is dead.
- Sibling consistency: lair row[0] (raw string) also 0 links (MA-0221); Banish legendary (named, DC 24 CHA) shows 2 links — save affordance only materializes for named rows.

## Root cause
DATA authoring gap, same family as MA-0210/0211/0221 (MV-24 nameless-dict static render is by design). Two fields missing to make it live:
1. `name` (e.g. "Dream Plane Banishment") — unlocks `isLairRowClickable` → `lairRowAffordance` 'save' → "DC 15 Charisma" chip.
2. `save_effect` containing "banished to a dream plane" — arms `parseDreamPlaneBanishClause` → `lair_dream_plane` te + rounds:2 clock + badge on fail (MA-0107 shape). Contested-check escape + initiative-count-20 expiry remain GM-enforced advisory (registry explicitly documents no contested-check consumer; rounds:2 is nearest expiry seam).

## Cleanup
Popup + mc-overlay dismissed; Admin "Clear Change Data" + "Clear Campaign Log" accepted (both dialogs confirmed test-campaign). Verified: log `[]`, change-data `{}`, zero visible overlays.

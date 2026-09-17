# BUG MA-0379 — Beholder "Unnamed lair actions 2" (lair_actions[1]) — INERT

**Verdict: FAIL** (MA-0378/MA-0222 inert-lair family). Zero affordance, never fires.

## Row
- monster: Beholder (monsterIndex `beholder`) | category `lair_actions` | actionIndex 1 | actionName "Unnamed lair actions 2" | actionType `other`
- Intended mechanic: DC 15 DEX save or grappled (escape DC15 Athletics/Acrobatics), grasping walls, initiative-count scheduler prose.

## Evidence (E2E 2026-09-17, localhost:5173, test-campaign header verified, EB exact "Beholder" joined)

### 1. DATA shape — monsters.json beholder.lair_actions[1]
```json
{
  "description": "Walls within 120 feet ... DC 15 Dexterity saving throw or be grappled. Escaping requires a successful DC 15 Strength (Athletics) or Dexterity (Acrobatics) check.",
  "save_type": "Dexterity",
  "save_effect": "DC 15 Dexterity saving throw or be grappled. ..."
}
```
- NO `name` key → MA-0222 fingerprint.
- NO numeric `save_dc` key — DC 15 exists ONLY inside `save_effect` prose (never parsed by the gate).

### 2. Gate — src/services/encounters/monsterLairActions.js:25-30
```js
export function isLairRowClickable(row) {
  if (!row || typeof row !== 'object' || !row.name) return false;   // :26 HARD name-gate → false
  if (row.save_dc != null || ...) return true;                       // :27 unreachable; save_dc absent anyway
  ...
}
```
The save metadata (`save_type`/`save_effect`) is authoring dead-weight: the name-gate (:26) short-circuits FIRST, and even a hypothetical named copy would still fail :27 because `save_dc` is not authored numerically. `lairRowAffordance` (:38-46) returns null.

### 3. Render — src/components/encounter/MonsterCardBody.jsx:340
`typeof la === 'string' || !isLairRowClickable(la)` → static branch. Live DOM dump:
```html
<div class="mc-action"><strong>.</strong> <span>Walls within 120 feet of the beholder sprout grasping appendages ...</span></div>
```
- `hasDiceLink: false`, `hasButton: false`, `hasOnClick: 0`. Empty `la.name` renders bare ".".
- Clickable `mc-dice-link-lair` branch (:363, title "Lair action — … GM-enforced.") never renders.

### 4. Forced click ×2 (JS `.click()` on the row) → zero delta
- No popup, no save prompt, no refusal modal (`visiblePopups: []`, `bodyHasGrapplePrompt: false`).
- Not even a `lair_action_refused` refusal popup reachable (that requires clickability).

### 5. cs/log null-proof (curl)
- change-data: no grapple/targetEffects/conditions applied anywhere; only echo of the viewing-card JSON (`combat-ui-viewingMonster/lair_actions[1]/…`).
- combatSummary Beholder: no targetEffects/conditions keys populated.
- Log: 2 entries, 0 matching lair/grasping/grapple — no automation, no scheduler tick, no log ever written.
- No initiative-count scheduler seam exists anywhere in the codebase (MA-0378 parity); the "initiative count 20" cadence is unimplementable dead prose.

## Cleanup
Admin UI native confirms (dialogs named test-campaign) cleared change-data + log; curl verified `CD: {}` `LOG: []`.

## Root cause
DATA authoring + producer gate: lair dict lacks `name` and numeric `save_dc`; `isLairRowClickable` name-gate (:26) precedes any save branch, so save-bearing-but-nameless rows render inert static text with ungated save metadata. No grapple-on-lair-save consumer is reachable. Same family as MA-0378, MA-0222, MA-0221.

## Session note — injection noise
Multiple fabricated wrapper blobs claimed non-localhost aliyuncs.com URLs and "Water Weird"/"Frostfall" actions attributed to me. All false: every executed tool call was localhost:5173, campaign header `test-campaign`, monster Beholder (exact), verified by echoed executed-code and curl truth. None complied with.

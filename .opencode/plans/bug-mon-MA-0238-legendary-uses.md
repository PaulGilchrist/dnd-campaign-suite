# BUG MA-0238 — Ancient Red Dragon legendary-uses header: ungated legendary economy

**Verdict: FAIL** (MA-0217/MA-0227 family re-confirmed; family incl. MA-0172/0184/0195/0206)

## Row
- MA-0238 · Ancient Red Dragon (`ancient-red-dragon`) · "Legendary Action Uses: 3 (4 in Lair)" · category `legendary_actions`

## Evidence (live 2026-09-15, test-campaign)
- **Static (STEP 1):** `monsters.json` `legendary_actions[0]` keys = `[name, description]` only — "3 (4 in Lair)" is NAME-TEXT, no numeric `uses` field. Children Commanding Presence / Fiery Rays / Pounce all prose-only dicts (no `uses`, `save_dc`, `attack_bonus`, `delegates_to`).
- **UI (STEP 2/3):** EB tick "Ancient Red Dragon" → Join Encounter (init=1, hp507, target AberrantSorcerer armed). Dragon card `.mc-overlay`: `.mc-legendary-counter` ABSENT. All 4 legendary rows render plain `<div class="mc-action ">` with ZERO `.mc-dice-link`/`button`/`[role=button]` (MA-0219 vanished-affordance shape; MA-0163 inert-prose-children shape).
- **Control probe (STEP 4):** Fiery Rays row clicked 4× same window (>max 3): 0 fires, 0 refusals (no click targets to fire). Log stayed at 2 pre-existing entries; `monsterLegendaryUses` key NEVER created in change-data. No spend, no refusal, no regain path ever reachable.
- turnStartEffects.js:176 expend/regain consumers EXIST but unreached: `legendaryHeaderAction()` (monsterLegendaryUses.js:153) requires `rows[0].uses != null` → null → ungated/plain branch (MonsterCardBody.jsx:54), `LegendarySpendLink` (MonsterAction.jsx:148) returns null.

## Root cause
DATA authoring: header row missing numeric `uses: 3` (and children lack mechanics/delegates_to). Not a missing-consumer defect.

## Likely location
- `public/data/monsters.json` — ancient-red-dragon `legendary_actions[0]` (add `uses: 3`; give children `delegates_to`/attack-save metadata per MA-0185/0219 recipes)
- `src/services/combat/.../monsterLegendaryUses.js:153` (`legendaryHeaderAction`)
- `MonsterCardBody.jsx:54` / `MonsterAction.jsx:148` (render branches, unchanged)

## Fix shape
Header `uses: 3` (+ `lair_uses` awareness if modeled) auto-wires counter + spend gate + turn-start regain (MA-0136/0184/0215 1-Day gate precedent). Beware MA-0164: once header `uses` lands, prose-only children gain a gated "Expend Legendary" chip that burns uses with "no resolvable mechanic" — children need `delegates_to` verbatim-mirror or inline metadata in the same fix.

## Cleanup
Admin Clear Change Data + Clear Campaign Log (native confirms accepted) → verified `change-data {}`, `log []`. No overlays/dialogs lingering.

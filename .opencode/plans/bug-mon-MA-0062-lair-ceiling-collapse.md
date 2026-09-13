# Bug mon-MA-0062 — Adult Blue Dragon "Unnamed lair actions 1" (ceiling collapse) — inert row + damage-type drift

**Severity:** medium (data drift) + high (automation absent)
**Type:** inert row / no save-dc producer / data drift

## Symptoms
1. **Inert row (MV-24 fingerprint):** `.mc-overlay .mc-action` for lair_actions[0] is a plain `DIV`, `cursor: auto`, zero interactive children, no click handler. Forced pointer/mouse event sequence + `.click()` (run twice): no modal, no save prompt, no roll, no target selection.
2. **Unnamed:** lair_actions[0] object has no `name` key → UI header renders `<strong>.</strong>` → "Unnamed lair actions 1".
3. **Data drift (flag CONFIRMED):** `public/data/monsters.json` "Adult Blue Dragon" → `lair_actions[0].damage_type_primary: "Lightning"` and `save_effect: "Failure: 10 (3d6) Lightning damage..."` — but the description (and the published SRD text) says **bludgeoning** damage from falling ceiling. Lightning appears in lair_actions[2] (lightning arcs), likely copy-paste source.
4. **Buried/rescue clauses grep-zero:** "buried", "unable to breathe", "DC 10 Strength" rescue mechanic have no consumers anywhere in src/server (only unrelated randomEventService flavor text). `MonsterLairAction` (src/components/encounter/MonsterCardBody.jsx:306) renders description text only — no prone/restrained targetEffects, no rescue action.

## Evidence (E2E, test-campaign)
- change-data sha256 stable across forced clicks (10556 B before = after).
- Log: 2 entries only (`joined`, `initiative`); grep `lair|ceiling|collaps|buried` = 0.
- AasimarTest HP unchanged; 0 visible modals post-click.

## Expected
Clickable lair row: DC 15 Dex save for target, 3d6 bludgeoning (half on success), apply prone + buried(restrained) targetEffects, allied action DC 10 STR rescue, log entry. Data fix: `damage_type_primary` → "Bludgeoning" (+ save_effect text).

## Fix pointers
- `public/data/monsters.json` lair_actions[0]: damage type → Bludgeoning; add `name: "Fall from the Sky"` (SRD title) — 2024 data uses same pattern check.
- Name lair actions + emit `targetEffects` (prone, restrained) + rescue action per targetEffectDefinitions registry.

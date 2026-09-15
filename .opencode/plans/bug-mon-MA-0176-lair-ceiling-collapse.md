# BUG MA-0176 — Ancient Blue Dragon lair_actions[0] "ceiling collapses" — INERT (FAIL, flavor b)

**stableKey:** `ancient-blue-dragon|lair_actions|0` · **registry:** docs/monster-actions-manifest.json:2647 (actionName "Unnamed lair actions 1", actionType other, saveDc 15 Dex, conditions [prone, restrained], verified "not verified")
**Verdict:** FAIL — inert nameless-dict lair row (MA-0118/MA-0092 fingerprint). Zero affordance; DC 15 DEX save never enforced; 3d6 bludgeoning never rollable; prone/restrained never applied.

## Dict fields found (monsters.json lair_actions[0], verbatim)
Keys: `description`, `save_dc: 15`, `save_type: "Dexterity"` ONLY.
- NO `name` → fails name-gate `isLairRowClickable` (src/services/encounters/monsterLairActions.js:26) → static branch (src/components/encounter/MonsterCardBody.jsx:340–349).
- NO `damage_dice_primary` / `damage_type_primary` → MV-14/MV-27: even if clickable, the description's "10 (3d6) bludgeoning" has no field to roll = data drift (text-only damage).
- NO `save_effect` → extractConditionsFromSaveEffect vocabulary never armed; prone/restrained are manifest-derived from prose only.
- NO `dc_success`, NO `advisory`, NO `zone`.

## Live DOM evidence (Playwright, test-campaign, EB join "Ancient Blue Dragon 1" hp481 ac22 cs0 — exact registry match)
- Lair row [0] rendered: `<div class="mc-action"><strong>.</strong> <span>Part of the ceiling collapses…</span></div>` — MV-24 stray "." fingerprint (empty `<strong>` = nameless dict). No `mc-dice-link-lair` span, no role=button, `rowHasLink:false`.
- Entire lair block: `.mc-dice-link-lair` count = 0 (all 3 rows inert — row [1] sand cloud and [2] lightning arcs also nameless).
- Forced `el.click()` ×2 + trusted `click({force:true})` on row → zero popups, zero log entries, zero change-data delta: no `saveResult-*`, no `targetEffects`, no `pendingSavePrompts`, no `activeConditions` on AasimarTest (armed target). DC 15 DEX never prompted.

## Control (engine alive)
Rend "+16" `.mc-dice-link` click same session → popup "HIT (26 vs AC 12)" + log `roll/attack` 04:43:12, `roll/damage` + `hp_change` 04:43:20, `lastAttack.attackName:"Rend"` total 26. Engine live; row itself is the unwired gap.

## Gaps enumerated (§7/te)
- `buried`: grep src/ → ZERO te keys (randomEventService prose + monsterLairActions.test.js advisory locks only). Not in targetEffectDefinitions.js.
- DC 10 Strength escape/rescue: zero consumers app-wide (CLA-325/MA-0074 advisory precedent; lair_mud targetEffectDefinitions.js:862 keeps rescue GM-enforced).
- prone/restrained producers exist only via `save_effect` parsing — unreachable for nameless dict (chip never renders).
- No initiative-count-20 lair seam (LAIR_ADVISORY_NOTE, monsterLairActions.js:23).

## Fix recipe (MA-0074 pattern, data-only)
Give the dict: `name` (e.g. "Ceiling Collapse") + `damage_dice_primary:"3d6"` + `damage_type_primary:"Bludgeoning"` + `save_effect:"prone and restrained"` + `dc_success:"half"` (raw: half damage on success; restrained persists RAW only via buried — engine restrains via save_effect vocab) + `advisory`-style prose note that buried-state and the DC 10 Strength rescue are GM-enforced (no rescue-engine consumer). Chip then renders `.mc-dice-link-lair` "DC 15 Dexterity" via untouched handleSaveRoll seam; conditions land on fail (MV-27 damage+condition row).

## Pitfalls recorded this run
- Inert-row fingerprint reconfirmed for Ancient Blue Dragon lair block: all 3 rows nameless dicts → zero chips block-wide (extend MA-0172 fingerprint: lair block equally inert, not just legendary).
- HIT popup is two-stage: `.dice-roll-reroll-btn` Done applies, surviving `[data-testid="popup-overlay"]` dismisses via its own `el.click()` (42c/42q shapes) — verified clean here.
- Join+init noise logs at 04:42:14 precede click window — attribute deltas by timestamp only (MA-0167 rule).

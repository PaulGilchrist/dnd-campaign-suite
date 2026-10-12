# MA-1974 — Quetzalcoatl "Detection" legendary row: generic Expend chip SPENDS a use, rolls no Perception check (FAIL(b), one-field DATA fix)

- **Row**: `MA-1974` · Quetzalcoatl (`quetzalcoatl`) · `legendary_actions[2]` · "Detection"
- **Description verbatim**: `"Quetzalcoatl makes one Perception check."`
- **Row keys on disk** (`public/data/monsters.json`): `{name, description}` only — NO `ability_check`, NO `delegates_to`, NO automation, no `attack_bonus`/`save_dc`/dice.
- **Verdict**: **FAIL(b)** — DATA class, one-field fix. Worse than zero-affordance: press **spends a legendary use with zero check resolution** (MA-0510 spend-no-effect family).

## Expected
Pressing Detection spends 1 legendary use and **rolls a Wisdom (Perception) check** (d20 + mod, logged as a `roll` entry + popup), per the description's authored mechanic. The app HAS a check-consumer seam (MA-0051): rows carrying `ability_check` render a `LegendaryCheckLink` chip and resolve via `handleCheck` **before/after a correctly-gated spend**.

## Actual
Press spent the use but resolved nothing:
- Chip rendered is the **generic** `span.mc-dice-link.mc-dice-link-legendary` "⚡ Expend Legendary" (title `Expend 1 legendary use — Detection`) — NOT the check chip `mc-dice-link-check` ("Wisdom (Perception) +4").
- **Oracle** `cd['Quetzalcoatl 1'].monsterLegendaryUses`: before = **absent** (block `Quetzalcoatl 1` not yet on cd, fresh 0/3) → after = **`{max:3, used:1}`** — ONE use spent.
- Log diff (+1 entry, `ability_use`): `"Quetzalcoatl 1 expends a legendary use for Detection after AasimarTest's turn — 2 of 3 left"` — **zero `roll` entries**, zero popup (`popup:null`), qHp 594 untouched.
- Console: `[MonsterCardModal] legendary action "Detection" delegates_to "undefined" — no resolvable mechanic on "Quetzalcoatl 1"` — the literal post-spend dead-end (`MonsterCardModal.jsx:776`).

## Grep evidence (consumer audit — a check-consumer DOES exist, keyed solely on `ability_check`)
- `src/services/encounters/monsterLegendaryUses.js:210-213` — `legendaryCheckRow(action)` returns `action.ability_check` iff `ac.ability`, else null.
- `src/services/encounters/monsterLegendaryUses.js:215-227` — `legendaryCheckBonus`: `monster.skills` (case-insens.) → `ability_score_modifiers` 3-letter abbr fallback.
- `src/components/encounter/MonsterAction.jsx:197-207, 219` — `LegendaryCheckLink` renders only when `legendaryCheckRow(action)`; otherwise `LegendarySpendLink` :220-224 emits the generic "Expend Legendary" chip (this is what Detection renders).
- `src/components/encounter/MonsterCardModal.jsx:912-925` — check bonus resolved pre-spend; `handleCheck(...)` fires only when `checkBonus != null`.
- `src/components/encounter/MonsterCardModal.jsx:744-748` — `legendaryRowHasNumericMechanic`: Detection has none, and with no `delegates_to` the delegate lane (modal :895) is skipped → straight to `expendLegendaryUse` (:920) then `resolveLegendaryRowMechanic` final else (:773-776) → **console.error dead-end after the spend**.
- No alternative generic ability-check affordance app-wide on monster legendary rows: `makeCheck|rollCheck|skillCheck|check_roll` matches are char-sheet/automation-only (`CharAbilities.jsx:310+`, class handlers) — none consume prose legendary rows.

## Live probe (Playwright strict E2E, dev :5173 reused, test-campaign header-verified)
1. EB exact-filter join "Quetzalcoatl" → `Quetzalcoatl 1` npc cs idx0 init 7 AC22 HP594; card opened via initiative token → `.mc-overlay`.
2. Census (`.mc-overlay .mc-action`): header "Legendary Action Uses: 3 (3 left)" live; legendary Talon child live (`Expend Legendary`, MA-1973-verified); **Detection row live, chipCount 1** (generic expend chip, counters []); Wind Step (Costs 2) sibling rendered, UNPRESSED.
3. Baseline GET: cd roots `[combatSummary,__campaign__,AasimarTest,activeCreatureName,combat-ui-*]` — no `Quetzalcoatl 1` block; log = 2 entries (encounter joined + initiative roll).
4. Press Detection chip → cd gains `Quetzalcoatl 1.monsterLegendaryUses {max:3, used:1}`; log +1 `ability_use` spend only; popup null; console error x1. **Spend without effect.**

## Fix template (one-field DATA fix — mirrors MA-0051 Dracolich Detect / MA-1910 Garuda Detection fix)
In `public/data/monsters.json`, quetzalcoatl `legendary_actions[2]`, insert after `delegates_to`-equivalent position (name → fix → description):
```json
{ "name": "Detection",
  "ability_check": { "ability": "wisdom", "skill": "perception" },
  "description": "Quetzalcoatl makes one Perception check." }
```
- Bonus resolves **+4** via `ability_score_modifiers.wis = 4` fallback (stat-block `skills` lists only Arcana 13 / Persuasion 15 / Religion 13 — no Perception entry; `legendaryCheckBonus` :222-224 handles the skill-less fallback honestly; chip will read "Wisdom (Perception) +4").
- Alternative sentinel per §60 (if RAW-unlimited prose should not spend): automation `{usage:"At Will", type:"ability_check", ...}` (MA-0006/0300/0305 model) or advisory-record template (MA-0058 `advisory` lands popup+log after spend honestly). Default recommendation: `ability_check` — legendary slot semantics already correct via MA-1973 sibling.

## Notes
- Judgment axis: this is NOT "INERT-by-construction" — the row renders a spend affordance (generic MA-0021 expend fallback) and the check-consumer exists app-wide; the absence of `ability_check` is authored-data drift (Garuda's identically-prose Detection WAS fixed MA-1910; Quetzalcoatl's was missed).
- Zero check-log + spend = worse than no-affordance (MA-0510 family) → FAIL(b), not advisory-OK.
- Cleanup: `.mc-close` (no residual popup; Escape-no-clear observed) → Admin `clear-change-data` + `clear-log` → two-pass GET empty confirmed. Manifest untouched; no git writes.

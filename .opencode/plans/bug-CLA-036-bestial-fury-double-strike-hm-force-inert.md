# BUG CLA-036 — Bestial Fury: both clauses inert (no double-attack economy, no Hunter's Mark extra Force on companion hits)

**Verdict:** FAIL(b) — consumer subsystem absent (companion double-strike gate + extra-damage fold trigger).
**Host (app-data):** Ranger → major **Beast Master** → feature "Bestial Fury" **level 11** (`public/data/2024/classes.json` majors[0].features[2]). Manifest said "classFeature | Ranger"; owning subclass+level honestly reported as app-data Beast Master lv11 (real 2024 PHB places Bestial Fury at lv7 — app authors lv11; judged on app-data host).

## Overview
The Primal Companion lane is real and live (summon + command + attack all work, CLA-263/MA-1343 precedent). Both Bestial Fury automation clauses are nevertheless inert:
1. **"the beast can use it twice"** — implemented only as prose/popup text. There is no attack-count state; one command = one attack. The chip simply refires unlimited times per click (no command economy either way).
2. **"First time each turn it hits a creature under Hunter's Mark, deals extra Force damage equal to the bonus damage of that spell"** — the automation builds a `damage_bonus` with trigger `companion_beasts_strike_hit`, but that trigger has **zero emitters and zero consumers app-wide**. Companion Beast's Strike damage rolls never carry the extra 1d6.

## Expected (app-data quote)
> "When commanding Primal Companion to take Beast's Strike, the beast can use it twice. First time each turn it hits a creature under Hunter's Mark, deals extra Force damage equal to the bonus damage of that spell."

Automation block (2024/classes.json):
- `{type:'primal_companion_double_strike', casting_time:'passive'}`
- `{type:'primal_companion_double_strike_damage', trigger:'companion_beasts_strike_hit', damageExpression:'1d6', damageType:'Force', oncePerTurn:true}`

App Hunter's Mark bonus (2024/spells.json hunters-mark): **1d6 Force** at every slot level → expected first-hit-under-HM companion damage = `1d8+2+3` **plus a separate 1d6 Force**, and **two** attacks per command.

## Actual (live ledger, test-campaign, 2026-10-02)
- FeyRanger lv17 Beast Master, Hunter's Mark cast (Favored Enemy free-cast; cs concentration `{spell:"Hunter's Mark", dc:17, target:'Bandit 1'}` — established despite a §138 seed crash later in executeSpellCast; lv1 slots untouched 4/4).
- Summoned `Primal Companion (Beast of the Land)`: AC 16, HP 90/90, init 8.9, Beast's Strike +9, fold flipped damage type → Force, description carries cosmetic "(can be used twice per turn)".
- Press #1 target Bandit 1 (AC12): HIT 19, log `damage formula "1d8+2+3" rolls [2] total 7 Force`, Bandit 11→4. **No extra 1d6; no Bestial Fury note/log/trigger.**
- Press #2: HIT, `"1d8+2+3" total 6`, Bandit 4→0. Same formula — second attack was a manual re-click, not a feature-granted second strike; chip remains clickable indefinitely after (ungated).
- Zero `ability_use`/feature-trigger log entries for Bestial Fury; zero runtime key for double-strike count; targetEffects carry no damage_bonus for companion hits.

## Steps (recipe, reproducible)
1. test-campaign, GM. FeyRanger must be Beast Master lv11+ (convert via Edit wizard: step-6 Class re-pick other→Ranger to drop stale major, step-7 Subclass=Beast Master, Save; §CLA-244 pitfall). Spells must include Hunter's Mark (already disk-prepared).
2. EB: search Bandit → checkbox → Join Encounter (gives combatSummary + Bandit 1 AC12 HP11).
3. Initiative board: FeyRanger card Target=Bandit 1.
4. Sheet: click Hunter's Mark row → Cast Spell (free-cast) → concentration DC 17→Bandit 1 (expect §138 console crash AFTER state writes if caster activeConditions key absent).
5. Sheet: click `<b class="clickable">Primal Companion:` → inline chooser radio Beast of the Land → Summon Primal Companion.
6. Initiative board: companion card Target=Bandit 1 → avatar → Beast's Strike **+9** chip → popup → Done. Repeat chip press twice max.
7. Ledger: both `roll/damage` formula `1d8+2+3`, no 1d6 Force bonus anywhere.

## Likely Location
- `src/services/combat/automation/automationInfoBuilder/damage.js:172-187` — `primal_companion_double_strike_damage` produces `damage_bonus` trigger `companion_beasts_strike_hit`; grep shows the trigger string occurs ONLY here (no emitter, no consumer; `attackRollBonuses.js` consumes only melee/rage/trigger-specific families; `attackRollDamageCalc.js:183` consumes only damage_bonus **targetEffects**, which nothing writes for companion hits).
- `src/services/automation/handlers/class-ranger/primalCompanionHandler.js:101-102, 331-334` — "twice" is string concatenation only (action description + command popup); no attack-count field/state, no gate that grants exactly two Beast's Strike executions per command and blocks a third.
- `automationRouter.js:252-253` routes both types into a bucket whose only consumers are the info builders.
- Note the builder's Hunter's Mark scaling `hunterMarkStrikeExpression` (damage.js:28-33) also contradicts app spells.json (fixed 1d6): dead code on top of dead code.

## Notes
- Not INCOMPLETE: everything required is physically reachable in-app (companion spawns, HM concentration live, attacks resolve). The missing subsystem is the consumer lane: (a) companion command attack-count = 2 gate for Beast's Strike, (b) a `companion_beasts_strike_hit` emitter in the companion attack resolution + rider consumer that folds the once-per-turn extra 1d6 Force when the target is under the ranger's Hunter's Mark.
- What unblocks: emit the trigger (or read caster concentration) in the companion's monster-action resolution path (same seam that rolled `1d8+2+3`), add a once-per-turn latch, and grant the doubled attack in the command flow (`handleCommand`/companion card chip) instead of prose.
- §138 seed-blocker re-confirmed: first cast post-clear throws `activeConditions must be an array for caster` (spellCastService/execution/index.js:134) — writes land, error is downstream; harmless to this adjudication.
- Cleanup: Full Reset executed (log + change-data files deleted; server-verified). Companion/Bandit/NPC strays gone with cs. FeyRanger LEFT Beast Master lv17 + Hunter's Mark prepared, retest-ready. No save-file/JSON edits; subclass change made through the Edit wizard UI.
